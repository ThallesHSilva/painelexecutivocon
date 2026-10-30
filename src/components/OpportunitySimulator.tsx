import { useEffect, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { EmptyState } from "@/components/EmptyState";
import { TableScroll } from "@/components/TableScroll";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { fmtBRL, fmtInt } from "@/lib/format";
import {
  DEFAULT_SIMULATOR_SETTINGS,
  readSavedSimulator,
  savePartnerSettings,
  simulateConversion,
  type OpportunityRow,
  type PartnerSimulatorSettings,
  type SavedSimulator,
  type SimulationEntry,
} from "@/lib/opportunity-simulation";
import { cn } from "@/lib/utils";

/**
 * Simulador de oportunidades (Etapa 4).
 *
 * Um único painel: parâmetros por parceiro no topo e, abaixo, as projeções de
 * Conversão e Qualificados. As duas tabelas compartilham a mesma borda de leitura da
 * Visão resultado — cabeçalho em superfície sutil, número à direita com `tabular-nums`,
 * identificação persistente na rolagem horizontal e totalizador por borda e peso.
 *
 * Cada parceiro tem os seus próprios parâmetros, gravados em `localStorage` (por
 * `storageKey`) no instante em que o campo é alterado. Parceiro ainda não preenchido
 * parte dos parâmetros globais salvos no formato anterior, ou dos padrões.
 */

type OpportunitySimulatorProps = {
  rows: OpportunityRow[];
  storageKey: string;
  simulatorLabel: string;
  opportunityLabel: string;
  quantityLabel: string;
  revenueLabel: string;
  /** Conversão (%) de quem ainda não tem parâmetros próprios. */
  defaultConversionRate?: number;
  /**
   * Adesão do conjunto: oportunidades e quantos clientes aderem quando cada parceiro
   * converte à sua própria taxa. Para páginas que projetam receita sobre a adesão.
   */
  onAdoptionChange?: (adoption: { oportunidades: number; adopters: number }) => void;
  /** Base ainda em carregamento: projeções em skeleton, nunca linha de zeros. */
  loading?: boolean;
};

type QualifiedEntry = {
  parceiro: string;
  cttMonth: number;
  cttWeek: number;
  cttDay: number;
  fdv: number;
};

export function OpportunitySimulator({
  rows,
  storageKey,
  simulatorLabel,
  opportunityLabel,
  quantityLabel,
  revenueLabel,
  defaultConversionRate,
  onAdoptionChange,
  loading = false,
}: OpportunitySimulatorProps) {
  const [saved, setSaved] = useState<SavedSimulator>(() => ({
    defaults: {
      ...DEFAULT_SIMULATOR_SETTINGS,
      conversionRate: defaultConversionRate ?? DEFAULT_SIMULATOR_SETTINGS.conversionRate,
    },
    partners: {},
  }));

  /** Lê o navegador ao montar (a renderização no servidor não tem `localStorage`). */
  useEffect(() => {
    setSaved(
      readSavedSimulator(storageKey, {
        ...DEFAULT_SIMULATOR_SETTINGS,
        conversionRate: defaultConversionRate ?? DEFAULT_SIMULATOR_SETTINGS.conversionRate,
      }),
    );
  }, [defaultConversionRate, storageKey]);

  const settingsFor = (parceiro: string): PartnerSimulatorSettings =>
    Object.hasOwn(saved.partners, parceiro) ? saved.partners[parceiro] : saved.defaults;

  /** Atualiza a tela e grava no navegador no mesmo instante em que o campo muda. */
  const changeSetting = (
    parceiro: string,
    field: keyof PartnerSimulatorSettings,
    value: number,
  ) => {
    const next = { ...settingsFor(parceiro), [field]: value };
    savePartnerSettings(storageKey, parceiro, next);
    setSaved((current) => ({ ...current, partners: { ...current.partners, [parceiro]: next } }));
  };

  const { simulation, total } = simulateConversion(rows, settingsFor);
  const qualified = simulation.map((partner) => {
    const { averageActivations } = settingsFor(partner.parceiro);
    return {
      ...partner,
      cttMonth: partner.conversions / 2,
      cttWeek: partner.conversions / 8,
      cttDay: partner.conversions / 40,
      fdv: averageActivations > 0 ? Math.ceil(partner.conversions / averageActivations) : 0,
    };
  });

  const totalOportunidades = total.oportunidades;
  const totalAdopters = rows.reduce(
    (sum, partner) =>
      sum + (partner.oportunidades * settingsFor(partner.parceiro).conversionRate) / 100,
    0,
  );
  useEffect(() => {
    onAdoptionChange?.({ oportunidades: totalOportunidades, adopters: totalAdopters });
  }, [onAdoptionChange, totalAdopters, totalOportunidades]);

  const qualifiedTotal = qualified.reduce(
    (result, partner) => ({
      cttMonth: result.cttMonth + partner.cttMonth,
      cttWeek: result.cttWeek + partner.cttWeek,
      cttDay: result.cttDay + partner.cttDay,
      fdv: result.fdv + partner.fdv,
    }),
    { cttMonth: 0, cttWeek: 0, cttDay: 0, fdv: 0 },
  );

  /**
   * Larguras dimensionadas pelo conteúdo. A coluna de receita comporta crédito alto
   * com separador de milhar por inteiro, sem corte e sem reduzir a fonte.
   */
  const conversionColumns: ResultColumn<SimulationEntry>[] = [
    {
      id: "oportunidades",
      label: opportunityLabel,
      width: "w-[152px]",
      format: (row) => fmtInt(row.oportunidades),
    },
    {
      id: "quantity",
      label: quantityLabel,
      width: "w-[124px]",
      format: (row) => fmtInt(row.quantity),
    },
    {
      id: "conversions",
      label: "Conversão",
      width: "w-[124px]",
      format: (row) => fmtInt(row.conversions),
    },
    { id: "capacity", label: "PDU", width: "w-[96px]", format: (row) => fmtInt(row.capacity) },
    {
      id: "revenue",
      label: revenueLabel,
      width: "w-[176px]",
      format: (row) => fmtBRL(row.revenue),
      emphasis: true,
    },
  ];

  const qualifiedColumns: ResultColumn<QualifiedEntry>[] = [
    { id: "cttMonth", label: "Ctt Mês", width: "w-[124px]", format: (row) => fmtInt(row.cttMonth) },
    { id: "cttWeek", label: "Ctt Sem", width: "w-[124px]", format: (row) => fmtInt(row.cttWeek) },
    { id: "cttDay", label: "Ctt Dia", width: "w-[124px]", format: (row) => fmtInt(row.cttDay) },
    {
      id: "fdv",
      label: "FDV",
      width: "w-[124px]",
      format: (row) => fmtInt(row.fdv),
      emphasis: true,
    },
  ];

  return (
    <Card className="mt-6 overflow-hidden">
      <div className="border-b border-border px-4 py-3.5 md:px-5">
        <h2 className="text-lg font-semibold leading-[1.45] tracking-tight text-foreground">
          {simulatorLabel}
        </h2>
        <p className="mt-1 max-w-3xl text-xs leading-5 text-muted-foreground">
          Cada parceiro tem os seus próprios parâmetros, que alimentam as duas projeções e são
          salvos neste navegador assim que preenchidos.
        </p>
      </div>

      {(loading || rows.length > 0) && (
        <ResultSection
          title="Parâmetros por parceiro"
          description="Preencha os campos de cada parceiro; a projeção é recalculada e o valor fica salvo na hora."
        >
          <ParametersTable
            rows={rows}
            loading={loading}
            quantityLabel={`${quantityLabel} por CNPJ`}
            settingsFor={settingsFor}
            onChange={changeSetting}
          />
        </ResultSection>
      )}

      <ResultSection
        title="Conversão"
        description="Volume, conversões, capacidade comercial e receita por parceiro."
        bordered
      >
        <ResultTable
          columns={conversionColumns}
          rows={simulation}
          total={{ parceiro: "Total", ...total }}
          minWidth="min-w-[892px]"
          detailLabel="Detalhe da conversão por parceiro"
          leadColumnId="revenue"
          loading={loading}
        />
      </ResultSection>

      <ResultSection
        title="Qualificados"
        description="Distribuição da conversão em contatos qualificados e FDV, dimensionado pela média de altas."
        bordered
      >
        <ResultTable
          columns={qualifiedColumns}
          rows={qualified}
          total={{ parceiro: "Total", ...qualifiedTotal }}
          minWidth="min-w-[716px]"
          detailLabel="Detalhe dos qualificados por parceiro"
          leadColumnId="fdv"
          loading={loading}
        />
      </ResultSection>
    </Card>
  );
}

type ParameterColumn = {
  field: keyof PartnerSimulatorSettings;
  label: string;
  min: number;
  max?: number;
  step: number;
};

/**
 * Tabela de parâmetros: uma linha por parceiro, um campo por parâmetro. O campo
 * tem borda e foco visíveis e o valor à direita em `tabular-nums`, como as tabelas de
 * resultado. Os controles nativos de incremento são ocultados porque cobririam o
 * próprio valor alinhado à direita; o passo continua acessível pelas setas do teclado.
 */
function ParametersTable({
  rows,
  loading,
  quantityLabel,
  settingsFor,
  onChange,
}: {
  rows: OpportunityRow[];
  loading: boolean;
  quantityLabel: string;
  settingsFor: (parceiro: string) => PartnerSimulatorSettings;
  onChange: (parceiro: string, field: keyof PartnerSimulatorSettings, value: number) => void;
}) {
  if (loading) {
    return (
      <div className="space-y-2" aria-hidden="true">
        <Skeleton className="h-10 w-full" />
        {[0, 1, 2].map((line) => (
          <Skeleton key={line} className="h-11 w-full" />
        ))}
      </div>
    );
  }
  const columns: ParameterColumn[] = [
    { field: "quantityPerCnpj", label: quantityLabel, min: 0, step: 1 },
    { field: "conversionRate", label: "Conversão (%)", min: 0, max: 100, step: 0.1 },
    { field: "capacityPerDay", label: "Dias úteis", min: 1, step: 1 },
    { field: "averageTicket", label: "Ticket médio (R$)", min: 0, step: 0.01 },
    { field: "averageActivations", label: "Média de altas", min: 1, step: 0.1 },
  ];

  return (
    <TableScroll>
      <Table className="min-w-[860px] table-fixed">
        <colgroup>
          <col className={STICKY_ID_WIDTH} />
          {columns.map((column) => (
            <col key={column.field} className="w-[132px]" />
          ))}
        </colgroup>
        <TableHeader className={TABLE_HEADER_CLASS}>
          <TableRow className="hover:bg-transparent">
            <TableHead className={cn(STICKY_ID_CLASS, "bg-muted")}>Parceiro</TableHead>
            {columns.map((column) => (
              <TableHead key={column.field} align="numeric">
                {column.label}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody className={TABLE_BODY_CLASS}>
          {rows.map((row) => {
            const settings = settingsFor(row.parceiro);
            return (
              <TableRow key={row.parceiro}>
                <TableCell className={cn(STICKY_ID_CLASS, "bg-card font-medium text-foreground")}>
                  {row.parceiro}
                </TableCell>
                {columns.map((column) => (
                  <TableCell key={column.field} align="numeric">
                    <Input
                      type="number"
                      aria-label={`${column.label} — ${row.parceiro}`}
                      min={column.min}
                      max={column.max}
                      step={column.step}
                      value={settings[column.field]}
                      onChange={(event) =>
                        onChange(
                          row.parceiro,
                          column.field,
                          Math.min(
                            column.max ?? Infinity,
                            Math.max(column.min, Number(event.target.value) || column.min),
                          ),
                        )
                      }
                      className="h-9 text-right font-medium tabular-nums [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                    />
                  </TableCell>
                ))}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </TableScroll>
  );
}

function ResultSection({
  title,
  description,
  bordered,
  children,
}: {
  title: string;
  description: string;
  bordered?: boolean;
  children: ReactNode;
}) {
  return (
    <section className={cn("px-4 py-4 md:px-5", bordered && "border-t border-border")}>
      <h3 className="text-[15px] font-semibold leading-[1.45] tracking-tight text-foreground">
        {title}
      </h3>
      <p className="mt-1 max-w-3xl text-xs leading-5 text-muted-foreground">{description}</p>
      <div className="mt-4">{children}</div>
    </section>
  );
}

type ResultColumn<Row> = {
  id: string;
  label: string;
  width: string;
  format: (row: Row) => string;
  /** Resultado final da tabela: peso maior, sem cor decorativa. */
  emphasis?: boolean;
};

const TABLE_HEADER_CLASS =
  "bg-muted [&_th]:h-auto [&_th]:border-b [&_th]:border-border [&_th]:px-3 [&_th]:py-2.5 [&_th]:align-bottom [&_th]:text-xs [&_th]:font-semibold [&_th]:leading-4 [&_th]:text-foreground";
const TABLE_BODY_CLASS =
  "[&_td]:whitespace-nowrap [&_td]:px-3 [&_td]:py-2.5 [&_tr]:border-border [&_tr:hover]:bg-transparent";
const TABLE_TOTAL_CLASS = "border-t-2 border-border bg-muted [&_td]:px-3 [&_td]:py-2.5";
/**
 * Identificação persistente: a primeira coluna acompanha a rolagem horizontal, para que
 * a linha continue identificável no celular sem retirar nenhuma coluna da tabela.
 */
const STICKY_ID_CLASS = "sticky left-0 z-[1] whitespace-normal";
const STICKY_ID_WIDTH = "w-[168px] sm:w-[220px]";

function ResultTable<Row extends { parceiro: string }>({
  columns,
  rows,
  total,
  minWidth,
  detailLabel,
  leadColumnId,
  loading,
}: {
  columns: ResultColumn<Row>[];
  rows: Row[];
  total: Row;
  minWidth: string;
  detailLabel: string;
  leadColumnId: string;
  loading?: boolean;
}) {
  /**
   * Base em carregamento não é recorte vazio nem resultado zero: enquanto a consulta
   * não responde, as projeções ficam em skeleton nas dimensões reais da tabela.
   */
  if (loading) {
    return (
      <div className="space-y-2" aria-hidden="true">
        <Skeleton className="h-10 w-full" />
        {[0, 1, 2].map((line) => (
          <Skeleton key={line} className="h-11 w-full" />
        ))}
      </div>
    );
  }

  /**
   * Sem parceiros no recorte não há totalizador a apresentar: uma linha de zeros seria
   * lida como ausência real de oportunidade. Zero e base indisponível são estados distintos.
   */
  if (rows.length === 0) {
    return (
      <EmptyState
        title="Sem parceiros no recorte"
        description="Nenhum parceiro foi retornado para este recorte. Ajuste o filtro de parceiros ou verifique a disponibilidade da base."
      />
    );
  }

  const leadColumn = columns.find((column) => column.id === leadColumnId);

  return (
    <>
      <TableScroll>
        <Table className={cn("table-fixed", minWidth)}>
          <colgroup>
            <col className={STICKY_ID_WIDTH} />
            {columns.map((column) => (
              <col key={column.id} className={column.width} />
            ))}
          </colgroup>
          <TableHeader className={TABLE_HEADER_CLASS}>
            <TableRow className="hover:bg-transparent">
              <TableHead className={cn(STICKY_ID_CLASS, "bg-muted")}>Parceiro</TableHead>
              {columns.map((column) => (
                <TableHead key={column.id} align="numeric">
                  {column.label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody className={TABLE_BODY_CLASS}>
            {rows.map((row) => (
              <TableRow key={row.parceiro}>
                <TableCell className={cn(STICKY_ID_CLASS, "bg-card font-medium text-foreground")}>
                  {row.parceiro}
                </TableCell>
                {columns.map((column) => (
                  <TableCell
                    key={column.id}
                    align="numeric"
                    className={column.emphasis ? "font-semibold text-foreground" : undefined}
                  >
                    {column.format(row)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
          <TableFooter className={TABLE_TOTAL_CLASS}>
            <TableRow className="hover:bg-transparent">
              <TableCell className={cn(STICKY_ID_CLASS, "bg-muted font-semibold text-foreground")}>
                {total.parceiro}
              </TableCell>
              {columns.map((column) => (
                <TableCell
                  key={column.id}
                  align="numeric"
                  className="font-semibold text-foreground"
                >
                  {column.format(total)}
                </TableCell>
              ))}
            </TableRow>
          </TableFooter>
        </Table>
      </TableScroll>
      <MobileRowDetails label={detailLabel} columns={columns} rows={rows} leadColumn={leadColumn} />
    </>
  );
}

/**
 * No celular a tabela continua completa e rolável; esta lista é um acesso alternativo
 * às mesmas colunas, com o parceiro e o resultado principal sempre visíveis.
 */
function MobileRowDetails<Row extends { parceiro: string }>({
  label,
  columns,
  rows,
  leadColumn,
}: {
  label: string;
  columns: ResultColumn<Row>[];
  rows: Row[];
  leadColumn?: ResultColumn<Row>;
}) {
  return (
    <div className="mt-4 md:hidden">
      <p className="text-xs font-semibold text-foreground">{label}</p>
      <p className="mt-1 text-[11px] leading-4 text-muted-foreground">
        Abra uma linha para ver todas as colunas sem rolar a tabela.
      </p>
      <div className="mt-2 divide-y divide-border overflow-hidden rounded-md border border-border">
        {rows.map((row) => (
          <details key={row.parceiro} className="group bg-card">
            <summary className="flex cursor-pointer list-none items-center gap-3 px-3 py-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-inset">
              <span className="min-w-0 flex-1 break-words font-medium text-foreground">
                {row.parceiro}
              </span>
              {leadColumn && (
                <span className="shrink-0 text-right font-semibold tabular-nums text-foreground">
                  {leadColumn.format(row)}
                </span>
              )}
              <ChevronDown
                aria-hidden="true"
                className="size-4 shrink-0 text-muted-foreground transition-transform duration-150 group-open:rotate-180"
              />
            </summary>
            <dl className="border-t border-border bg-muted/30 px-3 py-2.5">
              {columns.map((column) => (
                <div
                  key={column.id}
                  className="flex items-baseline justify-between gap-3 py-1 text-sm"
                >
                  <dt className="text-xs text-muted-foreground">{column.label}</dt>
                  <dd className="min-w-0 break-words text-right font-medium tabular-nums text-foreground">
                    {column.format(row)}
                  </dd>
                </div>
              ))}
            </dl>
          </details>
        ))}
      </div>
    </div>
  );
}
