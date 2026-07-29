import { authRequest } from "@/lib/auth/client";

export type PrizeTicket = {
  id: string;
  exactNumber: string | null;
  description: string;
  value: number;
  type: string;
  status: "AVAILABLE" | "FOUND" | "DELIVERED" | "CANCELLED";
  origin: string;
  instructions: string | null;
  createdAt: string;
  updatedAt: string;
  foundAt: string | null;
  deliveredAt: string | null;
  campaign: { id: string; title: string; slug: string; totalNumbers: number };
  reservation: {
    purchaseId: string;
    buyerName: string;
    buyerPhone: string;
    city: string | null;
    state: string | null;
    reservedAt: string;
    expiresAt: string;
  } | null;
  results: Array<{
    id: string;
    status: string;
    identifiedAt: string;
    deliveredAt: string | null;
    purchase: { id: string; quantity: number; total: number };
    buyer: {
      id: string;
      name: string;
      email: string;
      phone: string;
      city: string | null;
      state: string | null;
    };
  }>;
};

export type PrizeTicketSummary = {
  all: number;
  available: number;
  reserved: number;
  found: number;
  paused: number;
  expired: number;
  delivered: number;
};

export type PrizeTicketList = {
  items: PrizeTicket[];
  total: number;
  page: number;
  pages: number;
};

export type PrizeTicketFilters = {
  status?: string;
  campaignId?: string;
  type?: string;
  search?: string;
  startDate?: string;
  endDate?: string;
  sort?: string;
  page?: number;
  limit?: number;
};

export type PrizeHistoryItem = {
  id: string;
  action: string;
  actorUserId: string | null;
  previousData: unknown;
  newData: unknown;
  createdAt: string;
};

const queryString = (filters: PrizeTicketFilters = {}) => {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== "") params.set(key, String(value));
  });
  const value = params.toString();
  return value ? `?${value}` : "";
};

export const listPrizeTickets = (filters: PrizeTicketFilters = {}) =>
  authRequest<PrizeTicketList>(`/api/draws/organizer/prize-tickets${queryString(filters)}`, {
    cache: "no-store",
  });

export const getPrizeTicketSummary = (campaignId?: string) =>
  authRequest<PrizeTicketSummary>(
    `/api/draws/organizer/prize-tickets/summary${queryString({ campaignId })}`,
    { cache: "no-store" },
  );

export const createPrizeTickets = (body: Record<string, unknown>) =>
  authRequest<PrizeTicket[]>("/api/draws/organizer/prize-tickets", {
    method: "POST",
    body: JSON.stringify(body),
  });

export const updatePrizeTicket = (id: string, body: Record<string, unknown>) =>
  authRequest<PrizeTicket>(`/api/draws/organizer/prize-tickets/${id}`, {
    method: "PATCH",
    body: JSON.stringify(body),
  });

export const prizeTicketAction = (id: string, action: string) =>
  authRequest(`/api/draws/organizer/prize-tickets/${id}/${action}`, {
    method: "POST",
  });

export const prizeTicketHistory = (id: string) =>
  authRequest<PrizeHistoryItem[]>(
    `/api/draws/organizer/prize-tickets/${id}/history`,
    { cache: "no-store" },
  );
