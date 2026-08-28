import { useEffect, useMemo, useRef, useState, type ChangeEvent, type DragEvent } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import {
  ArrowRight,
  CheckCircle2,
  FileSpreadsheet,
  LoaderCircle,
  ShieldCheck,
  Sparkles,
  UploadCloud,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { DashboardLayout } from "@/layouts/DashboardLayout";
import { readXlsxRows } from "@/lib/xlsx-reader";

type FileKind =
  | "Mapa Parque"
  | "Resultados YoY"
  | "QSC Carteira"
  | "QSC Fixa"
  | "QSC Móvel"
  | "Portabilidade analítica"
  | "Best Guess"
  | "Torres de serviço"
  | "Base não reconhecida";

type SelectedFile = {
  id: string;
  name: string;
  size: number;
  extension: string;
  kind: FileKind | "Identificando…";
  status: "reading" | "ready" | "uploading" | "imported" | "error";
  error?: string;
  source: File;
};

type UploadRole = "gn" | "director";

const MAX_FILE_SIZE = 500 * 1024 * 1024;
const UPLOAD_CHUNK_SIZE = 20 * 1024 * 1024;
const QSC_KINDS = ["QSC Carteira", "QSC Fixa", "QSC Móvel"] as const;

const EXPECTED_BASES = [
  {
    number: "01",
    title: "Mapa Parque",
    description: "Base de carteira e oportunidades",
  },
  {
    number: "02",
    title: "Resultados YoY",
    description: "Metas, realizado e comparativo anual",
  },
  {
    number: "03",
    title: "Best Guess",
    description: "M0 MTD, projeção de fechamento e saldo por parceiro",
  },
  {
    number: "04",
    title: "Portabilidade analítica",
    description: "Port-In, Port-Out, saldo, operadora e evolução mensal",
  },
  {
    number: "05",
    title: "Torres de serviço",
    description: "Forecast, esteira, ativado e melhor estimativa por torre",
  },
  {
    number: "06",
    title: "QSC Carteira",
    description: "Indicadores de qualidade da carteira",
  },
  {
    number: "07",
    title: "QSC Fixa",
    description: "Indicadores de qualidade banda larga",
  },
  {
    number: "08",
    title: "QSC Móvel",
    description: "Indicadores de qualidade móvel",
  },
] as const;

const formatFileSize = (bytes: number) =>
  bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

const formatExtension = (name: string) => name.split(".").pop()?.toUpperCase() ?? "ARQ";

function normalizeHeader(value: unknown) {
  return String(value ?? "")
    .toLocaleUpperCase("pt-BR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Z0-9]/g, "");
}

function parseCsvSample(text: string) {
  const delimiter = (text.match(/;/g)?.length ?? 0) > (text.match(/,/g)?.length ?? 0) ? ";" : ",";
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (const character of text) {
    if (character === '"') {
      quoted = !quoted;
    } else if (character === delimiter && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((character === "\n" || character === "\r") && !quoted) {
      if (character === "\r") continue;
      row.push(cell);
      if (row.some((value) => value.trim())) rows.push(row);
      row = [];
      cell = "";
    } else {
      cell += character;
    }
    if (rows.length >= 25) break;
  }
  if (row.length || cell) {
    row.push(cell);
    rows.push(row);
  }
  return rows;
}

function headersFromRows(rows: unknown[][]) {
  return rows
    .slice(0, 25)
    .map((row) => new Set(row.map(normalizeHeader)))
    .filter((headers) => headers.size > 0);
}

function hasHeaders(headers: Set<string>, required: string[]) {
  return required.every((header) => headers.has(header));
}

function identifyByFileName(fileName: string): Exclude<FileKind, "Base não reconhecida"> | null {
  const name = normalizeHeader(fileName.replace(/\.[^.]+$/, ""));
  if (name.includes("MAPAPARQUE")) return "Mapa Parque";
  if (name.includes("RESULTADO") && name.includes("YOY")) return "Resultados YoY";
  if (name.includes("BESTGUESS")) return "Best Guess";
  if (name.includes("TORRE") || name.includes("ALTASMOVEL")) return "Torres de serviço";
  if (name.includes("PORTABILIDADE") || name.startsWith("ANALITICO")) {
    return "Portabilidade analítica";
  }
  if (name.includes("QSC")) {
    if (name.includes("FIXA")) return "QSC Fixa";
    if (name.includes("MOVEL")) return "QSC Móvel";
    if (name.includes("CARTEIRA")) return "QSC Carteira";
  }
  return null;
}

function identifyQscByContent(
  rows: unknown[][],
): Extract<FileKind, "QSC Carteira" | "QSC Fixa" | "QSC Móvel"> | null {
  const headerIndex = rows
    .slice(0, 25)
    .findIndex((row) => row.some((value) => normalizeHeader(value) === "INDICADOR"));
  if (headerIndex < 0) return null;

  const indicatorColumn = rows[headerIndex].findIndex(
    (value) => normalizeHeader(value) === "INDICADOR",
  );
  const indicators = rows
    .slice(headerIndex + 1, headerIndex + 251)
    .map((row) => normalizeHeader(row[indicatorColumn]))
    .filter(Boolean);

  if (indicators.some((value) => value.includes("QSCCARTEIRA"))) return "QSC Carteira";
  if (indicators.some((value) => value.includes("QSCFIXA"))) return "QSC Fixa";
  if (indicators.some((value) => value.includes("QSCMOVEL"))) return "QSC Móvel";
  return null;
}

async function identifySpreadsheet(file: File): Promise<FileKind> {
  const extension = formatExtension(file.name);
  const normalizedName = normalizeHeader(file.name);
  const identifiedByName = identifyByFileName(file.name);
  if (identifiedByName) return identifiedByName;

  const rows =
    extension === "CSV"
      ? parseCsvSample(await file.slice(0, 1_500_000).text())
      : await readXlsxRows(file);
  const headers = headersFromRows(rows);
  const firstMatching = (required: string[]) => headers.some((row) => hasHeaders(row, required));
  const combinedHeaders = new Set(headers.flatMap((row) => [...row]));
  const sampleMatching = (required: string[]) => hasHeaders(combinedHeaders, required);
  const matches = (required: string[]) => firstMatching(required) || sampleMatching(required);

  if (matches(["NRCNPJ", "TPPRODUTO"]) || matches(["NRCNPJ", "SITUACAORECEITA", "RECMOVEL"]))
    return "Mapa Parque";
  if (matches(["NOMEREDE", "META", "REAL"]) || matches(["PRODUTO", "META", "REAL"])) {
    return "Resultados YoY";
  }
  if (matches(["INDICADOR", "SUBINDICADOR", "TIPOMOVIMENTO", "QUANTIDADE"])) {
    if (normalizedName.includes("FIXA")) return "QSC Fixa";
    if (normalizedName.includes("MOVEL")) return "QSC Móvel";
    if (normalizedName.includes("CARTEIRA")) return "QSC Carteira";
    const identifiedQsc = identifyQscByContent(rows);
    if (identifiedQsc) return identifiedQsc;
    throw new Error("A coluna INDICADOR não informa se o QSC é Carteira, Fixa ou Móvel.");
  }
  if (
    matches(["GRUPOECONOMICO", "ANOMESAGENDAMENTO", "TIPOPORTABILIDADE", "PORTINFM", "PORTOUTFM"])
  )
    return "Portabilidade analítica";
  if (matches(["PARCEIRO", "M0MTDPORTIN", "M0MTDPORTOUT", "BGFMPORTIN", "BGFMPORTOUT"]))
    return "Best Guess";
  if (matches(["NMREDE", "FORECAST", "ESTEIRA"]) && combinedHeaders.has("ALTASMOVEL"))
    return "Torres de serviço";
  throw new Error("Cabeçalhos não correspondem a uma base conhecida.");
}

async function readUploadPayload(response: Response) {
  const body = await response.text();
  if (!body) return {} as { message?: string };
  try {
    return JSON.parse(body) as { message?: string };
  } catch {
    if (!response.ok) {
      throw new Error(
        response.status === 413
          ? "O servidor recusou o tamanho do upload. Tente novamente; o envio em partes está habilitado."
          : `O servidor retornou um erro inesperado (${response.status}).`,
      );
    }
    return {} as { message?: string };
  }
}

async function uploadFileInChunks(selectedFile: SelectedFile) {
  const chunkCount = Math.ceil(selectedFile.source.size / UPLOAD_CHUNK_SIZE);
  const uploadId = crypto.randomUUID();
  for (let chunkIndex = 0; chunkIndex < chunkCount; chunkIndex += 1) {
    const start = chunkIndex * UPLOAD_CHUNK_SIZE;
    const chunk = selectedFile.source.slice(start, Math.min(start + UPLOAD_CHUNK_SIZE, selectedFile.source.size));
    const response = await fetch("/api/data/upload", {
      method: "POST",
      headers: {
        "Content-Type": "application/octet-stream",
        "X-Base-Kind": selectedFile.kind,
        "X-File-Name": encodeURIComponent(selectedFile.name),
        "X-Upload-Id": uploadId,
        "X-Chunk-Index": String(chunkIndex),
        "X-Chunk-Count": String(chunkCount),
        "X-File-Size": String(selectedFile.source.size),
      },
      body: chunk,
    });
    const payload = await readUploadPayload(response);
    if (!response.ok) throw new Error(payload.message ?? "Não foi possível importar a base.");
  }
}

export const Route = createFileRoute("/alimentacao")({
  head: () => ({ meta: [{ title: "Alimentar dados — Mapa Parque" }] }),
  component: AlimentacaoPage,
});

function AlimentacaoPage() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<SelectedFile[]>([]);
  const [dragging, setDragging] = useState(false);
  const [role, setRole] = useState<UploadRole | null>(null);
  const roleRef = useRef<UploadRole | null>(null);
  const [batchImporting, setBatchImporting] = useState(false);
  useEffect(() => {
    void fetch("/api/auth/session", { cache: "no-store" })
      .then((response) => response.json())
      .then((payload: { user?: { role?: UploadRole } }) => {
        const nextRole = payload.user?.role ?? null;
        roleRef.current = nextRole;
        setRole(nextRole);
      })
      .catch(() => {
        roleRef.current = null;
        setRole(null);
      });
  }, []);
  const permittedTitles = useMemo(
    () =>
      new Set<FileKind>(
        role === "gn"
          ? ["QSC Carteira", "QSC Fixa", "QSC Móvel"]
          : role === "director"
            ? ["Mapa Parque", "Resultados YoY", "Best Guess", "Portabilidade analítica", "Torres de serviço"]
            : [],
      ),
    [role],
  );
  const permittedBases = EXPECTED_BASES.filter((base) => permittedTitles.has(base.title));
  const identifiedKinds = new Set(
    files.filter((file) => file.status === "ready").map((file) => file.kind),
  );
  const matchedBaseCount = permittedBases.filter((base) => identifiedKinds.has(base.title)).length;

  const addFiles = async (incoming: FileList | File[]) => {
    if (!roleRef.current) {
      toast.error("Permissões ainda não estão disponíveis", {
        description: "Aguarde um instante e selecione os arquivos novamente.",
      });
      return;
    }
    const accepted = Array.from(incoming).filter(
      (file) => /\.(xlsx?|csv)$/i.test(file.name) && file.size <= MAX_FILE_SIZE,
    );
    const next = accepted.map((file) => ({
      id: `${file.name}-${file.lastModified}-${file.size}`,
      name: file.name,
      size: file.size,
      extension: formatExtension(file.name),
      kind: "Identificando…" as const,
      status: "reading" as const,
      source: file,
    }));
    setFiles((current) => {
      return [...current, ...next.filter((file) => !current.some((item) => item.id === file.id))];
    });
    await Promise.all(
      accepted.map(async (file) => {
        const id = `${file.name}-${file.lastModified}-${file.size}`;
        try {
          const kind = await identifySpreadsheet(file);
          if (!permittedTitles.has(kind)) {
            setFiles((current) =>
              current.map((item) =>
                item.id === id
                  ? { ...item, kind, status: "error", error: "Sem permissão para esta base." }
                  : item,
              ),
            );
            return;
          }
          setFiles((current) =>
            current.map((item) => (item.id === id ? { ...item, kind, status: "ready" } : item)),
          );
        } catch (error) {
          const detail = error instanceof Error ? error.message : "Cabeçalhos incompatíveis.";
          setFiles((current) =>
            current.map((item) =>
              item.id === id
                ? {
                    ...item,
                    kind: "Base não reconhecida",
                    status: "error",
                    error: `Base não reconhecida: ${detail}`,
                  }
                : item,
            ),
          );
        }
      }),
    );
  };

  const handleChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files) void addFiles(event.target.files);
    event.target.value = "";
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    void addFiles(event.dataTransfer.files);
  };

  const importFile = async (
    selectedFile: SelectedFile,
    failureMessage: string,
    notifySuccess = true,
  ) => {
    setFiles((current) =>
      current.map((item) =>
        item.id === selectedFile.id ? { ...item, status: "uploading", error: undefined } : item,
      ),
    );
    try {
      await uploadFileInChunks(selectedFile);
      setFiles((current) =>
        current.map((item) =>
          item.id === selectedFile.id ? { ...item, status: "imported" } : item,
        ),
      );
      if (notifySuccess) {
        toast.success("Upload concluído com sucesso", {
          description: `${selectedFile.name} já está disponível nas visões do painel.`,
        });
      }
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : failureMessage;
      setFiles((current) =>
        current.map((item) =>
          item.id === selectedFile.id ? { ...item, status: "error", error: message } : item,
        ),
      );
      return false;
    }
  };

  const isImportable = (file: SelectedFile) =>
    file.status === "ready" &&
    (role === "director"
      ? file.kind !== "Base não reconhecida"
      : role === "gn"
        ? QSC_KINDS.includes(file.kind as (typeof QSC_KINDS)[number])
        : false);

  const importReadyFiles = async () => {
    const queuedFiles = files.filter(isImportable);
    if (queuedFiles.length === 0) return;

    setBatchImporting(true);
    let completed = 0;
    for (const file of queuedFiles) {
      const imported = await importFile(
        file,
        role === "gn" ? "Falha ao importar o QSC." : "Falha ao importar a base.",
        false,
      );
      if (imported) completed += 1;
    }
    setBatchImporting(false);
    if (completed > 0) {
      toast.success("Upload concluído com sucesso", {
        description: `${completed} ${completed === 1 ? "arquivo foi importado" : "arquivos foram importados"} e já atualizam o painel.`,
      });
    }
  };

  return (
    <DashboardLayout title="Alimentar dados">
      <div className="space-y-6">
        <section className="relative overflow-hidden rounded-[2rem] border border-primary/15 bg-gradient-to-br from-primary/[0.16] via-card/95 to-cyan/[0.12] p-6 shadow-elevated sm:p-8">
          <div className="pointer-events-none absolute -left-16 -top-24 size-72 rounded-full bg-primary/20 blur-3xl" />
          <div className="pointer-events-none absolute -bottom-28 right-0 size-72 rounded-full bg-cyan/20 blur-3xl" />
          <div className="relative flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-2xl">
              <div className="mb-4 flex items-center gap-3">
                <span className="grid size-11 place-items-center rounded-2xl bg-gradient-brand text-primary-foreground shadow-elegant ring-4 ring-primary/10">
                  <UploadCloud className="size-5" />
                </span>
                <span className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
                  Central de alimentação
                </span>
              </div>
              <h1 className="bg-gradient-brand bg-clip-text text-3xl font-semibold tracking-tight text-transparent sm:text-4xl">
                Atualize suas bases em um só lugar.
              </h1>
              <p className="mt-3 text-sm leading-6 text-muted-foreground">
                Anexe todas as planilhas que alimentam o Mapa Parque. Os arquivos ficam organizados
                nesta área para uma atualização segura e concentrada.
              </p>
            </div>
            <div className="flex items-center gap-2 rounded-2xl border border-primary/15 bg-background/65 px-4 py-3 text-xs font-medium text-muted-foreground backdrop-blur-sm">
              <ShieldCheck className="size-4 text-emerald-600 dark:text-emerald-400" />
              Ambiente protegido
            </div>
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
          <Card className="overflow-hidden rounded-[2rem] border-primary/15 bg-card/85 shadow-elevated">
            <div className="border-b border-primary/10 bg-primary/[0.035] px-5 py-5 sm:px-7">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">
                Entrada de dados
              </p>
              <div className="mt-1 flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-xl font-semibold tracking-tight">Envie suas planilhas</h2>
                <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-primary/15 bg-background/70 px-3 py-1.5 text-[11px] font-medium text-muted-foreground">
                  <FileSpreadsheet className="size-3.5 text-primary" /> XLSX, XLS ou CSV
                </span>
              </div>
            </div>
            <div className="p-5 sm:p-7">
              <input
                ref={inputRef}
                type="file"
                accept=".xlsx,.xls,.csv"
                multiple
                className="sr-only"
                onChange={handleChange}
              />
              <div
                role="button"
                tabIndex={0}
                aria-label="Selecionar planilhas para upload"
                onClick={() => inputRef.current?.click()}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") inputRef.current?.click();
                }}
                onDragEnter={(event) => {
                  event.preventDefault();
                  setDragging(true);
                }}
                onDragOver={(event) => event.preventDefault()}
                onDragLeave={() => setDragging(false)}
                onDrop={handleDrop}
                className={`group grid min-h-[280px] cursor-pointer place-items-center rounded-3xl border border-dashed p-8 text-center transition ${dragging ? "border-primary bg-primary/[0.09]" : "border-primary/25 bg-primary/[0.025] hover:border-primary/50 hover:bg-primary/[0.06]"}`}
              >
                <div>
                  <div className="mx-auto grid size-16 place-items-center rounded-3xl bg-gradient-brand text-primary-foreground shadow-elevated transition group-hover:scale-105">
                    <UploadCloud className="size-7" />
                  </div>
                  <h3 className="mt-5 text-base font-semibold">Arraste os arquivos para cá</h3>
                  <p className="mt-1 text-sm text-muted-foreground">
                    ou selecione várias planilhas no computador
                  </p>
                  <Button type="button" className="mt-5 gap-2 rounded-2xl px-5 shadow-elevated">
                    Selecionar arquivos <ArrowRight className="size-4" />
                  </Button>
                  <p className="mt-4 text-[11px] text-muted-foreground">Até 500 MB por arquivo</p>
                </div>
              </div>

              {files.length > 0 && (
                <div className="mt-6" aria-live="polite">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <p className="text-sm font-semibold">Arquivos selecionados</p>
                      <p className="text-xs text-muted-foreground">
                        Os arquivos permanecem na fila até que todas as importações terminem.
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {files.some(isImportable) && (
                        <Button
                          type="button"
                          size="sm"
                          disabled={batchImporting}
                          className="gap-1.5 rounded-xl px-3 text-xs"
                          onClick={() => void importReadyFiles()}
                        >
                          {batchImporting ? (
                            <><LoaderCircle className="size-3.5 animate-spin" /> Importando…</>
                          ) : (
                            "Importar todos"
                          )}
                        </Button>
                      )}
                      <span className="rounded-full bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
                        {files.length} {files.length === 1 ? "arquivo" : "arquivos"}
                      </span>
                    </div>
                  </div>
                  <div className="space-y-2">
                    {files.map((file) => (
                      <div
                        key={file.id}
                        className="flex items-center gap-3 rounded-2xl border border-primary/10 bg-primary/[0.025] p-3"
                      >
                        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/[0.1] text-primary">
                          <FileSpreadsheet className="size-5" />
                        </span>
                        <span className="min-w-0 flex-1">
                          <strong className="block truncate text-sm font-semibold">
                            {file.name}
                          </strong>
                          <span className="text-xs text-muted-foreground">
                            <strong
                              className={
                                file.status === "error"
                                  ? "text-rose-600 dark:text-rose-400"
                                  : "text-primary"
                              }
                            >
                              {file.error ?? file.kind}
                            </strong>{" "}
                            · {file.extension} · {formatFileSize(file.size)}
                          </span>
                        </span>
                        {file.status === "reading" || file.status === "uploading" ? (
                          <LoaderCircle className="size-4 shrink-0 animate-spin text-primary" />
                        ) : file.status === "ready" || file.status === "imported" ? (
                          <CheckCircle2 className="size-4 shrink-0 text-emerald-500" />
                        ) : (
                          <X className="size-4 shrink-0 text-rose-500" />
                        )}
                        {isImportable(file) && (
                            <Button
                              type="button"
                              size="sm"
                              disabled={batchImporting}
                              className="shrink-0 rounded-xl px-3 text-xs"
                              onClick={() =>
                                void importFile(
                                  file,
                                  role === "gn"
                                    ? "Falha ao importar o QSC."
                                    : "Falha ao importar a base.",
                                )
                              }
                            >
                              Importar
                            </Button>
                          )}
                        <button
                          type="button"
                          aria-label={`Remover ${file.name}`}
                          onClick={() =>
                            setFiles((current) => current.filter((item) => item.id !== file.id))
                          }
                          className="grid size-8 shrink-0 place-items-center rounded-xl text-muted-foreground transition hover:bg-rose-500/10 hover:text-rose-600"
                        >
                          <X className="size-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Card>

          <div className="space-y-6">
            <Card className="rounded-[2rem] border-primary/15 bg-card/85 p-5 shadow-elevated sm:p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">
                    Checklist
                  </p>
                  <h2 className="mt-1 text-lg font-semibold tracking-tight">
                    Bases de arquivo esperadas
                  </h2>
                </div>
                <span className="rounded-full bg-primary/[0.08] px-3 py-1.5 text-xs font-semibold text-primary">
                  {matchedBaseCount}/{permittedBases.length} identificadas
                </span>
              </div>
              <div className="mt-5 space-y-1">
                {permittedBases.map((base) => {
                  const matched = identifiedKinds.has(base.title);
                  return (
                    <div
                      key={base.number}
                      className="flex items-center gap-3 border-b border-primary/[0.08] py-3 last:border-0"
                    >
                      <span className="grid size-8 shrink-0 place-items-center rounded-xl bg-primary/[0.08] text-xs font-semibold text-primary">
                        {base.number}
                      </span>
                      <span className="min-w-0 flex-1">
                        <strong className="block text-sm font-semibold">{base.title}</strong>
                        <span className="text-xs text-muted-foreground">{base.description}</span>
                      </span>
                      {matched ? (
                        <CheckCircle2
                          className="size-4 text-emerald-500"
                          aria-label="Identificado"
                        />
                      ) : (
                        <span
                          className="size-2 rounded-full bg-muted-foreground/25"
                          title="Aguardando arquivo"
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>
            <Card className="relative overflow-hidden rounded-[2rem] border-primary/15 bg-gradient-to-br from-violet-500/[0.12] via-card to-cyan/[0.08] p-5 shadow-elevated sm:p-6">
              <Sparkles className="absolute -right-2 -top-2 size-20 text-primary/10" />
              <p className="relative text-[10px] font-semibold uppercase tracking-[0.16em] text-primary">
                Fluxo recomendado
              </p>
              <h2 className="relative mt-1 text-lg font-semibold tracking-tight">
                Uma atualização, todas as visões.
              </h2>
              <p className="relative mt-2 text-sm leading-5 text-muted-foreground">
                Mantenha as bases nesta área para que os indicadores, oportunidades e certificações
                trabalhem com a mesma referência.
              </p>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
