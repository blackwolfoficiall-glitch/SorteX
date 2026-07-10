import { ReactNode } from "react";
import Card from "./Card";

interface StatCardProps {
  title: string;
  value: string | number;
  icon: ReactNode;
  color?: string;
}

export default function StatCard({
  title,
  value,
  icon,
  color = "text-violet-600",
}: StatCardProps) {
  return (
    <Card className="p-6 hover:shadow-xl transition-all duration-300">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-zinc-500">{title}</p>

          <h2 className="mt-2 text-3xl font-bold">
            {value}
          </h2>
        </div>

        <div
          className={`flex h-14 w-14 items-center justify-center rounded-2xl bg-violet-50 ${color}`}
        >
          {icon}
        </div>
      </div>
    </Card>
  );
}