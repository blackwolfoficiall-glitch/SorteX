import { RoleGate } from "@/components/auth/RoleGate";
import { PlanSelector } from "@/components/organizer-platform/PlanSelector";
export default function EscolherPlanoPage() { return <RoleGate allowed={["ORGANIZER"]}><main className="min-h-screen bg-zinc-50 px-4 py-10 sm:px-6"><div className="mx-auto max-w-7xl"><PlanSelector onboarding /></div></main></RoleGate>; }
