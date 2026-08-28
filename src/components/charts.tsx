import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Label,
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

export function BarSimple({
  data,
  dataKey,
  xKey,
  height = 280,
  onClickBar,
  color = "var(--chart-1)",
  gradient,
  valueFormatter = fmtInt,
}: {
  data: any[];
  dataKey: string;
  xKey: string;
  height?: number;
  onClickBar?: (d: any) => void;
  color?: string;
  gradient?: { id: string; from: string; to: string };
  valueFormatter?: (value: number) => string;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
        {gradient && (
          <defs>
            <linearGradient id={gradient.id} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={gradient.from} stopOpacity={1} />
              <stop offset="100%" stopColor={gradient.to} stopOpacity={0.75} />
            </linearGradient>
          </defs>
        )}
        <CartesianGrid stroke="var(--border)" strokeDasharray="2 5" strokeOpacity={0.58} vertical={false} />
        <XAxis
          dataKey={xKey}
          {...axisProps}
          interval={0}
          angle={data.length > 6 ? -20 : 0}
          textAnchor={data.length > 6 ? "end" : "middle"}
          height={data.length > 6 ? 60 : 30}
        />
        <YAxis {...axisProps} tickFormatter={(v) => valueFormatter(v)} width={64} />
        <Tooltip {...tooltipStyle} formatter={(v: number) => valueFormatter(v)} cursor={{ fill: "var(--primary)", fillOpacity: 0.045 }} />
        <Bar
          dataKey={dataKey}
          fill={gradient ? `url(#${gradient.id})` : color}
          radius={[12, 12, 3, 3]}
          maxBarSize={68}
          onClick={(d) => onClickBar?.(d)}
          cursor={onClickBar ? "pointer" : "default"}
        />
      </BarChart>
    </ResponsiveContainer>
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
        <CartesianGrid stroke="var(--border)" strokeDasharray="2 5" strokeOpacity={0.72} vertical={false} />
        <XAxis dataKey={xKey} {...axisProps} />
        <YAxis {...axisProps} tickFormatter={(v) => fmtInt(v)} width={60} />
        <Tooltip {...tooltipStyle} formatter={(v: number) => fmtInt(v)} />
        <Legend wrapperStyle={{ fontSize: 11, paddingTop: 12 }} iconType="circle" iconSize={8} />
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
        <Legend wrapperStyle={{ fontSize: 11, paddingTop: 12 }} iconType="circle" iconSize={8} verticalAlign="bottom" />
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
        <CartesianGrid stroke="var(--border)" strokeDasharray="2 5" strokeOpacity={0.72} vertical={false} />
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
