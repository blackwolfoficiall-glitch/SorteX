import type {
  Purchase,
  Ticket,
} from "../../../../packages/contracts/src/mobile";
import { ApiError, type SortexClient } from "../api/client";

export type Availability = {
  campaignId: string;
  totalNumbers: number;
  availableNumbers: number;
  reservedNumbers: number;
  soldNumbers: number;
  reservationSeconds: number;
  selectionMode: "MANUAL" | "RANDOM";
  minimumPurchase: number;
  maximumPurchasePerBuyer: number | null;
};
export type NumberOption = {
  number: number;
  status: "AVAILABLE" | "RESERVED" | "SOLD" | "CANCELLED";
};
export type NumbersPage = {
  items: NumberOption[];
  total: number;
  page: number;
  limit: number;
};
export type BuyerOrder = Purchase & {
  expiresAt: string | null;
  idempotencyKey?: string | null;
  unitPrice: number;
  subtotal: number;
  discount: number;
};
export type ReservationInput =
  { mode: "MANUAL"; numbers: number[] } | { mode: "RANDOM"; quantity: number };

export function parseDigits(text: string) {
  if (!/^[0-9]+$/.test(text) || /[^0-9]/.test(text)) return null;
  const result = Number(text);
  return Number.isSafeInteger(result) ? result : null;
}
export function titleNumber(number: number, totalNumbers: number) {
  return String(number).padStart(
    String(Math.max(0, totalNumbers - 1)).length,
    "0",
  );
}
export function isActiveReservation(
  order: Pick<BuyerOrder, "status" | "expiresAt">,
  at = Date.now(),
) {
  return (
    ["RESERVED", "AWAITING_PAYMENT"].includes(order.status) &&
    typeof order.expiresAt === "string" &&
    Date.parse(order.expiresAt) > at
  );
}
export function purchaseLimits(
  availability: Availability,
  includeInventory = true,
) {
  return {
    min: Math.max(availability.minimumPurchase, 1),
    max: Math.min(
      includeInventory
        ? availability.availableNumbers
        : availability.totalNumbers,
      availability.maximumPurchasePerBuyer ?? Infinity,
      availability.selectionMode === "MANUAL" ? 10000 : 100000,
    ),
  };
}
const segment = (value: string) => encodeURIComponent(value);
type BuyerClient = Pick<
  SortexClient,
  "request" | "publicRequest" | "snapshot" | "activeSessionRevision"
>;
export type ReservationAttempt = {
  fingerprint: string;
  idempotencyKey: string;
};
export const normalizeCouponCode = (value: string) =>
  value.trim().toUpperCase();

function reservationFingerprint(
  campaignId: string,
  selection: ReservationInput,
  code = "",
) {
  const canonical =
    selection.mode === "MANUAL"
      ? [...selection.numbers].sort((a, b) => a - b)
      : selection.quantity;
  return JSON.stringify([
    campaignId,
    selection.mode,
    canonical,
    normalizeCouponCode(code),
  ]);
}

export type AppliedCoupon = {
  code: string;
  fingerprint: string;
  buyerId: string;
  sessionRevision: number;
  subtotal: number;
  discount: number;
  total: number;
};

export function matchesCouponSelection(
  coupon: AppliedCoupon | undefined,
  campaignId: string,
  selection: ReservationInput,
  code: string,
): coupon is AppliedCoupon {
  return (
    coupon?.fingerprint === reservationFingerprint(campaignId, selection, code)
  );
}

export function reservationAttempt(
  campaignId: string,
  selection: ReservationInput,
  previous: ReservationAttempt | null,
  randomUUID: () => string,
  couponCode?: string,
): ReservationAttempt {
  const fingerprint = reservationFingerprint(campaignId, selection, couponCode);
  if (previous?.fingerprint === fingerprint) return previous;
  return { fingerprint, idempotencyKey: randomUUID() };
}

export class BuyerPurchases {
  constructor(
    private readonly client: BuyerClient,
    private readonly buyerId: string,
  ) {}

  private ensureAccount() {
    const { status, user } = this.client.snapshot();
    if (
      status !== "signedIn" ||
      user?.role !== "BUYER" ||
      user.id !== this.buyerId
    )
      throw new ApiError("Entre com a conta de comprador para continuar.", 401);
  }
  private ensureRevision(revision: number | null) {
    this.ensureAccount();
    if (revision === null || this.client.activeSessionRevision() !== revision)
      throw new ApiError("A sessão mudou. Tente novamente.", 401);
    return revision;
  }

  private async scoped<T>(run: () => Promise<T>) {
    const revision = this.ensureRevision(this.client.activeSessionRevision());
    try {
      const value = await run();
      this.ensureRevision(revision);
      return value;
    } catch (error) {
      this.ensureRevision(revision);
      throw error;
    }
  }

  availability(slug: string) {
    return this.scoped(() =>
      this.client.publicRequest<Availability>(
        `/public/campaigns/${segment(slug)}/availability`,
      ),
    );
  }
  numbers(slug: string, totalNumbers: number, page: number, search?: number) {
    const end = Math.max(totalNumbers - 1, 0);
    const query = new URLSearchParams({
      rangeEnd: String(end),
      limit: "30",
      page: String(page),
    });
    if (search !== undefined) query.set("search", String(search));
    return this.scoped(() =>
      this.client.publicRequest<NumbersPage>(
        `/public/campaigns/${segment(slug)}/numbers?${query.toString()}`,
      ),
    );
  }
  current() {
    return this.scoped(() =>
      this.client.request<BuyerOrder | null>("/purchases/current"),
    );
  }
  orders() {
    return this.scoped(() =>
      this.client.request<BuyerOrder[]>("/purchases/my"),
    );
  }
  order(id: string) {
    return this.scoped(() =>
      this.client.request<BuyerOrder>(`/purchases/${segment(id)}`),
    );
  }
  cancel(id: string) {
    return this.scoped(() =>
      this.client.request<BuyerOrder>(
        `/purchases/${segment(id)}/cancel`,
        "POST",
      ),
    );
  }
  async ticketOrder(id: string) {
    const order = await this.order(id);
    const tickets =
      order.status === "PAID"
        ? await this.scoped(() =>
            this.client.request<Ticket[]>(`/purchases/${segment(id)}/tickets`),
          )
        : [];
    return {
      order,
      tickets: tickets.filter((ticket) => ticket.status === "SOLD"),
    };
  }

  private validateSelection(
    availability: Availability,
    selection: ReservationInput,
    reconciling = false,
  ) {
    if (availability.selectionMode !== selection.mode)
      throw new ApiError("A campanha não aceita este tipo de seleção.");
    const { min, max } = purchaseLimits(availability, !reconciling);
    const quantity =
      selection.mode === "MANUAL"
        ? selection.numbers.length
        : selection.quantity;
    if (!Number.isSafeInteger(quantity) || quantity < min || quantity > max)
      throw new ApiError(
        max < min
          ? "Não há títulos disponíveis para a reserva mínima."
          : `Selecione de ${min} a ${max} títulos.`,
      );
    if (
      selection.mode === "MANUAL" &&
      (new Set(selection.numbers).size !== quantity ||
        selection.numbers.some(
          (number) =>
            !Number.isSafeInteger(number) ||
            number < 0 ||
            number >= availability.totalNumbers ||
            number > 9_999_999,
        ))
    )
      throw new ApiError(
        "Seleção contém títulos repetidos ou fora da campanha.",
      );
    return quantity;
  }

  async quoteCoupon(
    availability: Availability,
    selection: ReservationInput,
    couponCode: string,
  ): Promise<AppliedCoupon> {
    const revision = this.ensureRevision(this.client.activeSessionRevision());
    const code = normalizeCouponCode(couponCode);
    if (!code) throw new ApiError("Informe o código do cupom.");
    const campaignId = availability.campaignId;
    const quantity = this.validateSelection(availability, selection);
    const result = await this.scoped(() =>
      this.client.request<{
        campaignId: string;
        quantity: number;
        subtotal: number;
        discount: number;
        total: number;
      }>("/purchases/promotion-quote", "POST", {
        campaignId,
        quantity,
        couponCode: code,
      }),
    );
    if (
      result?.campaignId !== campaignId ||
      result.quantity !== quantity ||
      result.total >= result.subtotal ||
      result.discount >= result.subtotal ||
      ![result.subtotal, result.discount, result.total].every(
        (value) =>
          typeof value === "number" && Number.isFinite(value) && value > 0,
      )
    )
      throw new ApiError("A API não confirmou o desconto para esta seleção.");
    return {
      code,
      fingerprint: reservationFingerprint(campaignId, selection, code),
      buyerId: this.buyerId,
      sessionRevision: revision,
      subtotal: result.subtotal,
      discount: result.discount,
      total: result.total,
    };
  }

  async reserve(
    availability: Availability,
    selection: ReservationInput,
    idempotencyKey: string,
    reconciling = false,
    coupon?: AppliedCoupon,
  ) {
    if (!idempotencyKey)
      throw new ApiError(
        "Não foi possível identificar a tentativa da reserva.",
      );
    this.validateSelection(availability, selection, reconciling);
    if (
      coupon &&
      (coupon.buyerId !== this.buyerId ||
        coupon.sessionRevision !== this.client.activeSessionRevision() ||
        !matchesCouponSelection(
          coupon,
          availability.campaignId,
          selection,
          coupon.code,
        ))
    )
      throw new ApiError("Confirme novamente o cupom para esta seleção.");

    const common = {
      campaignId: availability.campaignId,
      idempotencyKey,
      ...(coupon ? { couponCode: coupon.code } : {}),
    };
    const result = await this.scoped(() =>
      selection.mode === "MANUAL"
        ? this.client.request<BuyerOrder>("/purchases/reserve-manual", "POST", {
            ...common,
            numbers: [...selection.numbers].sort((a, b) => a - b),
          })
        : this.client.request<BuyerOrder>("/purchases/reserve-random", "POST", {
            ...common,
            quantity: selection.quantity,
          }),
    );
    if (result.campaign?.id !== availability.campaignId)
      throw new ApiError("A API retornou a reserva de outra campanha.");
    return result;
  }
}
