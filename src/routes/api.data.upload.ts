import { createFileRoute } from "@tanstack/react-router";
import { createWriteStream } from "node:fs";
import { access, appendFile, mkdir, readFile, readdir, rename, rm } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { isSameOriginRequest, readAuthUser } from "@/lib/auth.server";
import {
  recordDataImportError,
  saveDataSnapshot,
  type DataSnapshotKind,
} from "@/lib/database.server";

const execFileAsync = promisify(execFile);
const MAX_FILE_SIZE = 500 * 1024 * 1024;
const MAX_CHUNK_SIZE = 20 * 1024 * 1024;
const QSC_KINDS = ["QSC Carteira", "QSC Fixa", "QSC Móvel"] as const;
const DIRECTOR_KINDS = [
  "Mapa Parque",
  "Resultados YoY",
  "Best Guess",
  "Portabilidade analítica",
  "Torres de serviço",
] as const;

function uploadsPath() {
  return path.resolve(process.env.UPLOAD_PATH || ".data/uploads");
}

async function persistSnapshot(input: {
  kind: DataSnapshotKind;
  snapshotPath: string;
  sourceName: string;
  uploadedBy?: string | null;
  sizeBytes?: number;
}) {
  const payload = JSON.parse(await readFile(input.snapshotPath, "utf8")) as unknown;
  return saveDataSnapshot({
    kind: input.kind,
    payload,
    sourceName: input.sourceName,
    uploadedBy: input.uploadedBy,
    sizeBytes: input.sizeBytes,
  });
}

async function exists(filePath: string) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

function safeFileName(value: string) {
  return path.basename(value).replace(/[^a-zA-Z0-9._ -]/g, "_");
}

function qscSemesterSlot(fileName: string) {
  const name = fileName
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase();
  if (/JUL.*DEZ|JULHO|AGOSTO|SETEMBRO|OUTUBRO|NOVEMBRO|DEZEMBRO/.test(name)) return "h2";
  return "h1";
}

type QscProcessingContext = {
  qscDirectory: string;
  snapshotDirectory: string;
  sourceName: string;
  uploadedBy?: string | null;
  sizeBytes?: number;
};

let qscProcessingPromise: Promise<void> | null = null;
let qscReprocessRequested = false;
let latestQscContext: QscProcessingContext | null = null;

async function listQscInputs(qscDirectory: string) {
  const storedFiles = await readdir(qscDirectory);
  const domains = ["carteira", "fixa", "movel"];
  const inputs = domains.flatMap((domain) =>
    storedFiles
      .filter((fileName) => new RegExp(`^qsc-${domain}(?:-[a-z0-9-]+)?\\.csv$`, "i").test(fileName))
      .sort()
      .map((fileName) => `${domain}:${path.join(qscDirectory, fileName)}`),
  );
  const available = domains.map((domain) => inputs.some((input) => input.startsWith(`${domain}:`)));
  return { inputs, available };
}

async function processStoredQsc(context: QscProcessingContext) {
  const { inputs } = await listQscInputs(context.qscDirectory);
  const processor = path.resolve("scripts", "process-qsc.mjs");
  const snapshotPath = path.join(context.snapshotDirectory, "qsc.snapshot.json");
  const mapaSnapshotPath = path.join(context.snapshotDirectory, "mapa-parque.snapshot.json");

  await execFileAsync(process.execPath, [processor, ...inputs], {
    maxBuffer: 10 * 1024 * 1024,
    timeout: 30 * 60 * 1000,
    env: {
      ...process.env,
      QSC_SNAPSHOT_PATH: snapshotPath,
      MAPA_PARQUE_SNAPSHOT_PATH: mapaSnapshotPath,
    },
  });
  await persistSnapshot({
    kind: "qsc",
    snapshotPath,
    sourceName: context.sourceName,
    uploadedBy: context.uploadedBy,
    sizeBytes: context.sizeBytes,
  });
}

function scheduleQscProcessing(context: QscProcessingContext) {
  latestQscContext = context;
  qscReprocessRequested = true;
  if (qscProcessingPromise) return;

  qscProcessingPromise = (async () => {
    while (qscReprocessRequested && latestQscContext) {
      qscReprocessRequested = false;
      const current = latestQscContext;
      try {
        await processStoredQsc(current);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Falha ao processar a base QSC.";
        recordDataImportError({
          kind: "QSC",
          sourceName: current.sourceName,
          uploadedBy: current.uploadedBy,
          sizeBytes: current.sizeBytes,
          message,
        });
        console.error("Falha no processamento assíncrono do QSC:", error);
      }
    }
  })().finally(() => {
    qscProcessingPromise = null;
    if (qscReprocessRequested && latestQscContext) scheduleQscProcessing(latestQscContext);
  });
}

export const Route = createFileRoute("/api/data/upload")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const user = await readAuthUser();
        const kind = request.headers.get("x-base-kind") ?? "";
        const isQsc = QSC_KINDS.includes(kind as (typeof QSC_KINDS)[number]);
        const isDirectorBase = DIRECTOR_KINDS.includes(kind as (typeof DIRECTOR_KINDS)[number]);
        const permitted =
          (user?.role === "director" && isDirectorBase) || (user?.role === "gn" && isQsc);
        if (!permitted)
          return Response.json({ message: "Sem permissão para esta base." }, { status: 403 });
        if (!isSameOriginRequest(request)) {
          return Response.json({ message: "Origem não permitida." }, { status: 403 });
        }
        if (!isDirectorBase && !isQsc) {
          return Response.json(
            { message: "Tipo de base ainda não suportado nesta rota." },
            { status: 400 },
          );
        }
        const originalName = safeFileName(
          decodeURIComponent(request.headers.get("x-file-name") ?? "mapa-parque.csv"),
        );
        const validExtension =
          kind === "Mapa Parque" || isQsc
            ? /\.csv$/i.test(originalName)
            : /\.xlsx?$/i.test(originalName);
        if (!validExtension) {
          return Response.json(
            { message: `${kind} foi enviado em um formato inválido.` },
            { status: 400 },
          );
        }

        const uploadDirectory = uploadsPath();
        await mkdir(uploadDirectory, { recursive: true });
        const snapshotDirectory = path.join(uploadDirectory, "snapshots");
        await mkdir(snapshotDirectory, { recursive: true });
        const contentLength = Number(request.headers.get("content-length") ?? 0);
        const uploadId = request.headers.get("x-upload-id") ?? "";
        const chunkIndex = Number(request.headers.get("x-chunk-index"));
        const chunkCount = Number(request.headers.get("x-chunk-count"));
        const declaredFileSize = Number(request.headers.get("x-file-size"));
        const isChunked =
          uploadId !== "" || Number.isFinite(chunkIndex) || Number.isFinite(chunkCount);
        const validChunkedRequest =
          /^[a-z0-9-]{16,80}$/i.test(uploadId) &&
          Number.isInteger(chunkIndex) &&
          Number.isInteger(chunkCount) &&
          chunkIndex >= 0 &&
          chunkCount > 0 &&
          chunkIndex < chunkCount &&
          Number.isFinite(declaredFileSize) &&
          declaredFileSize > 0 &&
          declaredFileSize <= MAX_FILE_SIZE;
        if (!request.body || !contentLength || (isChunked && contentLength > MAX_CHUNK_SIZE)) {
          return Response.json(
            { message: "Arquivo ou parte do upload inválida." },
            { status: 400 },
          );
        }
        if ((isChunked && !validChunkedRequest) || (!isChunked && contentLength > MAX_FILE_SIZE)) {
          return Response.json({ message: "Arquivo ausente ou acima de 500 MB." }, { status: 400 });
        }
        const uploadedPath = path.join(uploadDirectory, `${Date.now()}-${originalName}`);
        const chunkDirectory = isChunked ? path.join(uploadDirectory, "chunks", uploadId) : null;

        try {
          if (chunkDirectory) {
            await mkdir(chunkDirectory, { recursive: true });
            await pipeline(
              Readable.fromWeb(request.body as never),
              createWriteStream(path.join(chunkDirectory, `${chunkIndex}.part`), { flags: "w" }),
            );
            if (chunkIndex + 1 < chunkCount) {
              return Response.json({ uploaded: true, complete: false });
            }
            const chunksAvailable = await Promise.all(
              Array.from({ length: chunkCount }, (_, index) =>
                exists(path.join(chunkDirectory, `${index}.part`)),
              ),
            );
            if (!chunksAvailable.every(Boolean)) {
              return Response.json(
                { message: "Partes do arquivo não foram recebidas. Tente enviar novamente." },
                { status: 409 },
              );
            }
            for (let index = 0; index < chunkCount; index += 1) {
              await appendFile(
                uploadedPath,
                await readFile(path.join(chunkDirectory, `${index}.part`)),
              );
            }
          } else {
            await pipeline(
              Readable.fromWeb(request.body as never),
              createWriteStream(uploadedPath, { flags: "wx" }),
            );
          }
          if (kind === "Mapa Parque") {
            const processor = path.resolve("scripts", "process-mapa-parque-all.mjs");
            const snapshotPath = path.join(snapshotDirectory, "mapa-parque.snapshot.json");
            const { stdout } = await execFileAsync(
              process.execPath,
              [processor, uploadedPath, snapshotPath],
              { maxBuffer: 10 * 1024 * 1024, timeout: 30 * 60 * 1000 },
            );
            await persistSnapshot({
              kind: "mapa-parque",
              snapshotPath,
              sourceName: originalName,
              uploadedBy: user?.email,
              sizeBytes: declaredFileSize || contentLength,
            });
            return Response.json(
              { imported: true, processed: true, result: JSON.parse(stdout) },
              { headers: { "Cache-Control": "no-store" } },
            );
          }

          if (kind === "Best Guess") {
            const processor = path.resolve("scripts", "process-best-guess.mjs");
            const snapshotPath = path.join(snapshotDirectory, "best-guess.snapshot.json");
            const { stdout } = await execFileAsync(
              process.execPath,
              [processor, uploadedPath, snapshotPath],
              { maxBuffer: 10 * 1024 * 1024, timeout: 30 * 60 * 1000 },
            );
            await persistSnapshot({
              kind: "best-guess",
              snapshotPath,
              sourceName: originalName,
              uploadedBy: user?.email,
              sizeBytes: declaredFileSize || contentLength,
            });
            return Response.json(
              { imported: true, processed: true, result: JSON.parse(stdout) },
              { headers: { "Cache-Control": "no-store" } },
            );
          }

          if (kind === "Torres de serviço") {
            const processor = path.resolve("scripts", "process-torres-servico.mjs");
            const snapshotPath = path.join(snapshotDirectory, "torres-servico.snapshot.json");
            const { stdout } = await execFileAsync(
              process.execPath,
              [processor, uploadedPath, snapshotPath],
              {
                maxBuffer: 10 * 1024 * 1024,
                timeout: 30 * 60 * 1000,
              },
            );
            await persistSnapshot({
              kind: "torres-servico",
              snapshotPath,
              sourceName: originalName,
              uploadedBy: user?.email,
              sizeBytes: declaredFileSize || contentLength,
            });
            return Response.json(
              { imported: true, processed: true, result: JSON.parse(stdout) },
              { headers: { "Cache-Control": "no-store" } },
            );
          }

          if (kind === "Resultados YoY" || kind === "Portabilidade analítica") {
            const processor = path.resolve(
              "scripts",
              kind === "Resultados YoY"
                ? "process-resultados-yoy.mjs"
                : "process-portabilidade-analitica.mjs",
            );
            const snapshotPath = path.join(
              snapshotDirectory,
              kind === "Resultados YoY"
                ? "resultados-yoy.snapshot.json"
                : "analitico-portabilidade.snapshot.json",
            );
            const { stdout } = await execFileAsync(
              process.execPath,
              [processor, uploadedPath, snapshotPath],
              { maxBuffer: 10 * 1024 * 1024, timeout: 30 * 60 * 1000 },
            );
            await persistSnapshot({
              kind: kind === "Resultados YoY" ? "resultados-yoy" : "portabilidade-analitica",
              snapshotPath,
              sourceName: originalName,
              uploadedBy: user?.email,
              sizeBytes: declaredFileSize || contentLength,
            });
            return Response.json(
              { imported: true, processed: true, result: JSON.parse(stdout) },
              { headers: { "Cache-Control": "no-store" } },
            );
          }

          const qscDirectory = path.join(uploadDirectory, "qsc");
          await mkdir(qscDirectory, { recursive: true });
          const qscDomain = {
            "QSC Carteira": "carteira",
            "QSC Fixa": "fixa",
            "QSC Móvel": "movel",
          }[kind];
          const qscFileName = `qsc-${qscDomain}${qscSemesterSlot(originalName) === "h2" ? "-h2" : ""}.csv`;
          const finalPath = path.join(qscDirectory, qscFileName);
          await rm(finalPath, { force: true });
          await rename(uploadedPath, finalPath);

          const { available } = await listQscInputs(qscDirectory);
          scheduleQscProcessing({
            qscDirectory,
            snapshotDirectory,
            sourceName: originalName,
            uploadedBy: user?.email,
            sizeBytes: declaredFileSize || contentLength,
          });
          return Response.json(
            {
              imported: true,
              processed: false,
              processing: true,
              available: QSC_KINDS.filter((_, index) => available[index]),
              awaiting: QSC_KINDS.filter((_, index) => !available[index]),
            },
            { headers: { "Cache-Control": "no-store" } },
          );
        } catch (error) {
          const message = error instanceof Error ? error.message : "Falha ao processar a base.";
          recordDataImportError({
            kind,
            sourceName: originalName,
            uploadedBy: user?.email,
            sizeBytes: declaredFileSize || contentLength,
            message,
          });
          return Response.json({ message }, { status: 500 });
        } finally {
          await rm(uploadedPath, { force: true });
          // Keep intermediate chunks until the final request assembles the file.
          // A `return` inside `try` still executes `finally`, so removing the
          // directory here for every request discarded all previously sent parts.
          if (chunkDirectory && chunkIndex + 1 >= chunkCount) {
            await rm(chunkDirectory, { force: true, recursive: true });
          }
        }
      },
    },
  },
});
