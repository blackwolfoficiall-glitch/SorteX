export type PaymentStatus =
  | "CREATED"
  | "PENDING"
  | "PROCESSING"
  | "APPROVED"
  | "REJECTED"
  | "CANCELLED"
  | "EXPIRED"
  | "REFUNDED"
  | "CHARGEBACK";
export type PaymentMethod = "PIX" | "CREDIT_CARD" | "DEBIT_CARD";

export type Payment = {
  id: string;
  purchaseId: string;
  provider: "MERCADO_PAGO";
  providerPaymentId: string | null;
  method: PaymentMethod;
  status: PaymentStatus;
  amount: number;
  platformFee: number;
  gatewayFee: number;
  netAmount: number;
  currency: string;
  pixQrCode: string | null;
  pixQrCodeBase64: string | null;
  pixCopyPaste: string | null;
  boletoUrl: string | null;
  cardLastFour: string | null;
  cardBrand: string | null;
  installments: number | null;
  expiresAt: string | null;
  approvedAt: string | null;
  rejectedAt: string | null;
  failureReason: string | null;
  createdAt: string;
  profileComplete: boolean;
  purchase: {
    id: string;
    status: string;
    quantity: number;
    subtotal: number;
    discount: number;
    total: number;
    confirmedAt: string | null;
    expiresAt: string;
    tickets: Array<{ number: number; status: string }>;
    campaign: {
      id: string;
      slug: string;
      title: string;
      coverImage: string | null;
      organizerId: string;
    };
  };
};

export type PaymentConfig = {
  provider: "MERCADO_PAGO";
  environment: "sandbox";
  publicKey: string | null;
  maxInstallments: number;
  estimatedFeePercent: number;
};

export type OrganizerPaymentSummary = {
  approved: number;
  pending: number;
  rejected: number;
  grossRevenue: number;
  platformFee: number;
  gatewayFee: number;
  estimatedNetAmount: number;
  latest: Array<{
    id: string;
    method: PaymentMethod;
    status: PaymentStatus;
    amount: number;
    platformFee: number;
    gatewayFee: number;
    netAmount: number;
    createdAt: string;
    purchase: {
      quantity: number;
      buyer: { name: string };
      campaign: { title: string };
    };
  }>;
};
