"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export type VisitTrendPoint = {
  date: string;
  label: string;
  visits: number;
};

export default function VisitTrendChart({ data }: { data: VisitTrendPoint[] }) {
  return (
    <div className="h-64 w-full" role="img" aria-label="Patient visits for the last seven days">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 12, right: 12, left: -20, bottom: 0 }}>
          <defs>
            <linearGradient id="visitFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#059669" stopOpacity={0.22} />
              <stop offset="95%" stopColor="#059669" stopOpacity={0.01} />
            </linearGradient>
          </defs>
          <CartesianGrid vertical={false} stroke="#e2e8f0" strokeDasharray="4 4" />
          <XAxis
            dataKey="label"
            axisLine={false}
            tickLine={false}
            tick={{ fill: "#64748b", fontSize: 12 }}
            tickMargin={12}
          />
          <YAxis
            allowDecimals={false}
            axisLine={false}
            tickLine={false}
            tick={{ fill: "#64748b", fontSize: 12 }}
            tickMargin={8}
          />
          <Tooltip
            cursor={{ stroke: "#94a3b8", strokeDasharray: "4 4" }}
            contentStyle={{
              borderRadius: 10,
              borderColor: "#e2e8f0",
              boxShadow: "0 8px 24px rgba(15, 23, 42, .08)",
              fontSize: 13,
            }}
            labelStyle={{ color: "#0f172a", fontWeight: 600 }}
            formatter={(value) => [`${value ?? 0}`, "Visits"]}
            labelFormatter={(_, payload) =>
              payload?.[0]?.payload?.date
                ? new Intl.DateTimeFormat("en", {
                    month: "short",
                    day: "numeric",
                    timeZone: "Africa/Lagos",
                  }).format(new Date(`${payload[0].payload.date}T12:00:00+01:00`))
                : ""
            }
          />
          <Area
            type="monotone"
            dataKey="visits"
            stroke="#047857"
            strokeWidth={2.5}
            fill="url(#visitFill)"
            activeDot={{ r: 5, fill: "#047857", stroke: "white", strokeWidth: 2 }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
