import { getDashboard } from "@/lib/api/dashboard";

export default async function DashboardPage() {
  const dashboard = await getDashboard();

  return (
    <pre className="p-10">
      {JSON.stringify(dashboard, null, 2)}
    </pre>
  );
}