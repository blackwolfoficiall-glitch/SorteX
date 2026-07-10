"use client";

import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  Tooltip,
} from "recharts";

const data = [
  { dia: "Seg", vendas: 18 },
  { dia: "Ter", vendas: 35 },
  { dia: "Qua", vendas: 26 },
  { dia: "Qui", vendas: 48 },
  { dia: "Sex", vendas: 39 },
  { dia: "Sáb", vendas: 61 },
  { dia: "Dom", vendas: 52 },
];

export default function SalesChart() {
  return (
    <div className="bg-[#101010] rounded-3xl p-6 border border-zinc-800">

      <h2 className="text-xl font-bold mb-6">
        Vendas dos últimos 7 dias
      </h2>

      <div className="h-80">

        <ResponsiveContainer width="100%" height="100%">

          <BarChart data={data}>

            <XAxis
              dataKey="dia"
              stroke="#888"
            />

            <Tooltip />

            <Bar
              dataKey="vendas"
              radius={[10,10,0,0]}
              fill="#7C3AED"
            />

          </BarChart>

        </ResponsiveContainer>

      </div>

    </div>
  );
}