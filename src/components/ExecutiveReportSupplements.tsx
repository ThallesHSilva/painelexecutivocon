import {
  invasaoDirectorateShares,
  invasaoHistoryFinance,
  invasaoYtdFinance,
  formatInvasaoCents,
  formatInvasaoShare,
  type InvasaoTickets,
} from "@/lib/invasao-finance";
import type { ReactNode } from "react";
import { ReportPage, MetricCard, CompactTable } from "./ExecutiveReportPrimitives";
import { fmtInt, fmtPct } from "@/lib/format";
import { reportChunks, invasaoReportSummary } from "@/lib/report-data";
import type { InvasaoSnapshot } from "@/lib/invasao";
import {
  calculateCertificationCycle,
  parseCertificationPreview,
  MONTH_FIELDS,
} from "@/lib/certification";
import { quartilRangeLabel } from "@/lib/quartil";
import type { fetchAdvanced, fetchLicenses } from "@/services/api";

type Meta = { partner: string; date: string };
export function ReportMessage({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-md border border-slate-200 bg-white p-5 text-sm leading-6 text-slate-600">
      {children}
    </p>
  );
}
function continuation(index: number, count: number) {
  return count > 1 ? ` · ${index + 1}/${count}` : "";
}
function monthLabel(month: string) {
  const [year, number] = month.split("-").map(Number);
  return year && number
    ? new Intl.DateTimeFormat("pt-BR", { month: "short", year: "numeric" }).format(
        new Date(year, number - 1, 1),
      )
    : "—";
}

export function invasaoReportPages(
  data: InvasaoSnapshot | undefined,
  meta: Meta,
  tickets: InvasaoTickets = {},
  ticketWarning: string | null = null,
) {
  if (!data)
    return [
      <ReportPage
        key="invasao-error"
        {...meta}
        title="Invasão de Carteira"
        eyebrow="Altas vendidas"
      >
        <ReportMessage>
          Dados de Invasão de Carteira indisponíveis. Os demais capítulos permanecem disponíveis.
        </ReportMessage>
      </ReportPage>,
    ];
  const summary = invasaoReportSummary(data);
  if (!summary.latestMonth)
    return [
      <ReportPage
        key="invasao-empty"
        {...meta}
        title="Invasão de Carteira"
        eyebrow="Altas vendidas"
      >
        <ReportMessage>
          Nenhuma base de Invasão de Carteira importada para este recorte. Ausência de base não
          representa zero vendas.
        </ReportMessage>
      </ReportPage>,
    ];
  const shares = invasaoDirectorateShares(summary.directorates);
  // Receita e total são calculados sobre o histórico inteiro e só depois paginados.
  const finance = invasaoHistoryFinance(summary.history, tickets);
  const ytdYear = summary.latestMonth.slice(0, 4);
  const ytd = invasaoYtdFinance(finance.rows, summary.latestMonth);
  const directorates = reportChunks(shares.rows, 12);
  const history = reportChunks(finance.rows, 12);
  return [
    ...directorates.map((rows, index) => (
      <ReportPage
        key={`invasao-${index}`}
        {...meta}
        title={`Invasão de Carteira${continuation(index, directorates.length)}`}
        eyebrow={`Mês de exercício · ${monthLabel(summary.latestMonth)}`}
      >
        <div className="grid grid-cols-2 gap-3">
          <MetricCard
            label="Altas Móvel"
            value={fmtInt(summary.monthTotal.altasMovel)}
            accent="violet"
            details={[
              { label: `YTD ${ytdYear} · Altas`, value: fmtInt(ytd.altasMovel) },
              {
                label: `YTD ${ytdYear} · Receita`,
                value: formatInvasaoCents(ytd.revenueMovelCents),
              },
            ]}
          />
          <MetricCard
            label="Altas FTTH"
            value={fmtInt(summary.monthTotal.altasFtth)}
            accent="violet"
            details={[
              { label: `YTD ${ytdYear} · Altas`, value: fmtInt(ytd.altasFtth) },
              {
                label: `YTD ${ytdYear} · Receita`,
                value: formatInvasaoCents(ytd.revenueFtthCents),
              },
            ]}
          />
        </div>
        <h2 className="mt-5 text-base font-semibold">Diretoria Habilitador</h2>
        <CompactTable
          headers={["Diretoria Habilitador", "Altas Móvel", "% Móvel", "Altas FTTH", "% FTTH"]}
          rows={rows.map((row) => [
            row.directorate,
            fmtInt(row.altasMovel),
            formatInvasaoShare(row.shareMovel),
            fmtInt(row.altasFtth),
            formatInvasaoShare(row.shareFtth),
          ])}
          total={
            index === directorates.length - 1
              ? [
                  "Total do mês",
                  fmtInt(shares.totalMovel),
                  formatInvasaoShare(shares.totalMovel ? 1 : null),
                  fmtInt(shares.totalFtth),
                  formatInvasaoShare(shares.totalFtth ? 1 : null),
                ]
              : undefined
          }
          empty="Base importada, sem altas de invasão neste mês."
        />
        <p className="mt-3 text-[10px] leading-4 text-slate-500">
          A participação usa o total de altas da respectiva modalidade no mês e recorte. YTD soma
          janeiro até o mês de exercício; a receita é estimada (ticket × altas) e aparece como “—”
          se algum mês com altas estiver sem ticket.
        </p>
        <p className="mt-4 text-[10px] leading-4 text-slate-500">
          Soma de Qtde. Ativação com Venda na Carteira = Altas Invasão. Móvel: MOVEL / VOZ MOVEL.
          FTTH: FIXA BASICA / BANDA LARGA. Mês: AnoMês. Parceiro: Grupo Rede Termo Carteira.
        </p>
      </ReportPage>
    )),
    ...history.map((rows, index) => (
      <ReportPage
        key={`invasao-history-${index}`}
        {...meta}
        title={`Histórico de altas${continuation(index, history.length)}`}
        eyebrow="Invasão de Carteira"
      >
        <p className="text-xs text-slate-600">
          Todos os meses importados do recorte, independentemente do último mês de exercício. Meses
          com base e sem altas ficam em zero.
        </p>
        {ticketWarning && <p className="mt-3 text-xs text-rose-700">{ticketWarning}</p>}
        <CompactTable
          headers={[
            "Mês de exercício",
            "Altas Móvel",
            "Ticket Móvel",
            "Receita Móvel",
            "Altas FTTH",
            "Ticket FTTH",
            "Receita FTTH",
          ]}
          rows={rows.map((row) => [
            monthLabel(row.month),
            fmtInt(row.altasMovel),
            formatInvasaoCents(row.ticketMovelCents),
            formatInvasaoCents(row.revenueMovelCents),
            fmtInt(row.altasFtth),
            formatInvasaoCents(row.ticketFtthCents),
            formatInvasaoCents(row.revenueFtthCents),
          ])}
          total={
            index === history.length - 1
              ? [
                  "Total no período",
                  fmtInt(finance.totalMovel),
                  "—",
                  formatInvasaoCents(finance.totalRevenueMovelCents),
                  fmtInt(finance.totalFtth),
                  "—",
                  formatInvasaoCents(finance.totalRevenueFtthCents),
                ]
              : undefined
          }
        />
        <p className="mt-3 text-[10px] leading-4 text-slate-500">
          Receitas estimadas a partir do ticket informado manualmente neste navegador para cada mês.
          Receita = ticket × altas; não é receita realizada da planilha. “—” indica ticket pendente
          ou valor inválido, e o total só aparece com todos os meses com altas preenchidos.
        </p>
      </ReportPage>
    )),
  ];
}

export function licensesReportPages(
  data: Awaited<ReturnType<typeof fetchLicenses>> | undefined,
  meta: Meta,
) {
  return [
    <ReportPage
      key="licenses"
      {...meta}
      title="Licenças e Serviços Digitais"
      eyebrow="Oportunidades · TI Recorrente"
    >
      {!data ? (
        <ReportMessage>
          Dados de Licenças e Serviços Digitais indisponíveis para este recorte.
        </ReportMessage>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-y-3 sm:grid-cols-4 print:grid-cols-4 gap-3">
            <MetricCard
              label="Oportunidades TI Recorrente"
              value={fmtInt(data.kpis.clientesElegiveis)}
              accent="violet"
            />
            <MetricCard
              label="Cross Segurança em Dados"
              value={fmtInt(data.kpis.segurancaEmDados)}
            />
            <MetricCard
              label="Google com pré-aprovação"
              value={fmtInt(data.kpis.googleComCredito)}
            />
            <MetricCard
              label="Microsoft 365 com pré-aprovação"
              value={fmtInt(data.kpis.microsoft365ComCredito)}
            />
          </div>
          <p className="mt-4 text-[10px] leading-4 text-slate-500">
            Participação na base ativa: {fmtPct(data.kpis.percentualBase)}. Públicos podem se
            sobrepor; a oportunidade total usa os CNPJs elegíveis da tela, não a soma dos três
            públicos. Cenários de conversão e receita simulada não compõem os resultados deste
            relatório.
          </p>
        </>
      )}
    </ReportPage>,
  ];
}

export function advancedReportPages(
  data: Awaited<ReturnType<typeof fetchAdvanced>> | undefined,
  meta: Meta,
) {
  return [
    <ReportPage
      key="advanced"
      {...meta}
      title="Oportunidade Avançada"
      eyebrow="Oportunidades · Conectividade e Vivo Tech"
    >
      {!data ? (
        <ReportMessage>
          Dados de Oportunidade Avançada indisponíveis para este recorte.
        </ReportMessage>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-y-3 sm:grid-cols-5 print:grid-cols-5 gap-3">
            <MetricCard
              label="Oportunidade Avançada"
              value={fmtInt(data.kpis.opportunities)}
              accent="violet"
            />
            <MetricCard label="Renovação de Avançada" value={fmtInt(data.kpis.renewal)} />
            <MetricCard label="% da base total" value={fmtPct(data.kpis.percentualBase)} />
            <MetricCard label="Oportunidade Vivo Tech" value={fmtInt(data.kpis.vivoTech)} />
            <MetricCard label="Posse · Empresas" value={fmtInt(data.kpis.posse)} />
          </div>
          <p className="mt-4 text-[10px] leading-4 text-slate-500">
            Mesmo recorte e regras da tela: base ativa com aquisição, adesão ou winback em
            AVANCADOS; renovação apurada separadamente. Simulações comerciais não são vendas
            realizadas.
          </p>
        </>
      )}
    </ReportPage>,
  ];
}

export function certificationReportPages(
  payload: unknown,
  updatedAt: string | undefined,
  state: "individual" | "selection" | "error",
  meta: Meta,
) {
  const parsed = parseCertificationPreview(payload);
  if (state !== "individual" || !parsed)
    return [
      <ReportPage
        key="certification-empty"
        {...meta}
        title="Certificação"
        eyebrow="2º ciclo · Simulação salva por PV"
      >
        <ReportMessage>
          {state === "selection"
            ? "A Certificação é individual por PV. Selecione um único parceiro para incluir a sua simulação salva; pontuações e pedras não são consolidadas entre parceiros."
            : state === "error"
              ? "Não foi possível carregar a simulação salva deste PV."
              : payload == null
                ? "Este PV ainda não possui simulação salva. Nenhum valor de exemplo do ciclo fechado foi incluído."
                : "A simulação salva tem formato inválido e não pode ser incluída com segurança."}
        </ReportMessage>
      </ReportPage>,
    ];
  const cycle = calculateCertificationCycle(parsed);
  const rows = [
    cycle.summary,
    cycle.oneShot,
    cycle.ftthPhysical,
    cycle.newProductsRevenue,
    cycle.revenuePerFdv,
    ...cycle.qscRows,
  ];
  const headers = [
    "Indicador",
    "Jul",
    "Ago",
    "Set",
    "Out",
    "Nov",
    "Dez",
    "Totalizador",
    "Pts",
    "Faixa",
  ];
  const cells = (row: (typeof rows)[number]) => [
    row.indicator,
    ...MONTH_FIELDS.map((field) => row[field] || "—"),
    row.totalizer || "—",
    row.points || "—",
    row.band || "—",
  ];
  // Resumo e composição da receita cabem juntos em uma única folha.
  return [
    <ReportPage
      key="certification"
      {...meta}
      title="Certificação · Simulação salva"
      eyebrow="2º ciclo · Julho a dezembro"
    >
      <div className="grid grid-cols-3 gap-3">
        <MetricCard label="Pontuação simulada" value={fmtInt(cycle.totalPoints)} accent="violet" />
        <MetricCard label="Pedra simulada" value={cycle.stone.stone} accent="violet" />
        <MetricCard label="Bônus simulado" value={cycle.stone.bonus} accent="violet" />
      </div>
      <h2 className="mt-4 text-sm font-semibold text-slate-950">Resumo do ciclo</h2>
      <CompactTable dense headers={headers} rows={rows.map(cells)} />
      <h2 className="mt-4 text-sm font-semibold text-slate-950">Composição da receita</h2>
      <CompactTable
        dense
        headers={["Indicador", "Jul", "Ago", "Set", "Out", "Nov", "Dez", "Média"]}
        rows={cycle.breakdown.map((row) => [
          row.indicator,
          ...MONTH_FIELDS.map((field) => row[field] || "—"),
          row.totalizer || "—",
        ])}
      />
      <p className="mt-3 text-[10px] leading-4 text-slate-500">
        Prévia persistida {updatedAt ? `em ${new Date(updatedAt).toLocaleString("pt-BR")}` : ""}.
        Valores derivados recalculados pelas mesmas regras da tela. Não é certificação oficial nem o
        resultado fechado do 1º ciclo.
      </p>
    </ReportPage>,
  ];
}

export function QuartilRangesReportPage(meta: Meta) {
  return (
    <ReportPage {...meta} title="Faixas de cada quartil" eyebrow="Referência · Limites inclusivos">
      {(["experienced", "new"] as const).map((tenure) => (
        <section key={tenure} className="mb-6">
          <h2 className="text-base font-semibold">
            {tenure === "experienced" ? "Acima de 3 meses" : "Até 3 meses"}
          </h2>
          <CompactTable
            headers={["Quartil", "Receita", "Móvel", "FTTH"]}
            rows={[1, 2, 3, 4, 5].map((quartile) => [
              `Q${quartile}`,
              ...(["receita", "movel", "ftth"] as const).map((metric) =>
                quartilRangeLabel(metric, tenure, quartile),
              ),
            ])}
          />
        </section>
      ))}
      <p className="text-[10px] text-slate-500">
        Mesmos limites usados na tela e verificados contra a classificação da importação.
      </p>
    </ReportPage>
  );
}
