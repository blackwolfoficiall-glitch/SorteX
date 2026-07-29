"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Clock3, LoaderCircle, Minus, Plus, Ticket, X } from "lucide-react";
import Button from "@/components/ui/Button";
import type { Campaign } from "@/lib/campaigns/types";
import {
  getNumbers,
  reserveManual,
  reserveRandom,
} from "@/lib/purchases/client";
import type { Ticket as TicketType } from "@/lib/purchases/types";

export default function PurchasePanel({ campaign }: { campaign: Campaign }) {
  const router = useRouter();
  const [quantity, setQuantity] = useState(campaign.minimumPurchase || 1);
  const [quantityText, setQuantityText] = useState(
    String(campaign.minimumPurchase || 1),
  );
  const [promotionId, setPromotionId] = useState<string>();
  const [selected, setSelected] = useState<number[]>([]);
  const [numbers, setNumbers] = useState<TicketType[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [selectedQuick, setSelectedQuick] = useState<number>();
  const [couponCode, setCouponCode] = useState("");
  const [couponDiscount, setCouponDiscount] = useState(0);
  const [couponMessage, setCouponMessage] = useState("");
  const [identityStep, setIdentityStep] = useState<"PHONE" | "EXISTING" | null>(
    null,
  );
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [maskedEmail, setMaskedEmail] = useState("");
  const idempotencyKey = useRef<string | undefined>(undefined);
  const startPurchaseRef = useRef<() => void>(() => undefined);
  const accent = campaignAccent(campaign);

  useEffect(() => {
    if (campaign.numberSelectionMode !== "MANUAL") return;
    const params = new URLSearchParams({ page: String(page), limit: "100" });
    getNumbers(campaign.slug, params)
      .then((result) => setNumbers(result.items))
      .catch((cause) =>
        setError(
          cause instanceof Error
            ? cause.message
            : "Falha ao consultar títulos.",
        ),
      );
  }, [campaign.numberSelectionMode, campaign.slug, page]);

  const promotion = campaign.promotions.find((item) => item.id === promotionId);
  const effectiveQuantity =
    campaign.numberSelectionMode === "MANUAL" ? selected.length : quantity;
  const subtotal = effectiveQuantity * campaign.numberPrice;
  const baseTotal = promotion?.packagePrice ?? subtotal;
  const total = Math.max(0, baseTotal - couponDiscount);
  const discount = Math.max(0, subtotal - total);
  const rouletteRounds = rouletteRoundsForQuantity(
    campaign.customization?.configuration,
    effectiveQuantity,
  );
  const canReserve =
    campaign.numberSelectionMode === "MANUAL"
      ? selected.length >= campaign.minimumPurchase
      : quantity >= campaign.minimumPurchase;

  async function reserveAuthenticated() {
    setLoading(true);
    setError("");
    try {
      idempotencyKey.current ||= crypto.randomUUID();
      const affiliateCode = document.cookie.match(
        /(?:^|; )sortex_ref=([^;]+)/,
      )?.[1];
      const purchase =
        campaign.numberSelectionMode === "MANUAL"
          ? await reserveManual({
              campaignId: campaign.id,
              numbers: selected,
              promotionId,
              couponCode: couponCode || undefined,
              idempotencyKey: idempotencyKey.current,
              affiliateCode,
            })
          : await reserveRandom({
              campaignId: campaign.id,
              quantity,
              promotionId,
              couponCode: couponCode || undefined,
              idempotencyKey: idempotencyKey.current,
              affiliateCode,
            });
      idempotencyKey.current = undefined;
      router.push(`/comprador/checkout/${purchase.id}`);
    } catch (cause) {
      setError(publicError(cause));
    } finally {
      setLoading(false);
    }
  }

  async function startPurchase() {
    if (loading) return;
    if (!canReserve) {
      setError("Escolha uma quantidade válida para continuar.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const auth = await fetchWithTimeout("/api/auth/me", {
        credentials: "include",
        cache: "no-store",
      });
      if (auth.status === 401) {
        setIdentityStep("PHONE");
        return;
      }
      const session = await readResponse<{ role?: string; phone?: string }>(
        auth,
      );
      if (!auth.ok)
        throw new Error(
          sessionMessage(session, "Não foi possível validar sua sessão."),
        );
      if (session.role !== "BUYER") {
        setError("Entre com uma conta de comprador para reservar títulos.");
        return;
      }
      await reserveAuthenticated();
    } catch (cause) {
      setError(publicError(cause));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    startPurchaseRef.current = () => void startPurchase();
  });
  useEffect(() => {
    const listener = () => startPurchaseRef.current();
    window.addEventListener("sortex:start-purchase", listener);
    return () => window.removeEventListener("sortex:start-purchase", listener);
  }, []);
  useEffect(() => {
    const listener = (event: Event) => {
      const detail = (event as CustomEvent<{ quantity?: number }>).detail;
      const requested = Math.floor(Number(detail?.quantity));
      if (!Number.isFinite(requested) || requested < campaign.minimumPurchase)
        return;
      const amount = Math.min(
        campaign.maximumPurchasePerBuyer ?? Number.MAX_SAFE_INTEGER,
        requested,
      );
      const matchingPromotion = campaign.promotions.find(
        (item) => item.isActive && item.numberQuantity === amount,
      );
      if (matchingPromotion) choosePromotion(matchingPromotion.id, amount);
      else {
        setPromotionId(undefined);
        setSelectedQuick(undefined);
        setSelected([]);
        setQuantity(amount);
        setQuantityText(String(amount));
      }
    };
    window.addEventListener("sortex:select-roulette-combo", listener);
    return () =>
      window.removeEventListener("sortex:select-roulette-combo", listener);
  }, [campaign.maximumPurchasePerBuyer, campaign.minimumPurchase, campaign.promotions]);

  async function identifyPhone() {
    if (loading) return;
    let temporarySession = false;
    setLoading(true);
    setError("");
    try {
      const response = await fetchWithTimeout("/api/auth/checkout/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone }),
      });
      const result = await readResponse<{
        existing?: boolean;
        temporary?: boolean;
        canContinue?: boolean;
        maskedEmail?: string;
        message?: string | string[];
      }>(response);
      if (!response.ok)
        throw new Error(
          sessionMessage(result, "Não foi possível consultar o WhatsApp."),
        );
      if (result.existing && !result.canContinue)
        throw new Error(
          "Este número pertence a uma conta que não pode comprar. Entre com uma conta de comprador.",
        );
      if (result.existing) {
        setMaskedEmail(result.maskedEmail || "");
        setIdentityStep("EXISTING");
        return;
      }
      setIdentityStep(null);
      temporarySession = true;
    } catch (cause) {
      setError(publicError(cause));
    } finally {
      setLoading(false);
    }
    if (temporarySession) await reserveAuthenticated();
  }

  async function finishIdentity() {
    if (loading) return;
    setLoading(true);
    setError("");
    try {
      const login = await fetchWithTimeout("/api/auth/login", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const loginBody = await readResponse<{
        user?: { role?: string };
        message?: string | string[];
      }>(login);
      if (!login.ok)
        throw new Error(
          sessionMessage(loginBody, "E-mail ou senha inválidos."),
        );
      if (loginBody.user?.role !== "BUYER")
        throw new Error("Use uma conta de comprador para continuar.");
      setIdentityStep(null);
    } catch (cause) {
      setError(publicError(cause));
      setLoading(false);
      return;
    }
    setLoading(false);
    await reserveAuthenticated();
  }

  function choosePromotion(id: string, amount: number) {
    setPromotionId(id);
    setSelectedQuick(undefined);
    setQuantity(amount);
    setQuantityText(String(amount));
    setSelected([]);
  }

  const maximum = campaign.maximumPurchasePerBuyer ?? Number.MAX_SAFE_INTEGER;
  function addQuick(amount: number) {
    setPromotionId(undefined);
    setSelectedQuick(amount);
    setQuantity((current) => {
      const next = Math.min(
        maximum,
        current <= campaign.minimumPurchase ? amount : current + amount,
      );
      setQuantityText(String(next));
      return next;
    });
  }
  function commitQuantity() {
    const parsed = Number(quantityText);
    const next = Number.isFinite(parsed)
      ? Math.min(maximum, Math.max(campaign.minimumPurchase, parsed))
      : campaign.minimumPurchase;
    setQuantity(next);
    setQuantityText(String(next));
  }

  async function applyCoupon() {
    setCouponMessage("");
    setCouponDiscount(0);
    try {
      const response = await fetch("/api/platform/promotion-quote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaignId: campaign.id,
          quantity: effectiveQuantity,
          couponCode,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || "Cupom inválido.");
      setCouponDiscount(Number(result.discount) || 0);
      setCouponMessage("Cupom aplicado com sucesso.");
    } catch (cause) {
      setCouponMessage(
        cause instanceof Error ? cause.message : "Cupom inválido.",
      );
    }
  }

  return (
    <div className="space-y-5" data-purchase-panel>
      {rouletteRounds > 0 && (
        <div
          className="rounded-2xl border border-violet-200 bg-violet-50 p-4 text-sm font-bold text-violet-900"
          data-testid="roulette-purchase-summary"
        >
          Você selecionou {effectiveQuantity.toLocaleString("pt-BR")} títulos e
          receberá {rouletteRounds} {rouletteRounds === 1 ? "giro" : "giros"}{" "}
          após o pagamento aprovado.
        </div>
      )}
      {campaign.promotions.some((item) => item.isActive) && (
        <div>
          <p className="text-sm font-bold text-zinc-600">
            Pacotes promocionais
          </p>
          <div className="mt-5 grid auto-cols-[minmax(170px,1fr)] grid-flow-col gap-3 overflow-x-auto px-1 pb-2 pt-3 sm:auto-cols-[minmax(210px,1fr)] lg:grid-flow-row lg:grid-cols-3 lg:overflow-visible">
            {campaign.promotions
              .filter((item) => item.isActive)
              .map((item) => (
                <button
                  key={item.id}
                  onClick={() => choosePromotion(item.id, item.numberQuantity)}
                  style={
                    promotionId === item.id
                      ? {
                          borderColor: accent,
                          boxShadow: `0 0 0 2px ${accent}22`,
                        }
                      : undefined
                  }
                  className="relative isolate rounded-2xl border bg-white p-4 text-left transition-all duration-200 hover:-translate-y-0.5"
                >
                  <div className="flex items-center justify-between gap-2">
                    <strong>{item.name}</strong>
                  </div>
                  <p className="mt-1 text-sm text-zinc-500">
                    {item.numberQuantity.toLocaleString("pt-BR")} títulos
                  </p>
                  <div className="mt-2 flex items-end justify-between">
                    <p className="font-black text-green-700">
                      R$ {item.packagePrice.toFixed(2).replace(".", ",")}
                    </p>
                    <span className="rounded-full bg-green-100 px-2 py-1 text-xs font-black text-green-700">
                      {item.discountRate.toFixed(1)}% OFF
                    </span>
                  </div>
                </button>
              ))}
          </div>
        </div>
      )}

      {campaign.numberSelectionMode === "RANDOM" ? (
        <div className="grid gap-4 md:grid-cols-[1.4fr_0.6fr]">
          <div>
            <p className="text-xs font-black uppercase text-zinc-600">
              Escolha uma quantidade
            </p>
            <div className="mt-3 grid grid-cols-3 gap-x-2 gap-y-5 overflow-visible pt-4">
              {[50, 100, 250, 500, 1000, 2000].map((value) => {
                const active = selectedQuick === value;
                const popular = campaign.popularQuickQuantity === value;
                return (
                  <div
                    key={value}
                    className="relative min-w-0 overflow-visible"
                  >
                    {popular && (
                      <span
                        className="absolute left-1/2 top-0 z-20 -translate-x-1/2 -translate-y-1/2 whitespace-nowrap rounded-full bg-white px-2 py-1 text-[9px] font-black shadow"
                        style={{ color: accent }}
                      >
                        Mais popular ⭐
                      </span>
                    )}
                    <button
                      disabled={quantity >= maximum}
                      onClick={() => addQuick(value)}
                      style={
                        popular
                          ? { borderColor: accent, backgroundColor: accent }
                          : active
                            ? {
                                borderColor: accent,
                                boxShadow: `0 0 0 2px ${accent}33`,
                              }
                            : {}
                      }
                      className={`h-full w-full rounded-xl border px-1 py-3 text-sm font-black transition-all duration-200 hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:bg-zinc-100 disabled:text-zinc-400 ${popular ? "text-white shadow-lg" : active ? "bg-white" : "border-zinc-200 bg-white"}`}
                    >
                      +{value.toLocaleString("pt-BR")}
                      <span className="mt-1 block text-[9px] font-semibold opacity-80">
                        {(value * campaign.numberPrice).toLocaleString(
                          "pt-BR",
                          { style: "currency", currency: "BRL" },
                        )}
                      </span>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
          <div>
            <p className="text-xs font-black uppercase text-zinc-600">
              Quantidade
            </p>
            <div className="mt-3 flex items-center gap-2 rounded-2xl border p-2">
              <button
                aria-label="Diminuir"
                onClick={() => {
                  setPromotionId(undefined);
                  setSelectedQuick(undefined);
                  setQuantity((value) => {
                    const next = Math.max(campaign.minimumPurchase, value - 1);
                    setQuantityText(String(next));
                    return next;
                  });
                }}
                className="rounded-full border p-2 text-violet-700 transition active:scale-90"
              >
                <Minus size={18} />
              </button>
              <input
                aria-label="Quantidade"
                inputMode="numeric"
                value={quantityText}
                onChange={(event) => {
                  setPromotionId(undefined);
                  setSelectedQuick(undefined);
                  const raw = event.target.value.replace(/\D/g, "");
                  setQuantityText(raw);
                  if (raw !== "") setQuantity(Math.min(maximum, Number(raw)));
                }}
                onBlur={commitQuantity}
                className="min-w-0 flex-1 bg-transparent text-center text-xl font-black outline-none"
              />
              <button
                aria-label="Aumentar"
                disabled={quantity >= maximum}
                onClick={() => {
                  setPromotionId(undefined);
                  setSelectedQuick(undefined);
                  setQuantity((value) => {
                    const next = Math.min(maximum, value + 1);
                    setQuantityText(String(next));
                    return next;
                  });
                }}
                className="rounded-full border p-2 text-violet-700 transition active:scale-90 disabled:text-zinc-300"
              >
                <Plus size={18} />
              </button>
            </div>
            {maximum < Number.MAX_SAFE_INTEGER && (
              <p className="mt-2 text-center text-[10px] text-zinc-500">
                Limite por comprador: {maximum.toLocaleString("pt-BR")}
              </p>
            )}
          </div>
        </div>
      ) : (
        <div>
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-zinc-600">
              Escolha seus números
            </p>
            <span className="text-xs text-violet-700">
              {selected.length} selecionado(s)
            </span>
          </div>
          <div className="mt-3 grid grid-cols-5 gap-2 sm:grid-cols-10 lg:grid-cols-5">
            {numbers.map((item) => {
              const active = selected.includes(item.number);
              const available = item.status === "AVAILABLE";
              return (
                <button
                  key={item.number}
                  disabled={!available}
                  onClick={() =>
                    setSelected((current) =>
                      active
                        ? current.filter((value) => value !== item.number)
                        : [...current, item.number],
                    )
                  }
                  className={`rounded-lg py-2 text-xs font-bold ${active ? "bg-violet-700 text-white" : available ? "border bg-white hover:border-violet-500" : "bg-zinc-100 text-zinc-400 line-through"}`}
                >
                  {String(item.number).padStart(
                    String(campaign.totalNumbers - 1).length,
                    "0",
                  )}
                </button>
              );
            })}
          </div>
          <div className="mt-3 flex justify-between">
            <button
              disabled={page === 1}
              onClick={() => setPage((value) => Math.max(1, value - 1))}
              className="text-sm font-bold text-violet-700 disabled:text-zinc-300"
            >
              Anterior
            </button>
            <span className="text-xs text-zinc-500">Página {page}</span>
            <button
              onClick={() => setPage((value) => value + 1)}
              className="text-sm font-bold text-violet-700"
            >
              Próxima
            </button>
          </div>
        </div>
      )}

      <div className="rounded-2xl bg-zinc-50 p-4">
        <div className="mb-4 border-b pb-4">
          <p className="text-sm font-bold">Possui cupom?</p>
          <div className="mt-2 flex gap-2">
            <input
              value={couponCode}
              onChange={(e) => {
                setCouponCode(e.target.value.toUpperCase());
                setCouponDiscount(0);
              }}
              placeholder="CÓDIGO"
              className="h-10 min-w-0 flex-1 rounded-xl border bg-white px-3 uppercase"
            />
            <button
              onClick={() => void applyCoupon()}
              disabled={!couponCode}
              className="rounded-xl bg-violet-600 px-4 text-sm font-bold text-white disabled:opacity-40"
            >
              Aplicar
            </button>
          </div>
          {couponMessage && (
            <p
              className={`mt-2 text-xs ${couponDiscount > 0 ? "text-green-700" : "text-red-700"}`}
            >
              {couponMessage}
            </p>
          )}
        </div>
        <div className="flex justify-between text-sm">
          <span>Subtotal</span>
          <span>R$ {subtotal.toFixed(2).replace(".", ",")}</span>
        </div>
        {discount > 0 && (
          <div className="mt-2 flex justify-between text-sm text-green-700">
            <span>Desconto</span>
            <span>- R$ {discount.toFixed(2).replace(".", ",")}</span>
          </div>
        )}
        <div className="mt-3 flex items-end justify-between border-t pt-3">
          <strong>Total</strong>
          <strong className="text-3xl">
            R$ {total.toFixed(2).replace(".", ",")}
          </strong>
        </div>
      </div>
      <p className="flex items-center gap-2 text-xs text-zinc-500">
        <Clock3 size={14} /> Após confirmar, os títulos ficam reservados por 15
        minutos.
      </p>
      {error && (
        <div
          role="alert"
          className="rounded-xl bg-red-50 p-3 text-sm text-red-700"
        >
          <p>{error}</p>
          <button
            type="button"
            onClick={() => void startPurchase()}
            className="mt-2 font-black underline"
          >
            Tentar novamente
          </button>
        </div>
      )}
      <Button
        disabled={!canReserve || loading}
        className="h-14 w-full bg-green-600 transition-all duration-200 hover:-translate-y-0.5 hover:bg-green-700 hover:shadow-lg active:scale-[0.98]"
        onClick={() => void startPurchase()}
      >
        {loading ? <LoaderCircle className="animate-spin" /> : <Ticket />}{" "}
        Reservar títulos
      </Button>
      {identityStep && (
        <div
          className="fixed inset-0 z-[90] flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="checkout-identity-title"
        >
          <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white p-6 shadow-2xl sm:rounded-3xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h3 id="checkout-identity-title" className="text-xl font-black">
                  Finalize sua reserva
                </h3>
                <p className="mt-1 font-bold">{campaign.title}</p>
                <p className="text-sm text-zinc-600">
                  {effectiveQuantity.toLocaleString("pt-BR")} títulos · R${" "}
                  {total.toFixed(2).replace(".", ",")}
                </p>
              </div>
              <button
                type="button"
                aria-label="Fechar"
                onClick={() => setIdentityStep(null)}
                className="rounded-full p-2 hover:bg-zinc-100"
              >
                <X />
              </button>
            </div>
            {identityStep === "PHONE" ? (
              <div className="mt-5">
                <p className="mb-4 rounded-xl bg-green-50 p-3 text-sm text-green-800">
                  Compra segura. Seus números serão disponibilizados após a
                  confirmação do pagamento.
                </p>
                <label className="text-sm font-bold">
                  Informe seu WhatsApp
                </label>
                <div className="mt-2 flex gap-2">
                  <span className="flex h-12 items-center rounded-xl border bg-zinc-50 px-3 font-bold">
                    +55
                  </span>
                  <input
                    autoFocus
                    inputMode="tel"
                    value={phone}
                    onChange={(event) =>
                      setPhone(formatPhone(event.target.value))
                    }
                    placeholder="(75) 99999-9999"
                    className="h-12 min-w-0 flex-1 rounded-xl border px-3 outline-none focus:border-violet-600"
                  />
                </div>
                <Button
                  disabled={loading || phone.replace(/\D/g, "").length < 10}
                  className="mt-5 h-12 w-full"
                  onClick={() => void identifyPhone()}
                >
                  {loading ? (
                    <LoaderCircle className="animate-spin" />
                  ) : (
                    "Continuar"
                  )}
                </Button>
              </div>
            ) : (
              <div className="mt-5 space-y-3">
                <p className="text-sm text-zinc-600">
                  Encontramos uma conta ({maskedEmail}). Confirme seus dados
                  para continuar.
                </p>
                <label className="block text-sm font-bold">
                  E-mail
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    className="mt-1 h-12 w-full rounded-xl border px-3 font-normal"
                  />
                </label>
                <label className="block text-sm font-bold">
                  Senha
                  <input
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="mt-1 h-12 w-full rounded-xl border px-3 font-normal"
                  />
                </label>
                <Button
                  disabled={loading || !email || password.length < 8}
                  className="h-12 w-full"
                  onClick={() => void finishIdentity()}
                >
                  {loading ? (
                    <LoaderCircle className="animate-spin" />
                  ) : (
                    "Continuar para o pagamento"
                  )}
                </Button>
                <button
                  type="button"
                  onClick={() => setIdentityStep("PHONE")}
                  className="w-full text-sm font-bold text-violet-700"
                >
                  Usar outro WhatsApp
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function campaignAccent(campaign: Campaign) {
  const custom =
    campaign.customization?.useOrganizerDefaults === false
      ? String(
          campaign.customization.configuration.buttonColor ||
            campaign.customization.configuration.primaryColor ||
            "",
        )
      : "";
  if (/^#[0-9A-Fa-f]{6}$/.test(custom)) return custom;
  const colors = {
    BLUE: "#2563EB",
    GREEN: "#16A34A",
    RED: "#DC2626",
    PURPLE: "#7C3AED",
    PINK: "#DB2777",
    ORANGE: "#EA580C",
    YELLOW: "#CA8A04",
    BLACK: "#111827",
    CUSTOM: campaign.customAccentColor || "#2563EB",
  };
  return colors[campaign.accentColorMode || "BLUE"];
}

function rouletteRoundsForQuantity(
  configuration: Record<string, unknown> | undefined,
  quantity: number,
) {
  const roulette =
    configuration?.roulette && typeof configuration.roulette === "object"
      ? (configuration.roulette as Record<string, unknown>)
      : null;
  const rules = Array.isArray(roulette?.rules) ? roulette.rules : [];
  return rules.reduce((best, entry) => {
    const rule = entry as Record<string, unknown>;
    const minimum = Math.max(1, Number(rule.minQuantity) || 1);
    const rounds = Math.max(0, Math.floor(Number(rule.rounds) || 0));
    return quantity >= minimum ? Math.max(best, rounds) : best;
  }, 0);
}

async function fetchWithTimeout(url: string, init: RequestInit = {}) {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), 15000);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    window.clearTimeout(timer);
  }
}
async function readResponse<T>(response: Response) {
  return (await response.json().catch(() => ({}))) as T;
}
function sessionMessage(value: unknown, fallback: string) {
  if (value && typeof value === "object" && "message" in value) {
    const message = (value as { message?: string | string[] }).message;
    return Array.isArray(message) ? message.join(" ") : message || fallback;
  }
  return fallback;
}
function publicError(cause: unknown) {
  if (cause instanceof DOMException && cause.name === "AbortError")
    return "A solicitação demorou mais que o esperado. Tente novamente.";
  const message =
    cause instanceof Error
      ? cause.message
      : "Não foi possível reservar seus títulos. Tente novamente.";
  if (/Unauthorized|Não autenticado/i.test(message))
    return "Sua sessão expirou. Entre novamente.";
  if (/Forbidden|permissão/i.test(message))
    return "Esta conta não possui permissão para reservar títulos.";
  return message;
}
function formatPhone(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10)
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}
