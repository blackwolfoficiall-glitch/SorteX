import type {
  OrganizerPaymentSummary,
  Payment,
  PaymentConfig,
  PaymentStatus,
} from "./types";

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    cache: "no-store",
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = Array.isArray(payload.message)
      ? payload.message.join(" ")
      : payload.message;
    throw new Error(message || "Não foi possível processar o pagamento.");
  }
  return payload as T;
}

export function createPixPayment(purchaseId: string) {
  return request<Payment>("/api/payments/pix", {
    method: "POST",
    body: JSON.stringify({ purchaseId, acceptedTerms: true }),
  });
}
export function createCardPayment(input: {
  purchaseId: string;
  cardToken: string;
  paymentMethodId: string;
  installments: number;
}) {
  return request<Payment>("/api/payments/card", {
    method: "POST",
    body: JSON.stringify({ ...input, acceptedTerms: true }),
  });
}
export function getPayment(id: string) {
  return request<Payment>(`/api/payments/${id}`);
}
export function refreshPaymentStatus(id: string) {
  return request<Payment>(`/api/payments/${id}/refresh`, { method: "POST" });
}
export function getPaymentByPurchase(purchaseId: string) {
  return request<Payment>(`/api/payments/purchase/${purchaseId}`);
}
export function getMyPayments(status?: PaymentStatus) {
  return request<Payment[]>(
    `/api/payments/my${status ? `?status=${status}` : ""}`,
  );
}
export function cancelPayment(id: string) {
  return request<Payment>(`/api/payments/${id}/cancel`, { method: "POST" });
}
export function getPaymentConfig() {
  return request<PaymentConfig>("/api/payments/config");
}
export function getOrganizerPaymentSummary() {
  return request<OrganizerPaymentSummary>("/api/payments/organizer/summary");
}
