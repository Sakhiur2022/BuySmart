'use client';

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

export type SalesOverviewPoint = {
  month: string;
  total: number;
};

type SalesOverviewChartProps = {
  data: SalesOverviewPoint[];
};

export function SalesOverviewChart({ data }: SalesOverviewChartProps) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-muted-foreground/30" />
          <XAxis dataKey="month" tickLine={false} axisLine={false} />
          <YAxis domain={[0, 8000]} tickLine={false} axisLine={false} />
          <Tooltip
            cursor={{ stroke: 'hsl(var(--muted))', strokeWidth: 1 }}
            contentStyle={{
              borderRadius: '0.75rem',
              borderColor: 'hsl(var(--border))',
              backgroundColor: 'hsl(var(--background))',
              fontSize: '0.75rem',
            }}
            formatter={(value: number | string) => {
              const amount = typeof value === 'number' ? value : Number(value);
              return [`$${amount.toFixed(2)}`, 'Revenue'];
            }}
          />
          <Line
            type="monotone"
            dataKey="total"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            dot={{ r: 3, strokeWidth: 2 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
