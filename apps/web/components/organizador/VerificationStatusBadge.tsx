import { CheckCircle2, Clock3, FileWarning, Search, XCircle } from "lucide-react";
import type { VerificationStatus } from "@/lib/organizers/types";

const statusConfig = {
  INCOMPLETE: { label: "Cadastro incompleto", className: "bg-zinc-100 text-zinc-700", icon: Clock3 },
  PENDING: {
    label: "Aguardando análise",
    className: "bg-amber-100 text-amber-800",
    icon: Clock3,
  },
  UNDER_REVIEW: {
    label: "Em análise",
    className: "bg-blue-100 text-blue-800",
    icon: Search,
  },
  VERIFIED: {
    label: "Organizador verificado",
    className: "bg-green-100 text-green-800",
    icon: CheckCircle2,
  },
  REJECTED: {
    label: "Reprovado",
    className: "bg-red-100 text-red-800",
    icon: XCircle,
  },
  CORRECTION_REQUESTED: { label: "Correção solicitada", className: "bg-orange-100 text-orange-800", icon: XCircle },
  DOCUMENT_REQUESTED: { label: "Documentação solicitada", className: "bg-amber-100 text-amber-800", icon: FileWarning },
  SUSPENDED: { label: "Suspenso", className: "bg-orange-100 text-orange-800", icon: XCircle },
  BLOCKED: { label: "Bloqueado", className: "bg-red-100 text-red-800", icon: XCircle },
  CLOSED: { label: "Encerrado", className: "bg-zinc-200 text-zinc-800", icon: XCircle },
};

export default function VerificationStatusBadge({
  status,
}: {
  status: VerificationStatus;
}) {
  const config = statusConfig[status];
  const Icon = config.icon;
  return (
    <span className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-bold ${config.className}`}>
      <Icon size={16} /> {config.label}
    </span>
  );
}
