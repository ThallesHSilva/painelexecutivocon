import { createFileRoute } from "@tanstack/react-router";
import { createWriteStream } from "node:fs";
import {
  access,
  appendFile,
  mkdir,
  open,
  readFile,
  readdir,
  rename,
  rm,
  writeFile,
} from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";
import { execFile } from "node:child_process";
import { promisify, TextDecoder } from "node:util";
import { isSameOriginRequest, readAuthUser } from "@/lib/auth.server";
import {
  listDataImports,
  recordDataImportError,
  recordDataImportSuccess,
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
  recordImport?: boolean;
}) {
  const payload = JSON.parse(await readFile(input.snapshotPath, "utf8")) as unknown;
  return saveDataSnapshot({
    kind: input.kind,
    payload,
    sourceName: input.sourceName,
    uploadedBy: input.uploadedBy,
    sizeBytes: input.sizeBytes,
    recordImport: input.recordImport,
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

function normalizedPartnerKey(value: string) {
  return value
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleUpperCase("pt-BR")
    .replace(/[^A-Z0-9]/g, "");
}

function partnerSlug(value: string) {
  return value
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function parseDelimitedSample(text: string, maxRows = 250) {
  const firstLine = text.split(/\r?\n/, 1)[0] ?? "";
  const delimiter =
    (firstLine.match(/;/g)?.length ?? 0) >= (firstLine.match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < text.length && rows.length < maxRows; index += 1) {
    const character = text[index];
    if (character === '"') {
      if (quoted && text[index + 1] === '"') {
        field += '"';
        index += 1;
      } else {
        quoted = !quoted;
      }
    } else if (character === delimiter && !quoted) {
      row.push(field);
      field = "";
    } else if ((character === "\r" || character === "\n") && !quoted) {
      if (character === "\r" && text[index + 1] === "\n") index += 1;
      row.push(field);
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      field = "";
    } else {
      field += character;
    }
  }
  if (rows.length < maxRows && (row.length || field)) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

async function qscPartnerName(filePath: string) {
  const handle = await open(filePath, "r");
  try {
    const buffer = Buffer.alloc(1024 * 1024);
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
    const sample = buffer.subarray(0, bytesRead);
    let text: string;
    try {
      text = new TextDecoder("utf-8", { fatal: true }).decode(sample);
    } catch {
      text = new TextDecoder("windows-1252").decode(sample);
    }
    const rows = parseDelimitedSample(text);
    const headerIndex = rows.findIndex((row) =>
      row.some((value) => normalizedPartnerKey(value) === "GRUPOREDETERMO"),
    );
    if (headerIndex < 0) throw new Error("Cabeçalho GRUPO_REDE_TERMO ausente na base QSC.");
    const partnerColumn = rows[headerIndex].findIndex(
      (value) => normalizedPartnerKey(value) === "GRUPOREDETERMO",
    );
    const partnerName = rows
      .slice(headerIndex + 1)
      .map((row) => row[partnerColumn]?.trim() ?? "")
      .find(Boolean);
    if (!partnerName) {
      throw new Error("Não foi possível identificar o parceiro em GRUPO_REDE_TERMO.");
    }
    return partnerName;
  } finally {
    await handle.close();
  }
}

async function canonicalQscPartner(
  partnerName: string,
  snapshotDirectory: string,
): Promise<{ id: string; name: string }> {
  try {
    const snapshot = JSON.parse(
      await readFile(path.join(snapshotDirectory, "mapa-parque.snapshot.json"), "utf8"),
    ) as { partners?: Array<{ id?: unknown; name?: unknown }> };
    const key = normalizedPartnerKey(partnerName);
    const match = snapshot.partners?.find(
      (partner) => normalizedPartnerKey(String(partner.name ?? "")) === key,
    );
    if (typeof match?.id === "string" && match.id) {
      return { id: match.id, name: String(match.name ?? partnerName) };
    }
  } catch {
    // The QSC can still be stored by its normalized partner name before Mapa Parque is available.
  }
  return { id: partnerSlug(partnerName) || "parceiro-nao-informado", name: partnerName };
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
let qscProcessingTimer: ReturnType<typeof setTimeout> | null = null;

const QSC_PROCESSING_DELAY_MS = 30_000;
const QSC_UPLOAD_ACTIVITY_DELAY_MS = 2 * 60_000;

async function listQscInputs(qscDirectory: string) {
  const storedFiles = await readdir(qscDirectory, { withFileTypes: true });
  const qscFiles = storedFiles
    .filter((entry) => entry.isFile())
    .map((entry) => path.join(qscDirectory, entry.name));
  const partnersDirectory = path.join(qscDirectory, "partners");
  if (await exists(partnersDirectory)) {
    const partnerEntries = await readdir(partnersDirectory, { withFileTypes: true });
    for (const partnerEntry of partnerEntries.filter((entry) => entry.isDirectory())) {
      const partnerDirectory = path.join(partnersDirectory, partnerEntry.name);
      const partnerFiles = await readdir(partnerDirectory, { withFileTypes: true });
      qscFiles.push(
        ...partnerFiles
          .filter((entry) => entry.isFile())
          .map((entry) => path.join(partnerDirectory, entry.name)),
      );
    }
  }
  const domains = ["carteira", "fixa", "movel"];
  const inputs = domains.flatMap((domain) =>
    qscFiles
      .filter((filePath) =>
        new RegExp(`^qsc-${domain}(?:-[a-z0-9-]+)?\\.csv$`, "i").test(path.basename(filePath)),
      )
      .sort()
      .map((filePath) => `${domain}:${filePath}`),
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
    recordImport: false,
  });
}

function startQscProcessing() {
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

function armQscProcessing(delayMs: number) {
  if (!latestQscContext || qscProcessingPromise) return;
  if (qscProcessingTimer) clearTimeout(qscProcessingTimer);
  qscProcessingTimer = setTimeout(() => {
    qscProcessingTimer = null;
    startQscProcessing();
  }, delayMs);
}

function noteQscUploadActivity() {
  if (latestQscContext) armQscProcessing(QSC_UPLOAD_ACTIVITY_DELAY_MS);
}

function scheduleQscProcessing(context: QscProcessingContext) {
  latestQscContext = context;
  qscReprocessRequested = true;
  armQscProcessing(QSC_PROCESSING_DELAY_MS);
}

export const Route = createFileRoute("/api/data/upload")({
  server: {
    handlers: {
      GET: async () => {
        const user = await readAuthUser();
        if (!user) {
          return Response.json({ message: "Acesso não autorizado." }, { status: 403 });
        }
        return Response.json(
          { uploads: listDataImports(10, user.role === "gn" ? user.email : undefined) },
          { headers: { "Cache-Control": "no-store" } },
        );
      },
      POST: async ({ request }) => {
        const user = await readAuthUser();
        const kind = request.headers.get("x-base-kind") ?? "";
        const isQsc = QSC_KINDS.includes(kind as (typeof QSC_KINDS)[number]);
        const isDirectorBase = DIRECTOR_KINDS.includes(kind as (typeof DIRECTOR_KINDS)[number]);
        const permitted =
          (user?.role === "director" && (isDirectorBase || isQsc)) ||
          (user?.role === "gn" && isQsc);
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
        const completedUploadPath = isChunked
          ? path.join(uploadDirectory, "chunks", `${uploadId}.complete.json`)
          : null;
        const importedResponse = async (payload: Record<string, unknown>) => {
          if (completedUploadPath) {
            await mkdir(path.dirname(completedUploadPath), { recursive: true });
            await writeFile(completedUploadPath, JSON.stringify(payload), "utf8");
          }
          return Response.json(payload, { headers: { "Cache-Control": "no-store" } });
        };

        if (completedUploadPath && (await exists(completedUploadPath))) {
          try {
            const payload = JSON.parse(await readFile(completedUploadPath, "utf8")) as Record<
              string,
              unknown
            >;
            return Response.json(payload, { headers: { "Cache-Control": "no-store" } });
          } catch {
            await rm(completedUploadPath, { force: true });
          }
        }
        if (isQsc) noteQscUploadActivity();

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
            return importedResponse({
              imported: true,
              processed: true,
              result: JSON.parse(stdout),
            });
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
            return importedResponse({
              imported: true,
              processed: true,
              result: JSON.parse(stdout),
            });
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
            return importedResponse({
              imported: true,
              processed: true,
              result: JSON.parse(stdout),
            });
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
            return importedResponse({
              imported: true,
              processed: true,
              result: JSON.parse(stdout),
            });
          }

          const qscDirectory = path.join(uploadDirectory, "qsc");
          await mkdir(qscDirectory, { recursive: true });
          const qscDomain = {
            "QSC Carteira": "carteira",
            "QSC Fixa": "fixa",
            "QSC Móvel": "movel",
          }[kind];
          const semester = qscSemesterSlot(originalName);
          const sourcePartnerName = await qscPartnerName(uploadedPath);
          const sourcePartner = await canonicalQscPartner(sourcePartnerName, snapshotDirectory);
          if (user?.role === "gn" && !user.partnerIds.includes(sourcePartner.id)) {
            return Response.json(
              {
                message: `O parceiro ${sourcePartner.name} não está vinculado ao seu perfil de acesso.`,
              },
              { status: 403 },
            );
          }
          const storagePartnerId =
            partnerSlug(sourcePartner.id) ||
            partnerSlug(sourcePartner.name) ||
            "parceiro-nao-informado";
          const partnerDirectory = path.join(qscDirectory, "partners", storagePartnerId);
          await mkdir(partnerDirectory, { recursive: true });
          const qscFileName = `qsc-${qscDomain}-${semester}.csv`;
          const finalPath = path.join(partnerDirectory, qscFileName);
          await rm(finalPath, { force: true });
          await rename(uploadedPath, finalPath);

          const legacyFileName = `qsc-${qscDomain}${semester === "h2" ? "-h2" : ""}.csv`;
          const legacyPath = path.join(qscDirectory, legacyFileName);
          if (await exists(legacyPath)) {
            try {
              const legacyPartnerName = await qscPartnerName(legacyPath);
              const legacyPartner = await canonicalQscPartner(legacyPartnerName, snapshotDirectory);
              if (legacyPartner.id === sourcePartner.id) await rm(legacyPath, { force: true });
            } catch (error) {
              console.warn("Não foi possível migrar a base QSC legada.", error);
            }
          }

          recordDataImportSuccess({
            kind,
            sourceName: originalName,
            uploadedBy: user?.email,
            sizeBytes: declaredFileSize || contentLength,
            message: "Arquivo recebido; processamento QSC agendado.",
          });

          const { available } = await listQscInputs(qscDirectory);
          scheduleQscProcessing({
            qscDirectory,
            snapshotDirectory,
            sourceName: originalName,
            uploadedBy: user?.email,
            sizeBytes: declaredFileSize || contentLength,
          });
          return importedResponse({
            imported: true,
            processed: false,
            processing: true,
            available: QSC_KINDS.filter((_, index) => available[index]),
            awaiting: QSC_KINDS.filter((_, index) => !available[index]),
          });
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
