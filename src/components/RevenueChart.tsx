import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { revenueTrend } from "@/lib/mock-data";
import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type RevenuePoint = {
  month: string;
  revenue: number;
};

export function RevenueChart({ data }: { data?: RevenuePoint[] }) {
  const chartData = data ?? revenueTrend;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base font-semibold">Przychód miesięczny (PLN)</CardTitle>
        <p className="text-xs text-muted-foreground">
          {data ? "Projekcja 7 miesięcy na bazie dat wygaśnięć" : "Ostatnie 7 miesięcy · suma kontraktowa"}
        </p>
      </CardHeader>
      <CardContent className="h-[260px] pl-1 pr-3">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="oklch(0.27 0.09 280)" stopOpacity={0.35} />
                <stop offset="100%" stopColor="oklch(0.27 0.09 280)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="month"
              stroke="oklch(0.55 0.02 260)"
              fontSize={11}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              stroke="oklch(0.55 0.02 260)"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
              width={40}
            />
            <Tooltip
              contentStyle={{
                background: "white",
                border: "1px solid oklch(0.92 0.008 255)",
                borderRadius: 8,
                fontSize: 12,
              }}
              formatter={(v: number) => [`${v.toLocaleString("pl-PL")} PLN`, "Przychód"]}
            />
            <Area
              type="monotone"
              dataKey="revenue"
              stroke="oklch(0.27 0.09 280)"
              strokeWidth={2.5}
              fill="url(#rev)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
