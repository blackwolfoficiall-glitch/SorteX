import type { PurchaseStatus } from "./types";

export const purchaseStatusLabels: Record<PurchaseStatus, string> = {
  PENDING: "Pendente",
  RESERVED: "Reservada",
  AWAITING_PAYMENT: "Aguardando pagamento",
  PAID: "Paga",
  EXPIRED: "Expirada",
  CANCELLED: "Cancelada",
  REFUNDED: "Estornada",
};
