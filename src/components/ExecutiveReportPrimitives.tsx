import { type ReactNode } from "react";
import { useReportPagination } from "./ExecutiveReportDocument";

export function ReportPage({
  title,
  eyebrow,
  partner,
  date,
  children,
}: {
  title: string;
  eyebrow: string;
  partner: string;
  date: string;
  children: ReactNode;
}) {
  const { page, totalPages } = useReportPagination();
  return (
    <article className="executive-report-page relative mx-auto scroll-mt-24 mb-6 flex min-h-[790px] max-w-[1120px] flex-col overflow-hidden rounded-[2rem] border border-violet-100 bg-[#fbf9ff] p-8 shadow-2xl">
      <div className="absolute -right-24 -top-24 size-72 rounded-full bg-sky-200/35 blur-3xl" />
      <div className="absolute -left-24 top-20 size-64 rounded-full bg-fuchsia-200/25 blur-3xl" />
      <header className="relative mb-5 flex flex-wrap items-start justify-between gap-3 border-b border-violet-100 pb-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-violet-700">
            {eyebrow}
          </p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">{title}</h1>
        </div>
        <div className="text-right">
          <p className="text-xs font-semibold text-slate-800">{partner}</p>
          <p className="mt-1 text-[10px] text-slate-500">Relatório executivo · {date}</p>
        </div>
      </header>
      <div className="relative flex-1">{children}</div>
      <footer className="relative mt-4 flex items-center justify-between border-t border-violet-100 pt-3 text-[9px] text-slate-400">
        <span>Visão Carteira · resumo para tomada de decisão</span>
        <span>
          Página {page} de {totalPages}
        </span>
      </footer>
    </article>
  );
}

export function SectionTitle({
  icon,
  eyebrow,
  title,
}: {
  icon: ReactNode;
  eyebrow: string;
  title: string;
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="grid size-9 place-items-center rounded-xl bg-violet-100 text-violet-700">
        {icon}
      </span>
      <div>
        <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-violet-700">
          {eyebrow}
        </p>
        <h2 className="text-base font-semibold text-slate-950">{title}</h2>
      </div>
    </div>
  );
}

export function MetricCard({
  label,
  value,
  inverse = false,
  accent = "default",
  details,
}: {
  label: string;
  value: string;
  inverse?: boolean;
  accent?: "default" | "violet" | "emerald";
  details?: { label: string; value: string }[];
}) {
  const color = inverse
    ? "border-white/15 bg-white/10 text-white"
    : accent === "emerald"
      ? "border-emerald-100 bg-emerald-50 text-emerald-800"
      : accent === "violet"
        ? "border-violet-100 bg-violet-50 text-violet-800"
        : "border-slate-200 bg-white text-slate-950";
  return (
    <div className={`rounded-[1.1rem] border p-3 ${color}`}>
      <p
        className={`text-[9px] font-bold uppercase tracking-[0.12em] ${inverse ? "text-violet-100" : "text-slate-500"}`}
      >
        {label}
      </p>
      <strong className="mt-1 block text-lg tabular-nums">{value}</strong>
      {details?.length ? (
        <dl className="mt-2 space-y-0.5 border-t border-current/15 pt-2 text-[10px] leading-4">
          {details.map((detail) => (
            <div key={detail.label} className="flex items-baseline justify-between gap-2">
              <dt className="font-semibold uppercase tracking-[0.08em] text-slate-500">
                {detail.label}
              </dt>
              <dd className="font-semibold tabular-nums">{detail.value}</dd>
            </div>
          ))}
        </dl>
      ) : null}
    </div>
  );
}

export function HeroMetric({
  label,
  value,
  tone = "brand",
}: {
  label: string;
  value: string;
  tone?: "brand" | "sky" | "violet";
}) {
  const style =
    tone === "brand"
      ? "from-violet-900 to-fuchsia-600 text-white"
      : tone === "sky"
        ? "from-white to-sky-100 text-slate-950"
        : "from-white to-violet-100 text-slate-950";
  return (
    <div
      className={`rounded-[1.4rem] border border-violet-100 bg-gradient-to-br p-5 shadow-sm ${style}`}
    >
      <p
        className={`text-[9px] font-bold uppercase tracking-[0.14em] ${tone === "brand" ? "text-violet-100" : "text-slate-500"}`}
      >
        {label}
      </p>
      <strong className="mt-3 block text-3xl tracking-tight tabular-nums">{value}</strong>
    </div>
  );
}

export function LargeSummary({
  label,
  value,
  tone = "sky",
}: {
  label: string;
  value: string;
  tone?: "sky" | "violet";
}) {
  return (
    <div
      className={`rounded-[1.5rem] border p-5 shadow-sm ${tone === "violet" ? "border-violet-100 bg-gradient-to-br from-white to-violet-100" : "border-sky-100 bg-gradient-to-br from-white to-sky-100"}`}
    >
      <p className="text-[9px] font-bold uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <strong className="mt-3 block text-3xl tracking-tight tabular-nums text-slate-950">
        {value}
      </strong>
    </div>
  );
}

export function CompactTable({
  headers,
  rows,
  total,
  empty = "Nenhum dado disponível.",
  dense = false,
}: {
  headers: string[];
  rows: string[][];
  total?: string[];
  empty?: string;
  /** Menos respiro vertical, para juntar mais de uma tabela na mesma folha. */
  dense?: boolean;
}) {
  const pad = dense ? "py-1.5" : "py-2";
  return (
    <div
      className={`report-table ${dense ? "mt-2" : "mt-4"} overflow-x-auto rounded-md border border-slate-200`}
    >
      <table
        className={`w-full table-fixed border-collapse bg-white text-[10px] ${headers.length > 6 ? "min-w-[760px]" : "min-w-[440px]"}`}
      >
        <colgroup>
          <col style={{ width: headers.length > 6 ? "26%" : "42%" }} />
          {headers.slice(1).map((_, index) => (
            <col key={index} />
          ))}
        </colgroup>
        <thead className="bg-slate-50 text-slate-500">
          <tr>
            {headers.map((header, index) => (
              <th
                key={`${header}-${index}`}
                className={`break-words px-2 ${pad} font-bold uppercase tracking-[0.08em] ${index ? "text-right" : "text-left"}`}
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length ? (
            rows.map((row, rowIndex) => (
              <tr key={rowIndex} className="border-t border-slate-100">
                {headers.map((_, index) => (
                  <td
                    key={index}
                    className={`break-words px-2 ${pad} font-medium tabular-nums text-slate-700 ${index ? "text-right" : "text-left font-semibold text-slate-900"}`}
                  >
                    {row[index] ?? "—"}
                  </td>
                ))}
              </tr>
            ))
          ) : (
            <tr className="border-t border-slate-100">
              <td colSpan={headers.length} className="px-3 py-6 text-center text-slate-500">
                {empty}
              </td>
            </tr>
          )}
          {total && (
            <tr className="border-t-2 border-violet-100 bg-violet-50/70">
              {headers.map((_, index) => (
                <td
                  key={index}
                  className={`break-words px-2 ${pad} font-bold tabular-nums text-slate-900 ${index ? "text-right" : "text-left"}`}
                >
                  {total[index] ?? "—"}
                </td>
              ))}
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
