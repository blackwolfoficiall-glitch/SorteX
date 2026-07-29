export type PurchaseStatus =
  | "PENDING"
  | "RESERVED"
  | "AWAITING_PAYMENT"
  | "PAID"
  | "EXPIRED"
  | "CANCELLED"
  | "REFUNDED";
export type TicketStatus = "AVAILABLE" | "RESERVED" | "SOLD" | "CANCELLED";

export type Ticket = {
  id?: string;
  number: number;
  status: TicketStatus;
  reservedUntil?: string;
};

export type Purchase = {
  id: string;
  buyerId: string;
  campaignId: string;
  promotionId: string | null;
  status: PurchaseStatus;
  selectionMode: "RANDOM" | "MANUAL";
  quantity: number;
  unitPrice: number;
  subtotal: number;
  discount: number;
  total: number;
  expiresAt: string;
  confirmedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  campaign: {
    id: string;
    slug: string;
    title: string;
    coverImage: string | null;
    organizerId: string;
  };
  buyer?: { phone: string | null };
  promotion: {
    id: string;
    name: string;
    numberQuantity: number;
    packagePrice: number;
  } | null;
  tickets: Ticket[];
};

export type Availability = {
  campaignId: string;
  totalNumbers: number;
  availableNumbers: number;
  reservedNumbers: number;
  soldNumbers: number;
  reservationSeconds: number;
  selectionMode: "RANDOM" | "MANUAL";
  minimumPurchase: number;
  maximumPurchasePerBuyer: number | null;
};

export type NumberPage = {
  items: Ticket[];
  page: number;
  limit: number;
  total: number;
  rangeStart?: number;
  rangeEnd?: number;
};

export type OrganizerPurchaseSummary = {
  activeReservations: number;
  awaitingPayment: number;
  reservedNumbers: number;
  soldNumbers: number;
  conversionRate: number | null;
  latest: Array<Purchase & { buyer: { id: string; name: string } }>;
};
