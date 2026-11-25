import { ApiError, type SortexClient } from "../api/client";
import { TEST_API } from "../api/config";

const route = "/payments/native-sandbox-pix";

export const sandboxPixStatuses = {
  CREATED: "Iniciado",
  PENDING: "Pendente",
  PROCESSING: "Em processamento",
  APPROVED: "Aprovado",
  REJECTED: "Recusado",
  CANCELLED: "Cancelado",
  EXPIRED: "Expirado",
  REFUNDED: "Estornado",
  CHARGEBACK: "Em contestação",
} as const;

export type SandboxPix = {
  id: string;
  purchaseId: string;
  status: keyof typeof sandboxPixStatuses;
  amount: number;
  expiresAt: string | null;
  environment: "sandbox";
  awaitingProvider: boolean;
};

export class BuyerSandboxPix {
  constructor(
    private readonly client: Pick<
      SortexClient,
      "snapshot" | "request" | "baseUrl"
    >,
    private readonly buyerId: string,
    private readonly optIn: boolean,
  ) {}

  private ensureBuyer() {
    const { status, user } = this.client.snapshot();
    if (
      status !== "signedIn" ||
      user?.role !== "BUYER" ||
      user.id !== this.buyerId
    )
      throw new ApiError("Entre com a conta de comprador para continuar.", 401);
  }

  private usesAllowedApi() {
    return this.optIn && this.client.baseUrl === TEST_API;
  }

  private async scoped<T>(run: () => Promise<T>) {
    if (!this.usesAllowedApi())
      throw new ApiError("Pix de teste indisponível nesta versão.", 503);
    this.ensureBuyer();
    const result = await run();
    this.ensureBuyer();
    return result;
  }

  async enabled() {
    if (!this.usesAllowedApi()) return false;
    const config = await this.scoped(() =>
      this.client.request<{
        enabled?: unknown;
        environment?: unknown;
        method?: unknown;
        provider?: unknown;
      } | null>(route + "/config"),
    );
    return (
      config?.enabled === true &&
      config.environment === "sandbox" &&
      config.method === "PIX" &&
      config.provider === "MERCADO_PAGO"
    );
  }

  private checked(result: SandboxPix | null, purchaseId: string) {
    if (
      !result ||
      result.environment !== "sandbox" ||
      result.purchaseId !== purchaseId ||
      typeof result.id !== "string" ||
      !result.id ||
      typeof result.status !== "string" ||
      !Object.hasOwn(sandboxPixStatuses, result.status) ||
      typeof result.amount !== "number" ||
      !Number.isFinite(result.amount) ||
      result.amount <= 0 ||
      typeof result.awaitingProvider !== "boolean" ||
      (result.expiresAt !== null &&
        (typeof result.expiresAt !== "string" ||
          !Number.isFinite(Date.parse(result.expiresAt))))
    ) {
      throw new ApiError("A API não confirmou o Pix de teste deste pedido.");
    }
    return result;
  }

  async get(purchaseId: string) {
    const value = await this.scoped(() =>
      this.client.request<SandboxPix | null>(
        route + "/purchase/" + encodeURIComponent(purchaseId),
      ),
    );
    return value === null ? null : this.checked(value, purchaseId);
  }

  async create(purchaseId: string, acceptedTestTerms: boolean) {
    if (acceptedTestTerms !== true)
      throw new ApiError("Confirme que o Pix é apenas para teste.");
    if (!(await this.enabled()))
      throw new ApiError("Pix de teste indisponível neste ambiente.", 503);
    return this.checked(
      await this.scoped(() =>
        this.client.request<SandboxPix>(route, "POST", {
          purchaseId,
          acceptedTerms: true,
        }),
      ),
      purchaseId,
    );
  }
}
