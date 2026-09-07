import { useEffect, useState } from "react";
import { Calculator, UsersRound } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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

type OpportunityRow = {
  parceiro: string;
  oportunidades: number;
};

type SimulatorSettings = {
  quantityPerCnpj: number;
  conversionRate: number;
  capacityPerDay: number;
  averageActivations: number;
  averageTicket: number;
};

type OpportunitySimulatorProps = {
  rows: OpportunityRow[];
  storageKey: string;
  simulatorLabel: string;
  opportunityLabel: string;
  quantityLabel: string;
  revenueLabel: string;
  conversionRate?: number;
  onConversionRateChange?: (value: number) => void;
};

function savedNumber(value: unknown, minimum: number, maximum = Infinity) {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(maximum, Math.max(minimum, value))
    : undefined;
}

export function OpportunitySimulator({
  rows,
  storageKey,
  simulatorLabel,
  opportunityLabel,
  quantityLabel,
  revenueLabel,
  conversionRate: controlledConversionRate,
  onConversionRateChange,
}: OpportunitySimulatorProps) {
  const [quantityPerCnpj, setQuantityPerCnpj] = useState(2);
  const [storedConversionRate, setStoredConversionRate] = useState(5);
  const [capacityPerDay, setCapacityPerDay] = useState(20);
  const [averageActivations, setAverageActivations] = useState(1);
  const [averageTicket, setAverageTicket] = useState(0);
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  useEffect(() => {
    try {
      const saved = JSON.parse(
        window.localStorage.getItem(storageKey) ?? "{}",
      ) as Partial<SimulatorSettings>;
      const savedQuantity = savedNumber(saved.quantityPerCnpj, 0);
      const savedConversion = savedNumber(saved.conversionRate, 0, 100);
      const savedCapacity = savedNumber(saved.capacityPerDay, 1);
      const savedAverage = savedNumber(saved.averageActivations, 1);
      const savedTicket = savedNumber(saved.averageTicket, 0);

      if (savedQuantity != null) setQuantityPerCnpj(savedQuantity);
      if (savedConversion != null) {
        setStoredConversionRate(savedConversion);
        onConversionRateChange?.(savedConversion);
      }
      if (savedCapacity != null) setCapacityPerDay(savedCapacity);
      if (savedAverage != null) setAverageActivations(savedAverage);
      if (savedTicket != null) setAverageTicket(savedTicket);
    } catch {
      // Keep defaults when browser storage is unavailable or malformed.
    } finally {
      setSettingsLoaded(true);
    }
  }, [onConversionRateChange, storageKey]);

  const conversionRate = controlledConversionRate ?? storedConversionRate;
  const changeConversionRate = (value: number) => {
    setStoredConversionRate(value);
    onConversionRateChange?.(value);
  };

  useEffect(() => {
    if (!settingsLoaded) return;
    try {
      window.localStorage.setItem(
        storageKey,
        JSON.stringify({
          quantityPerCnpj,
          conversionRate,
          capacityPerDay,
          averageActivations,
          averageTicket,
        }),
      );
    } catch {
      // Keep the simulator usable when browser storage is unavailable.
    }
  }, [
    averageActivations,
    averageTicket,
    capacityPerDay,
    conversionRate,
    quantityPerCnpj,
    settingsLoaded,
    storageKey,
  ]);

  const simulation = rows.map((partner) => {
    const quantity = partner.oportunidades * quantityPerCnpj;
    const conversions = quantity * (conversionRate / 100);
    const capacity = capacityPerDay > 0 ? Math.ceil(conversions / capacityPerDay) : 0;
    const revenue = conversions * averageTicket;
    return { ...partner, quantity, conversions, capacity, revenue };
  });
  const total = simulation.reduce(
    (result, partner) => ({
      oportunidades: result.oportunidades + partner.oportunidades,
      quantity: result.quantity + partner.quantity,
      conversions: result.conversions + partner.conversions,
      capacity: result.capacity + partner.capacity,
      revenue: result.revenue + partner.revenue,
    }),
    { oportunidades: 0, quantity: 0, conversions: 0, capacity: 0, revenue: 0 },
  );
  const qualified = simulation.map((partner) => ({
    ...partner,
    cttMonth: partner.conversions / 2,
    cttWeek: partner.conversions / 8,
    cttDay: partner.conversions / 40,
    fdv: averageActivations > 0 ? Math.ceil(partner.conversions / averageActivations) : 0,
  }));
  const qualifiedTotal = qualified.reduce(
    (result, partner) => ({
      cttMonth: result.cttMonth + partner.cttMonth,
      cttWeek: result.cttWeek + partner.cttWeek,
      cttDay: result.cttDay + partner.cttDay,
      fdv: result.fdv + partner.fdv,
    }),
    { cttMonth: 0, cttWeek: 0, cttDay: 0, fdv: 0 },
  );

  return (
    <div className="mt-8 space-y-6">
      <Card className="relative overflow-hidden rounded-[2rem] border-primary/20 bg-gradient-to-br from-card via-card to-primary/[0.08] shadow-elevated">
        <div className="relative flex flex-col gap-5 border-b border-primary/10 bg-primary/[0.035] p-5 lg:flex-row lg:items-end lg:justify-between lg:p-7">
          <div>
            <div className="flex items-center gap-3">
              <div className="grid size-10 place-items-center rounded-2xl bg-gradient-brand text-primary-foreground shadow-elegant">
                <Calculator className="size-5" />
              </div>
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-primary">
                  {simulatorLabel}
                </p>
                <h3 className="text-lg font-semibold tracking-tight">Conversão</h3>
              </div>
            </div>
            <p className="mt-3 max-w-md text-xs leading-5 text-muted-foreground">
              Simule volume, conversões, capacidade comercial e receita por parceiro.
            </p>
          </div>
          <div className="grid w-full gap-2 sm:max-w-[700px] sm:grid-cols-4">
            <SimulatorInput
              label={`${quantityLabel} por CNPJ`}
              value={quantityPerCnpj}
              min={0}
              step={1}
              onChange={setQuantityPerCnpj}
            />
            <SimulatorInput
              label="Conversão (%)"
              value={conversionRate}
              min={0}
              max={100}
              step={0.1}
              onChange={changeConversionRate}
            />
            <SimulatorInput
              label="Dias úteis"
              value={capacityPerDay}
              min={1}
              step={1}
              onChange={setCapacityPerDay}
            />
            <SimulatorInput
              label="Ticket médio (R$)"
              value={averageTicket}
              min={0}
              step={0.01}
              onChange={setAverageTicket}
              accent
            />
          </div>
        </div>
        <div className="p-3 sm:p-5">
          <div className="overflow-x-auto rounded-2xl border border-primary/15 bg-background/80 shadow-elegant">
            <Table className="min-w-[900px] table-fixed">
              <TableHeader className="bg-primary/[0.06] [&_th]:h-auto [&_th]:px-5 [&_th]:py-3.5 [&_th]:text-[10px] [&_th]:font-semibold [&_th]:uppercase [&_th]:tracking-[0.14em] [&_th]:text-muted-foreground">
                <TableRow className="hover:bg-transparent">
                  <TableHead>Parceiro</TableHead>
                  <TableHead className="text-right">{opportunityLabel}</TableHead>
                  <TableHead className="text-right">{quantityLabel}</TableHead>
                  <TableHead className="text-right">Conversão</TableHead>
                  <TableHead className="text-right">PDU</TableHead>
                  <TableHead className="text-right">{revenueLabel}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="[&_td]:px-5 [&_td]:py-4 [&_tr]:border-primary/[0.07] [&_tr]:transition-colors [&_tr:hover]:bg-primary/[0.035]">
                {simulation.map((partner) => (
                  <SimulationRow key={partner.parceiro} partner={partner} />
                ))}
              </TableBody>
              <TableFooter className="border-t border-primary/15 bg-primary/[0.075] font-semibold [&_td]:px-5 [&_td]:py-4">
                <SimulationRow partner={{ parceiro: "Total", ...total }} />
              </TableFooter>
            </Table>
          </div>
        </div>
      </Card>

      <Card className="relative overflow-hidden rounded-[2rem] border-cyan/25 bg-gradient-to-br from-card via-card to-cyan/[0.08] shadow-elevated">
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
          <SimulatorInput
            label="Média de altas"
            value={averageActivations}
            min={1}
            step={0.1}
            onChange={setAverageActivations}
            compact
          />
        </div>
        <div className="p-3 sm:p-5">
          <div className="overflow-x-auto rounded-2xl border border-cyan/20 bg-background/80 shadow-elegant">
            <Table className="min-w-[700px] table-fixed">
              <TableHeader className="bg-cyan/[0.075] [&_th]:h-auto [&_th]:px-5 [&_th]:py-3.5 [&_th]:text-[10px] [&_th]:font-semibold [&_th]:uppercase [&_th]:tracking-[0.14em] [&_th]:text-muted-foreground">
                <TableRow className="hover:bg-transparent">
                  <TableHead>Parceiro</TableHead>
                  <TableHead className="text-right">Ctt Mês</TableHead>
                  <TableHead className="text-right">Ctt Sem</TableHead>
                  <TableHead className="text-right">Ctt Dia</TableHead>
                  <TableHead className="text-right">FDV</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody className="[&_td]:px-5 [&_td]:py-4 [&_tr]:border-cyan/[0.09] [&_tr:hover]:bg-cyan/[0.045]">
                {qualified.map((partner) => (
                  <QualifiedRow key={partner.parceiro} partner={partner} />
                ))}
              </TableBody>
              <TableFooter className="border-t border-cyan/20 bg-cyan/[0.09] font-semibold [&_td]:px-5 [&_td]:py-4">
                <QualifiedRow partner={{ parceiro: "Total", ...qualifiedTotal }} />
              </TableFooter>
            </Table>
          </div>
        </div>
      </Card>
    </div>
  );
}

function SimulatorInput({
  label,
  value,
  min,
  max,
  step,
  onChange,
  accent,
  compact,
}: {
  label: string;
  value: number;
  min: number;
  max?: number;
  step: number;
  onChange: (value: number) => void;
  accent?: boolean;
  compact?: boolean;
}) {
  return (
    <label
      className={`${compact ? "w-full sm:w-52" : ""} space-y-2 rounded-[1.25rem] border ${accent ? "border-fuchsia/20 bg-fuchsia/[0.035] focus-within:border-fuchsia/40 focus-within:ring-fuchsia/10" : "border-primary/15 bg-background/85 focus-within:border-primary/40 focus-within:ring-primary/10"} p-3.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-foreground shadow-sm transition focus-within:ring-2`}
    >
      {label}
      <Input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(event) =>
          onChange(Math.min(max ?? Infinity, Math.max(min, Number(event.target.value) || min)))
        }
        className="h-10 border-0 border-t border-primary/10 bg-transparent px-0 pt-1 text-xl font-semibold tabular-nums text-foreground shadow-none focus-visible:ring-0"
      />
    </label>
  );
}

function SimulationRow({
  partner,
}: {
  partner: {
    parceiro: string;
    oportunidades: number;
    quantity: number;
    conversions: number;
    capacity: number;
    revenue: number;
  };
}) {
  return (
    <TableRow>
      <TableCell className="font-medium">{partner.parceiro}</TableCell>
      <TableCell className="text-right tabular-nums">{fmtInt(partner.oportunidades)}</TableCell>
      <TableCell className="text-right tabular-nums">{fmtInt(partner.quantity)}</TableCell>
      <TableCell className="text-right tabular-nums">{fmtInt(partner.conversions)}</TableCell>
      <TableCell className="text-right tabular-nums">{fmtInt(partner.capacity)}</TableCell>
      <TableCell className="text-right font-semibold tabular-nums text-fuchsia-700 dark:text-fuchsia-300">
        {fmtBRL(partner.revenue)}
      </TableCell>
    </TableRow>
  );
}

function QualifiedRow({
  partner,
}: {
  partner: { parceiro: string; cttMonth: number; cttWeek: number; cttDay: number; fdv: number };
}) {
  return (
    <TableRow>
      <TableCell className="font-medium">{partner.parceiro}</TableCell>
      <TableCell className="text-right tabular-nums">{fmtInt(partner.cttMonth)}</TableCell>
      <TableCell className="text-right tabular-nums">{fmtInt(partner.cttWeek)}</TableCell>
      <TableCell className="text-right tabular-nums">{fmtInt(partner.cttDay)}</TableCell>
      <TableCell className="text-right tabular-nums">{fmtInt(partner.fdv)}</TableCell>
    </TableRow>
  );
}
