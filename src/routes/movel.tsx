import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { DashboardLayout } from "@/layouts/DashboardLayout";
import { ChartCard } from "@/components/ChartCard";
import { BarSimple, DonutChart } from "@/components/charts";
import { ErrorState } from "@/components/EmptyState";
import { useMobile } from "@/hooks/useData";
import { fmtBRL, fmtBRLCompact, fmtInt } from "@/lib/format";
import {
  Calculator,
  CircleMinus,
  CreditCard,
  Download,
  RefreshCw,
  Smartphone,
  UsersRound,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { exportOpportunityBase } from "@/lib/export-xlsx";
import { usePartnerFilter } from "@/contexts/AppContexts";

const SIMULATOR_STORAGE_KEY = "mapa-parque.mobile-simulators.v1";

type SimulatorSettings = {
  linesPerCnpj: number;
  conversionRate: number;
  capacityPerPdu: number;
  averageActivations: number;
  ticketMedio: number;
};

function savedNumber(value: unknown, minimum: number, maximum = Infinity) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(maximum, Math.max(minimum, value))
    : undefined;
}

export const Route = createFileRoute("/movel")({
  head: () => ({ meta: [{ title: "Oportunidades Móvel — Mapa Parque" }] }),
  component: Page,
});

function Page() {
  const { data, isLoading, error, refetch } = useMobile();
  const { effectiveSelected } = usePartnerFilter();
  const exportAction = (kind: Parameters<typeof exportOpportunityBase>[0], title: string) => (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      title={`Exportar base: ${title}`}
      aria-label={`Exportar base de clientes: ${title}`}
      className="size-8 rounded-xl text-current hover:bg-primary/10 hover:text-primary"
      onClick={() => exportOpportunityBase(kind, effectiveSelected)}
    >
      <Download className="size-4" />
    </Button>
  );
  const [linesPerCnpj, setLinesPerCnpj] = useState(2);
  const [conversionRate, setConversionRate] = useState(5);
  const [capacityPerPdu, setCapacityPerPdu] = useState(20);
  const [averageActivations, setAverageActivations] = useState(1);
  const [ticketMedio, setTicketMedio] = useState(0);
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  useEffect(() => {
    try {
      const saved = JSON.parse(
        window.localStorage.getItem(SIMULATOR_STORAGE_KEY) ?? "{}",
      ) as Partial<SimulatorSettings>;
      const savedLines = savedNumber(saved.linesPerCnpj, 0);
      const savedConversion = savedNumber(saved.conversionRate, 0, 100);
      const savedCapacity = savedNumber(saved.capacityPerPdu, 1);
      const savedAverage = savedNumber(saved.averageActivations, 1);
      const savedTicketMedio = savedNumber(saved.ticketMedio, 0);

      if (savedLines != null) setLinesPerCnpj(savedLines);
      if (savedConversion != null) setConversionRate(savedConversion);
      if (savedCapacity != null) setCapacityPerPdu(savedCapacity);
      if (savedAverage != null) setAverageActivations(savedAverage);
      if (savedTicketMedio != null) setTicketMedio(savedTicketMedio);
    } catch {
      // Keep the defaults if browser storage is unavailable or malformed.
    } finally {
      setSettingsLoaded(true);
    }
  }, []);

  useEffect(() => {
    if (!settingsLoaded) return;

    try {
      window.localStorage.setItem(
        SIMULATOR_STORAGE_KEY,
        JSON.stringify({ linesPerCnpj, conversionRate, capacityPerPdu, averageActivations, ticketMedio }),
      );
    } catch {
      // Keep the simulator usable when browser storage is unavailable.
    }
  }, [averageActivations, capacityPerPdu, conversionRate, linesPerCnpj, settingsLoaded, ticketMedio]);

  const simulation = (data?.porParceiro ?? []).map((partner) => {
    const lines = partner.baseRecMovel * linesPerCnpj;
    const conversions = lines * (conversionRate / 100);
    const pdus = capacityPerPdu > 0 ? Math.ceil(conversions / capacityPerPdu) : 0;
    const receita = conversions * ticketMedio;

    return { ...partner, lines, conversions, pdus, receita };
  });
  const simulationTotal = simulation.reduce(
    (total, partner) => ({
      baseRecMovel: total.baseRecMovel + partner.baseRecMovel,
      lines: total.lines + partner.lines,
      conversions: total.conversions + partner.conversions,
      pdus: total.pdus + partner.pdus,
      receita: total.receita + partner.receita,
    }),
    { baseRecMovel: 0, lines: 0, conversions: 0, pdus: 0, receita: 0 },
  );
  const qualifiedSimulation = simulation.map((partner) => {
    const cttMonth = partner.conversions / 2;
    const cttWeek = cttMonth / 4;
    const cttDay = cttWeek / 5;
    const fdv = averageActivations > 0 ? Math.ceil(partner.conversions / averageActivations) : 0;

    return { ...partner, cttMonth, cttWeek, cttDay, fdv };
  });
  const qualifiedTotal = qualifiedSimulation.reduce(
    (total, partner) => ({
      cttMonth: total.cttMonth + partner.cttMonth,
      cttWeek: total.cttWeek + partner.cttWeek,
      cttDay: total.cttDay + partner.cttDay,
      fdv: total.fdv + partner.fdv,
    }),
    { cttMonth: 0, cttWeek: 0, cttDay: 0, fdv: 0 },
  );
  return (
    <DashboardLayout title="Oportunidades Móvel">
      {error ? (
        <ErrorState onRetry={() => refetch()} />
      ) : (
        <>
          <Card className="relative mb-7 overflow-hidden rounded-[2rem] border-primary/15 bg-gradient-to-br from-primary/[0.15] via-card to-cyan/[0.12] p-6 shadow-elegant md:p-7">
            <div className="pointer-events-none absolute -left-12 -top-16 size-52 rounded-full bg-primary/20 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-20 right-8 size-56 rounded-full bg-cyan/20 blur-3xl" />
            <div className="relative flex items-center gap-4">
              <div className="grid size-11 place-items-center rounded-2xl bg-gradient-brand text-primary-foreground shadow-elegant">
                <Smartphone className="size-5" />
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-primary">
                  Portfólio móvel
                </p>
                <h2 className="mt-2 text-3xl font-semibold leading-[1.08] tracking-tight md:text-4xl">
                  Oportunidades móveis em foco.
                </h2>
              </div>
            </div>
          </Card>
          <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
            <Card className="group relative min-h-[184px] overflow-hidden rounded-[2rem] border-cyan/25 bg-gradient-to-br from-card via-card to-cyan/[0.12] p-0 shadow-[0_18px_44px_-30px_hsl(190_85%_46%/0.6)] transition duration-300 hover:-translate-y-1 hover:border-cyan/40 hover:shadow-elevated">
              <div className="pointer-events-none absolute -right-10 -top-12 size-44 rounded-full bg-cyan/25 blur-3xl transition duration-500 group-hover:scale-125" />
              <div className="pointer-events-none absolute -bottom-12 left-8 size-32 rounded-full bg-primary/20 blur-3xl" />
              <div className="relative flex h-full flex-col p-5 md:p-6">
                <div className="flex items-center justify-between gap-3">
                  <div className="grid size-12 place-items-center rounded-2xl bg-cyan/15 text-cyan shadow-sm ring-1 ring-cyan/20">
                    <CreditCard className="size-5" />
                  </div>
                  <span className="rounded-full border border-cyan/25 bg-background/70 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-cyan backdrop-blur">
                    Aparelhos
                  </span>
                </div>
                <p className="mt-7 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Crédito de aparelho
                </p>
                <p
                  className="mt-2 text-4xl font-semibold tracking-tight tabular-nums md:text-[2.7rem]"
                  title={fmtBRL(data?.kpis.creditoAparelhos)}
                >
                  {isLoading ? "—" : fmtBRLCompact(data?.kpis.creditoAparelhos)}
                </p>
                <div className="mt-auto pt-5"><div className="h-px bg-gradient-to-r from-cyan/40 via-cyan/10 to-transparent" /></div>
              </div>
            </Card>
            <Card className="group relative min-h-[184px] overflow-hidden rounded-[2rem] border-violet-400/25 bg-gradient-to-br from-card via-card to-violet-500/[0.12] p-0 shadow-[0_18px_44px_-30px_hsl(272_72%_55%/0.6)] transition duration-300 hover:-translate-y-1 hover:border-violet-400/45 hover:shadow-elevated">
              <div className="pointer-events-none absolute -right-10 -top-12 size-44 rounded-full bg-violet-500/25 blur-3xl transition duration-500 group-hover:scale-125" />
              <div className="relative flex h-full flex-col p-5 md:p-6">
                <div className="flex items-center justify-between gap-3">
                  <div className="grid size-12 place-items-center rounded-2xl bg-violet-500/15 text-violet-700 shadow-sm ring-1 ring-violet-400/20 dark:text-violet-300">
                    <RefreshCw className="size-5" />
                  </div>
                  <div className="flex items-center gap-2">
                    {exportAction("renovacao-aparelho", "Renovação Móvel + Aparelho")}
                    <span className="rounded-full border border-violet-400/25 bg-background/70 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-violet-700 backdrop-blur dark:text-violet-300">
                      CNPJs
                    </span>
                  </div>
                </div>
                <p className="mt-7 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Renovação Móvel + Aparelho
                </p>
                <p className="mt-2 text-4xl font-semibold tracking-tight tabular-nums md:text-[2.7rem]">
                  {isLoading ? "—" : fmtInt(data?.kpis.renovacaoMovelComAparelho)}
                </p>
                <div className="mt-auto pt-5"><div className="h-px bg-gradient-to-r from-violet-500/40 via-violet-500/10 to-transparent" /></div>
              </div>
            </Card>
            <Card className="group relative min-h-[184px] overflow-hidden rounded-[2rem] border-sky-400/25 bg-gradient-to-br from-card via-card to-sky-500/[0.12] p-0 shadow-[0_18px_44px_-30px_hsl(199_89%_48%/0.55)] transition duration-300 hover:-translate-y-1 hover:border-sky-400/45 hover:shadow-elevated">
              <div className="pointer-events-none absolute -right-10 -top-12 size-44 rounded-full bg-sky-500/25 blur-3xl transition duration-500 group-hover:scale-125" />
              <div className="relative flex h-full flex-col p-5 md:p-6">
                <div className="flex items-center justify-between gap-3">
                  <div className="grid size-12 place-items-center rounded-2xl bg-sky-500/15 text-sky-700 shadow-sm ring-1 ring-sky-400/20 dark:text-sky-300">
                    <CircleMinus className="size-5" />
                  </div>
                  <div className="flex items-center gap-2">
                    {exportAction("aparelhos-sem-renovacao", "Aparelho sem renovação")}
                    <span className="rounded-full border border-sky-400/25 bg-background/70 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-sky-700 backdrop-blur dark:text-sky-300">
                      CNPJs
                    </span>
                  </div>
                </div>
                <p className="mt-7 text-[11px] font-semibold uppercase tracking-[0.16em] text-muted-foreground">
                  Aparelho sem renovação
                </p>
                <p className="mt-2 text-4xl font-semibold tracking-tight tabular-nums md:text-[2.7rem]">
                  {isLoading ? "—" : fmtInt(data?.kpis.aparelhoSemRenovacao)}
                </p>
                <div className="mt-auto pt-5"><div className="h-px bg-gradient-to-r from-sky-500/40 via-sky-500/10 to-transparent" /></div>
              </div>
            </Card>
          </div>
          <Card className="relative mt-8 overflow-hidden rounded-[2rem] border-primary/20 bg-gradient-to-br from-card via-card to-primary/[0.08] shadow-elevated">
            <div className="relative flex flex-col gap-5 border-b border-primary/10 bg-primary/[0.035] p-5 lg:flex-row lg:items-end lg:justify-between lg:p-7">
              <div>
                <div className="flex items-center gap-3">
                  <div className="grid size-10 place-items-center rounded-2xl bg-gradient-brand text-primary-foreground shadow-elegant">
                    <Calculator className="size-5" />
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
                      Simulador móvel
                    </p>
                    <h3 className="text-lg font-semibold tracking-tight">Conversão</h3>
                  </div>
                </div>
                <p className="mt-3 max-w-md text-xs leading-5 text-muted-foreground">
                  Simule o volume de linhas, conversões e PDUs para os parceiros selecionados.
                </p>
              </div>
              <div className="grid w-full gap-2 sm:max-w-[700px] sm:grid-cols-4">
                <label className="space-y-2 rounded-[1.25rem] border border-primary/15 bg-background/85 p-3.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground shadow-sm transition focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/10">
                  Linhas por CNPJ
                  <Input
                    type="number"
                    min="0"
                    step="1"
                    value={linesPerCnpj}
                    onChange={(event) =>
                      setLinesPerCnpj(Math.max(0, Number(event.target.value) || 0))
                    }
                    className="h-10 border-0 border-t border-primary/10 bg-transparent px-0 pt-1 text-xl font-semibold tabular-nums text-foreground shadow-none focus-visible:ring-0"
                  />
                </label>
                <label className="space-y-2 rounded-[1.25rem] border border-primary/15 bg-background/85 p-3.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground shadow-sm transition focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/10">
                  Conversão (%)
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    step="0.1"
                    value={conversionRate}
                    onChange={(event) =>
                      setConversionRate(Math.min(100, Math.max(0, Number(event.target.value) || 0)))
                    }
                    className="h-10 border-0 border-t border-primary/10 bg-transparent px-0 pt-1 text-xl font-semibold tabular-nums text-foreground shadow-none focus-visible:ring-0"
                  />
                </label>
                <label className="space-y-2 rounded-[1.25rem] border border-primary/15 bg-background/85 p-3.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground shadow-sm transition focus-within:border-primary/40 focus-within:ring-2 focus-within:ring-primary/10">
                  Dias úteis
                  <Input
                    type="number"
                    min="1"
                    step="1"
                    value={capacityPerPdu}
                    onChange={(event) =>
                      setCapacityPerPdu(Math.max(1, Number(event.target.value) || 1))
                    }
                    className="h-10 border-0 border-t border-primary/10 bg-transparent px-0 pt-1 text-xl font-semibold tabular-nums text-foreground shadow-none focus-visible:ring-0"
                  />
                </label>
                <label className="space-y-2 rounded-[1.25rem] border border-fuchsia/20 bg-fuchsia/[0.035] p-3.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground shadow-sm transition focus-within:border-fuchsia/40 focus-within:ring-2 focus-within:ring-fuchsia/10">
                  Ticket médio (R$)
                  <Input
                    type="number"
                    min="0"
                    step="0.01"
                    value={ticketMedio}
                    onChange={(event) =>
                      setTicketMedio(Math.max(0, Number(event.target.value) || 0))
                    }
                    className="h-10 border-0 border-t border-fuchsia/15 bg-transparent px-0 pt-1 text-xl font-semibold tabular-nums text-foreground shadow-none focus-visible:ring-0"
                  />
                </label>
              </div>
            </div>
            <div className="p-3 sm:p-5">
              <div className="overflow-x-auto rounded-2xl border border-primary/15 bg-background/80 shadow-elegant">
                <Table className="min-w-[900px] table-fixed">
                  <colgroup>
                    <col className="w-[26%]" />
                    <col className="w-[17%]" />
                    <col className="w-[13%]" />
                    <col className="w-[15%]" />
                    <col className="w-[12%]" />
                    <col className="w-[17%]" />
                  </colgroup>
                  <TableHeader className="bg-primary/[0.06] [&_th]:h-auto [&_th]:px-5 [&_th]:py-3.5 [&_th]:text-[10px] [&_th]:font-semibold [&_th]:uppercase [&_th]:tracking-[0.14em] [&_th]:text-muted-foreground">
                    <TableRow className="hover:bg-transparent">
                      <TableHead>Parceiro</TableHead>
                      <TableHead className="text-right">Oportunidade Móvel</TableHead>
                      <TableHead className="text-right">Linhas</TableHead>
                      <TableHead className="text-right">Conversão</TableHead>
                      <TableHead className="text-right">PDU</TableHead>
                      <TableHead className="text-right">Receita móvel</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="[&_td]:px-5 [&_td]:py-4 [&_tr]:border-primary/[0.07] [&_tr]:transition-colors [&_tr:hover]:bg-primary/[0.035]">
                    {simulation.map((partner) => (
                      <TableRow key={partner.parceiro}>
                        <TableCell className="font-medium">{partner.parceiro}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {fmtInt(partner.baseRecMovel)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {fmtInt(partner.lines)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {fmtInt(partner.conversions)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {fmtInt(partner.pdus)}
                        </TableCell>
                        <TableCell className="text-right font-semibold tabular-nums text-fuchsia-700 dark:text-fuchsia-300">
                          {fmtBRL(partner.receita)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  <TableFooter className="border-t border-primary/15 bg-primary/[0.075] font-semibold [&_td]:px-5 [&_td]:py-4">
                    <TableRow>
                      <TableCell>Total</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {fmtInt(simulationTotal.baseRecMovel)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {fmtInt(simulationTotal.lines)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {fmtInt(simulationTotal.conversions)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {fmtInt(simulationTotal.pdus)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-fuchsia-700 dark:text-fuchsia-300">
                        {fmtBRL(simulationTotal.receita)}
                      </TableCell>
                    </TableRow>
                  </TableFooter>
                </Table>
              </div>
            </div>
          </Card>
          <Card className="relative mt-6 overflow-hidden rounded-[2rem] border-cyan/25 bg-gradient-to-br from-card via-card to-cyan/[0.08] shadow-elevated">
            <div className="relative flex flex-col gap-5 border-b border-cyan/15 bg-cyan/[0.045] p-5 sm:flex-row sm:items-end sm:justify-between sm:p-7">
              <div>
                <div className="flex items-center gap-3">
                  <div className="grid size-10 place-items-center rounded-2xl bg-cyan/15 text-cyan shadow-sm">
                    <UsersRound className="size-5" />
                  </div>
                  <div>
                    <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-cyan">
                      Cadência comercial
                    </p>
                    <h3 className="text-lg font-semibold tracking-tight">Qualificados</h3>
                  </div>
                </div>
                <p className="mt-3 max-w-md text-xs leading-5 text-muted-foreground">
                  Distribuição da conversão em contatos qualificados e FDV.
                </p>
              </div>
              <label className="w-full space-y-2 rounded-[1.25rem] border border-cyan/25 bg-background/85 p-3.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground shadow-sm transition focus-within:border-cyan/50 focus-within:ring-2 focus-within:ring-cyan/15 sm:w-52">
                Média de altas
                <Input
                  type="number"
                  min="1"
                  step="0.1"
                  value={averageActivations}
                  onChange={(event) =>
                    setAverageActivations(Math.max(1, Number(event.target.value) || 1))
                  }
                  className="h-10 border-0 border-t border-cyan/15 bg-transparent px-0 pt-1 text-xl font-semibold tabular-nums text-foreground shadow-none focus-visible:ring-0"
                />
              </label>
            </div>
            <div className="p-3 sm:p-5">
              <div className="overflow-x-auto rounded-2xl border border-cyan/20 bg-background/80 shadow-elegant">
                <Table className="min-w-[700px] table-fixed">
                  <colgroup>
                    <col className="w-[36%]" />
                    <col className="w-[16%]" />
                    <col className="w-[16%]" />
                    <col className="w-[16%]" />
                    <col className="w-[16%]" />
                  </colgroup>
                  <TableHeader className="bg-cyan/[0.075] [&_th]:h-auto [&_th]:px-5 [&_th]:py-3.5 [&_th]:text-[10px] [&_th]:font-semibold [&_th]:uppercase [&_th]:tracking-[0.14em] [&_th]:text-muted-foreground">
                    <TableRow className="hover:bg-transparent">
                      <TableHead>Parceiro</TableHead>
                      <TableHead className="text-right">Ctt Mês</TableHead>
                      <TableHead className="text-right">Ctt Sem</TableHead>
                      <TableHead className="text-right">Ctt Dia</TableHead>
                      <TableHead className="text-right">FDV</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody className="[&_td]:px-5 [&_td]:py-4 [&_tr]:border-cyan/[0.09] [&_tr]:transition-colors [&_tr:hover]:bg-cyan/[0.045]">
                    {qualifiedSimulation.map((partner) => (
                      <TableRow key={partner.parceiro}>
                        <TableCell className="font-medium">{partner.parceiro}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {fmtInt(partner.cttMonth)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {fmtInt(partner.cttWeek)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {fmtInt(partner.cttDay)}
                        </TableCell>
                        <TableCell className="text-right tabular-nums">
                          {fmtInt(partner.fdv)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                  <TableFooter className="border-t border-cyan/20 bg-cyan/[0.09] font-semibold [&_td]:px-5 [&_td]:py-4">
                    <TableRow>
                      <TableCell>Total</TableCell>
                      <TableCell className="text-right tabular-nums">
                        {fmtInt(qualifiedTotal.cttMonth)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {fmtInt(qualifiedTotal.cttWeek)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {fmtInt(qualifiedTotal.cttDay)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">
                        {fmtInt(qualifiedTotal.fdv)}
                      </TableCell>
                    </TableRow>
                  </TableFooter>
                </Table>
              </div>
            </div>
          </Card>
          <div className="mt-6 grid gap-4 lg:grid-cols-2">
            <ChartCard
              title="Composição das oportunidades móveis"
              action={
                <span className="rounded-full bg-violet-500/[0.08] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-violet-600 dark:text-violet-300">
                  Mix
                </span>
              }
              className="border-violet-400/15 bg-gradient-to-br from-card via-card to-violet-500/[0.06] shadow-[0_18px_42px_-34px_hsl(272_72%_55%/0.45)]"
            >
              {data && (
                <DonutChart
                  data={data.composicao}
                  nameKey="tipo"
                  dataKey="valor"
                  centerLabel={fmtInt(data.kpis.baseRecMovel)}
                />
              )}
            </ChartCard>
            <ChartCard
              title="Base Oportunidade por parceiro"
              action={
                <span className="rounded-full bg-primary/[0.08] px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-primary">
                  CNPJs
                </span>
              }
              className="border-primary/15 bg-gradient-to-br from-card via-card to-primary/[0.06] shadow-[0_18px_42px_-34px_hsl(var(--primary)/0.45)]"
            >
              {data && (
                <BarSimple
                  data={data.porParceiro}
                  xKey="parceiro"
                  dataKey="baseRecMovel"
                  gradient={{ id: "mobile-partners", from: "var(--chart-2)", to: "var(--primary)" }}
                />
              )}
            </ChartCard>
          </div>
        </>
      )}
    </DashboardLayout>
  );
}
