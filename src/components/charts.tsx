import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
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

const COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

const axisProps = {
  stroke: "var(--muted-foreground)",
  tick: { fill: "var(--muted-foreground)", fontSize: 11 },
  tickLine: false,
  axisLine: { stroke: "var(--border)" },
};

const tooltipStyle = {
  contentStyle: {
    background: "var(--popover)",
    border: "1px solid var(--border)",
    borderRadius: 12,
    color: "var(--popover-foreground)",
    fontSize: 12,
    boxShadow: "0 8px 24px -8px rgb(0 0 0 / 0.15)",
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
}: {
  data: any[];
  dataKey: string;
  xKey: string;
  height?: number;
  onClickBar?: (d: any) => void;
  color?: string;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
        <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey={xKey} {...axisProps} interval={0} angle={data.length > 6 ? -20 : 0} textAnchor={data.length > 6 ? "end" : "middle"} height={data.length > 6 ? 60 : 30} />
        <YAxis {...axisProps} tickFormatter={(v) => fmtInt(v)} width={60} />
        <Tooltip {...tooltipStyle} formatter={(v: number) => fmtInt(v)} />
        <Bar
          dataKey={dataKey}
          fill={color}
          radius={[6, 6, 0, 0]}
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
        <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey={xKey} {...axisProps} />
        <YAxis {...axisProps} tickFormatter={(v) => fmtInt(v)} width={60} />
        <Tooltip {...tooltipStyle} formatter={(v: number) => fmtInt(v)} />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        {keys.map((k, i) => (
          <Bar
            key={k.key}
            dataKey={k.key}
            name={k.label}
            fill={k.color ?? COLORS[i % COLORS.length]}
            radius={i === keys.length - 1 ? [6, 6, 0, 0] : 0}
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
}: {
  data: any[];
  nameKey: string;
  dataKey: string;
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Tooltip {...tooltipStyle} formatter={(v: number) => fmtInt(v)} />
        <Pie
          data={data}
          nameKey={nameKey}
          dataKey={dataKey}
          innerRadius={60}
          outerRadius={100}
          paddingAngle={2}
          stroke="var(--card)"
          strokeWidth={2}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Pie>
        <Legend wrapperStyle={{ fontSize: 12 }} verticalAlign="bottom" />
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
        <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
        <XAxis dataKey={xKey} {...axisProps} />
        <YAxis {...axisProps} tickFormatter={(v) => fmtInt(v)} width={60} domain={["dataMin - 1", "dataMax + 1"]} />
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
