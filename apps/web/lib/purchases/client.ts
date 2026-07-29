import type {
  Availability,
  NumberPage,
  OrganizerPurchaseSummary,
  Purchase,
  PurchaseStatus,
} from "./types";

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 15000);
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      credentials: "include",
      signal: controller.signal,
      headers: { "Content-Type": "application/json", ...init?.headers },
    });
  } catch (cause) {
    if (cause instanceof DOMException && cause.name === "AbortError") {
      throw new Error("A reserva demorou mais que o esperado. Tente novamente.");
    }
    throw new Error("Não foi possível conectar ao serviço de reservas. Tente novamente.");
  } finally {
    window.clearTimeout(timeout);
  }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message = Array.isArray(payload.message)
      ? payload.message.join(" ")
      : payload.message;
    throw new Error(message || "Não foi possível concluir a operação.");
  }
  return payload as T;
}

export function reserveRandom(input: {
  campaignId: string;
  quantity: number;
  promotionId?: string;
  couponCode?: string;
  idempotencyKey?: string;
  affiliateCode?: string;
}) {
  return request<Purchase>("/api/purchases/reserve-random", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function reserveManual(input: {
  campaignId: string;
  numbers: number[];
  promotionId?: string;
  couponCode?: string;
  idempotencyKey?: string;
  affiliateCode?: string;
}) {
  return request<Purchase>("/api/purchases/reserve-manual", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function getPurchase(id: string) {
  return request<Purchase>(`/api/purchases/${id}`);
}
export function getMyPurchases(status?: PurchaseStatus) {
  const query = status ? `?status=${status}` : "";
  return request<Purchase[]>(`/api/purchases/my${query}`);
}
export function cancelPurchase(id: string) {
  return request<Purchase>(`/api/purchases/${id}/cancel`, { method: "POST" });
}
export function getAvailability(slug: string) {
  return request<Availability>(`/api/public/campaigns/${slug}/availability`);
}
export function getNumbers(slug: string, params: URLSearchParams) {
  return request<NumberPage>(`/api/public/campaigns/${slug}/numbers?${params}`);
}
export function getOrganizerPurchaseSummary() {
  return request<OrganizerPurchaseSummary>("/api/purchases/organizer/summary");
}

export type ExpiredInstantPrizeAlert = {
  id: string; campaignId: string; campaignTitle: string; campaignSlug: string;
  purchaseId: string; buyerName: string; buyerEmail: string; buyerPhone: string;
  city: string | null; state: string | null; winningNumber: string; prizeName: string;
  prizeValue: number; quantity: number; purchaseValue: number; reservedAt: string;
  expiredAt: string; status: "AVAILABLE_AGAIN";
};
export function getExpiredInstantPrizeAlerts() { return request<ExpiredInstantPrizeAlert[]>("/api/purchases/organizer/expired-instant-prizes"); }
export function markExpiredInstantPrizeViewed(id: string) { return request<{ message: string }>(`/api/purchases/organizer/expired-instant-prizes/${encodeURIComponent(id)}/viewed`, { method: "POST" }); }
