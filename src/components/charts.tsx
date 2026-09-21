import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Label,
  LabelList,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { fmtInt } from "@/lib/format";

const COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

const axisProps = {
  stroke: "var(--muted-foreground)",
  tick: { fill: "var(--muted-foreground)", fontSize: 10, fontWeight: 500 },
  tickLine: false,
  axisLine: false,
};

const tooltipStyle = {
  contentStyle: {
    background: "var(--popover)",
    border: "1px solid var(--border)",
    borderRadius: 16,
    color: "var(--popover-foreground)",
    fontSize: 12,
    boxShadow: "0 16px 36px -12px rgb(0 0 0 / 0.22)",
    padding: "10px 12px",
  },
  labelStyle: { color: "var(--foreground)", fontWeight: 600 },
  itemStyle: { color: "var(--popover-foreground)" },
};

export type CategoryRow = Record<string, string | number>;

/**
 * Colunas verticais para poucas categorias de ordem própria (cenários, comparativos),
 * em que reordenar por valor mudaria a leitura. Séries usam cor sólida: gradiente na
 * barra não carrega significado e compete com o valor.
 */
export function BarSimple({
  data,
  dataKey,
  xKey,
  height = 240,
  color = "var(--chart-1)",
  valueFormatter = fmtInt,
  valueLabels = true,
}: {
  data: CategoryRow[];
  dataKey: string;
  xKey: string;
  height?: number;
  color?: string;
  valueFormatter?: (value: number) => string;
  valueLabels?: boolean;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 20, right: 8, bottom: 0, left: -8 }}>
        <CartesianGrid
          stroke="var(--border)"
          strokeDasharray="2 5"
          strokeOpacity={0.58}
          vertical={false}
        />
        <XAxis
          dataKey={xKey}
          {...axisProps}
          interval={0}
          tick={{ ...axisProps.tick, fontSize: 12 }}
          height={34}
        />
        <YAxis {...axisProps} tickFormatter={(v) => valueFormatter(v)} width={64} />
        <Tooltip
          {...tooltipStyle}
          formatter={(v: number) => valueFormatter(v)}
          cursor={{ fill: "var(--primary)", fillOpacity: 0.045 }}
        />
        <Bar dataKey={dataKey} fill={color} radius={[4, 4, 0, 0]} maxBarSize={72}>
          {valueLabels && (
            <LabelList
              dataKey={dataKey}
              position="top"
              formatter={(value: number) => valueFormatter(value)}
              style={{ fill: "var(--foreground)", fontSize: 11, fontWeight: 600 }}
            />
          )}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/**
 * Barras horizontais ordenadas por valor. Usar quando há muitas categorias de texto
 * (cidades, parceiros): o rótulo fica legível na horizontal, sem inclinação nem
 * sobreposição. A ordenação é apenas de leitura e não introduz avaliação competitiva:
 * os valores e o conjunto exibido são os mesmos recebidos.
 */
export function BarRanked({
  data,
  dataKey,
  categoryKey,
  color = "var(--chart-1)",
  valueFormatter = fmtInt,
  labelFormatter,
  rowHeight = 30,
  minHeight = 120,
}: {
  data: CategoryRow[];
  dataKey: string;
  categoryKey: string;
  color?: string;
  valueFormatter?: (value: number) => string;
  /** Rótulo ao lado da barra; por padrão, o mesmo formato do eixo. */
  labelFormatter?: (value: number) => string;
  rowHeight?: number;
  minHeight?: number;
}) {
  const ordered = [...data].sort(
    (left, right) => (Number(right?.[dataKey]) || 0) - (Number(left?.[dataKey]) || 0),
  );
  const height = Math.max(minHeight, ordered.length * rowHeight + 24);
  const labelWidth = Math.min(
    190,
    Math.max(
      96,
      ordered.reduce(
        (widest, row) => Math.max(widest, String(row?.[categoryKey] ?? "").length),
        0,
      ) *
        7.2 +
        14,
    ),
  );

  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={ordered} layout="vertical" margin={{ top: 4, right: 72, bottom: 4, left: 0 }}>
        <CartesianGrid
          stroke="var(--border)"
          strokeDasharray="2 5"
          strokeOpacity={0.58}
          horizontal={false}
        />
        <XAxis type="number" {...axisProps} tickFormatter={(v) => valueFormatter(v)} />
        <YAxis
          type="category"
          dataKey={categoryKey}
          {...axisProps}
          width={labelWidth}
          interval={0}
          tick={{ ...axisProps.tick, fontSize: 12 }}
        />
        <Tooltip
          {...tooltipStyle}
          formatter={(v: number) => valueFormatter(v)}
          cursor={{ fill: "var(--primary)", fillOpacity: 0.045 }}
        />
        <Bar dataKey={dataKey} fill={color} radius={[0, 3, 3, 0]} maxBarSize={18}>
          <LabelList
            dataKey={dataKey}
            position="right"
            formatter={(value: number) => (labelFormatter ?? valueFormatter)(value)}
            style={{ fill: "var(--foreground)", fontSize: 11, fontWeight: 600 }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/**
 * Distribuição por categoria (parceiro, cidade, tipo de oferta).
 *
 * Com mais de uma categoria, usa barras horizontais ordenadas, com o valor explícito
 * ao lado da barra. Com uma única categoria — o caso de um parceiro no recorte — um
 * gráfico alto de uma barra só desperdiça espaço e não compara nada: nesse caso o
 * resultado aparece em forma compacta, com exatamente o mesmo número.
 */
export function CategoryDistribution({
  data,
  dataKey,
  categoryKey,
  color,
  valueFormatter = fmtInt,
  labelFormatter,
  rowHeight,
  minHeight,
}: {
  data: CategoryRow[];
  dataKey: string;
  categoryKey: string;
  color?: string;
  valueFormatter?: (value: number) => string;
  labelFormatter?: (value: number) => string;
  rowHeight?: number;
  minHeight?: number;
}) {
  if (data.length === 1) {
    const [only] = data;
    const value = Number(only?.[dataKey]) || 0;
    return (
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1 rounded-md border border-border bg-muted/40 px-4 py-3.5">
        <span className="min-w-0 break-words text-sm font-medium text-foreground">
          {String(only?.[categoryKey] ?? "—")}
        </span>
        <span className="text-2xl font-semibold leading-[30px] tabular-nums text-foreground">
          {(labelFormatter ?? valueFormatter)(value)}
        </span>
      </div>
    );
  }

  return (
    <BarRanked
      data={data}
      dataKey={dataKey}
      categoryKey={categoryKey}
      color={color}
      valueFormatter={valueFormatter}
      labelFormatter={labelFormatter}
      rowHeight={rowHeight}
      minHeight={minHeight}
    />
  );
}

export function BarStacked({
  data,
  xKey,
  keys,
  height = 300,
}: {
  data: any[];
  xKey: string;
  keys: { key: string; label: string; color?: string }[];
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
        <CartesianGrid
          stroke="var(--border)"
          strokeDasharray="2 5"
          strokeOpacity={0.72}
          vertical={false}
        />
        <XAxis dataKey={xKey} {...axisProps} />
        <YAxis {...axisProps} tickFormatter={(v) => fmtInt(v)} width={60} />
        <Tooltip {...tooltipStyle} formatter={(v: number) => fmtInt(v)} />
        <Legend
          wrapperStyle={{ fontSize: 11, paddingTop: 12 }}
          iconType="circle"
          iconSize={8}
          formatter={(value) => <span style={{ color: "var(--foreground)" }}>{value}</span>}
        />
        {keys.map((k, i) => (
          <Bar
            key={k.key}
            dataKey={k.key}
            name={k.label}
            fill={k.color ?? COLORS[i % COLORS.length]}
            radius={i === keys.length - 1 ? [10, 10, 2, 2] : 0}
            stackId="a"
          />
        ))}
      </BarChart>
    </ResponsiveContainer>
  );
}

export function DonutChart({
  data,
  nameKey,
  dataKey,
  height = 280,
  centerLabel,
  centerCaption,
}: {
  data: any[];
  nameKey: string;
  dataKey: string;
  height?: number;
  centerLabel?: string;
  centerCaption?: string;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Tooltip {...tooltipStyle} formatter={(v: number) => fmtInt(v)} />
        <Pie
          data={data}
          nameKey={nameKey}
          dataKey={dataKey}
          innerRadius={68}
          outerRadius={106}
          minAngle={2}
          paddingAngle={3}
          stroke="var(--card)"
          strokeWidth={3}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
          {centerLabel && (
            <Label
              value={centerLabel}
              position="center"
              fill="var(--foreground)"
              style={{ fontSize: 20, fontWeight: 700 }}
            />
          )}
          {centerCaption && (
            <Label
              value={centerCaption}
              position="center"
              offset={-20}
              fill="var(--muted-foreground)"
              style={{ fontSize: 10, fontWeight: 600, letterSpacing: "0.08em" }}
            />
          )}
        </Pie>
        <Legend
          wrapperStyle={{ fontSize: 11, paddingTop: 12 }}
          iconType="circle"
          iconSize={8}
          verticalAlign="bottom"
          formatter={(value) => <span style={{ color: "var(--foreground)" }}>{value}</span>}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function LineTrend({
  data,
  xKey,
  dataKey,
  height = 260,
}: {
  data: any[];
  xKey: string;
  dataKey: string;
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
        <CartesianGrid
          stroke="var(--border)"
          strokeDasharray="2 5"
          strokeOpacity={0.72}
          vertical={false}
        />
        <XAxis dataKey={xKey} {...axisProps} />
        <YAxis
          {...axisProps}
          tickFormatter={(v) => fmtInt(v)}
          width={60}
          domain={["dataMin - 1", "dataMax + 1"]}
        />
        <Tooltip {...tooltipStyle} formatter={(v: number) => fmtInt(v)} />
        <Line
          type="monotone"
          dataKey={dataKey}
          stroke="var(--chart-1)"
          strokeWidth={2.5}
          dot={{ fill: "var(--chart-1)", r: 4 }}
          activeDot={{ r: 6 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
