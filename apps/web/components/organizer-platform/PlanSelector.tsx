"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Check, Crown, LoaderCircle } from "lucide-react";
import PremiumScope from "@/components/premium/PremiumScope";
import styles from "./plan-selector-premium.module.css";
import {
  cancelPlan,
  getCurrentPlan,
  listPlans,
  reactivatePlan,
  selectPlan,
  type CurrentPlan,
  type Plan,
} from "@/lib/organizer-platform/client";

const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export function PlanSelector({
  onboarding = false,
  embedded = false,
  premium = false,
  onCurrentChange,
}: {
  onboarding?: boolean;
  embedded?: boolean;
  premium?: boolean;
  onCurrentChange?: (current: CurrentPlan) => void;
}) {
  const router = useRouter();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [current, setCurrent] = useState<CurrentPlan | null>(null);
  const [cycle, setCycle] = useState("MONTHLY");
  const [busy, setBusy] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const load = async () => {
    const [available, selected] = await Promise.all([
      listPlans(),
      getCurrentPlan(),
    ]);
    setPlans(available);
    setCurrent(selected);
    onCurrentChange?.(selected);
  };
  useEffect(() => {
    let active = true;
    Promise.all([listPlans(), getCurrentPlan()])
      .then(([available, selected]) => {
        if (!active) return;
        setPlans(available);
        setCurrent(selected);
        onCurrentChange?.(selected);
      })
      .catch((cause) => {
        if (!active) return;
        setError(
          cause instanceof Error
            ? cause.message
            : "Não foi possível carregar os planos.",
        );
      });
    return () => {
      active = false;
    };
  }, [onCurrentChange]);
  async function choose(plan: Plan) {
    setBusy(plan.id);
    setError("");
    try {
      await selectPlan(plan.id, cycle);
      setMessage(
        "Plano ativado em ambiente de teste. Nenhuma cobrança foi realizada.",
      );
      await load();
      if (onboarding && !embedded)
        router.push("/dashboard/personalizacao?onboarding=1");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível selecionar o plano.",
      );
    } finally {
      setBusy("");
    }
  }
  async function lifecycle(action: "cancel" | "reactivate") {
    if (
      action === "cancel" &&
      !window.confirm(
        "Deseja cancelar a renovação do plano?\n\nEscolha Cancelar para não alterar o plano.",
      )
    )
      return;
    setBusy(action);
    setError("");
    try {
      await (action === "cancel" ? cancelPlan() : reactivatePlan());
      await load();
      setMessage(
        action === "cancel"
          ? "Renovação cancelada com sucesso."
          : "Plano reativado com sucesso.",
      );
    } catch {
      setError(
        action === "cancel"
          ? "Não foi possível cancelar a renovação."
          : "Não foi possível reativar o plano.",
      );
    } finally {
      setBusy("");
    }
  }
  const theme = (content: ReactNode) =>
    premium ? (
      <PremiumScope className={styles.scope}>{content}</PremiumScope>
    ) : (
      content
    );
  if (!plans.length && !error)
    return theme(
      <div className="grid min-h-64 place-items-center">
        {premium ? (
          <p role="status" className={styles.loading}>
            Carregando planos…
          </p>
        ) : (
          <LoaderCircle className="animate-spin text-violet-600" />
        )}
      </div>,
    );
  const activeId =
    current?.subscription?.status === "ACTIVE" ? current.plan?.id : null;
  return theme(
    <div
      data-plan-view={premium ? "" : undefined}
      role={premium ? "region" : undefined}
      aria-labelledby={premium ? "organizer-plan-title" : undefined}
    >
      <div
        data-plan-header
        className="flex flex-wrap items-end justify-between gap-4"
      >
        <div>
          <p
            data-plan-eyebrow
            className="text-xs font-black uppercase tracking-[.2em] text-violet-600"
          >
            SorteX Business
          </p>
          {!embedded && (
            <h1
              id={premium ? "organizer-plan-title" : undefined}
              className={
                premium ? "sx-premium-title mt-2" : "mt-2 text-3xl font-black"
              }
            >
              {onboarding ? "Escolha seu plano" : "Meu plano"}
            </h1>
          )}
          <p data-plan-muted className="mt-2 text-zinc-500">
            Recursos e limites vêm da configuração central da plataforma.
          </p>
        </div>
        <label
          data-plan-cycle
          className="rounded-xl border bg-white px-4 py-3 text-sm font-bold"
        >
          Periodicidade{" "}
          <select
            value={cycle}
            onChange={(e) => setCycle(e.target.value)}
            className="ml-3 bg-transparent outline-none"
          >
            <option value="MONTHLY">Mensal</option>
            <option value="ANNUAL">Anual</option>
            <option value="TRIAL">Teste</option>
          </select>
        </label>
      </div>
      {message && (
        <p
          data-plan-notice="success"
          role={premium ? "status" : undefined}
          className="mt-5 rounded-2xl bg-green-50 p-4 text-sm font-semibold text-green-800"
        >
          {message}
        </p>
      )}
      {error && (
        <p
          data-plan-notice="error"
          role={premium ? "alert" : undefined}
          className="mt-5 rounded-2xl bg-red-50 p-4 text-sm text-red-700"
        >
          {error}
        </p>
      )}
      {current?.plan && !onboarding && (
        <section
          data-plan-current
          aria-labelledby={premium ? "current-organizer-plan" : undefined}
          className="mt-6 rounded-3xl bg-gradient-to-r from-violet-700 to-indigo-700 p-6 text-white"
        >
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p data-plan-muted className="text-sm text-violet-100">
                Plano atual
              </p>
              {premium && current.sandbox && (
                <span className={styles.badge}>Ambiente de teste</span>
              )}
              <h2
                id={premium ? "current-organizer-plan" : undefined}
                className="mt-1 text-3xl font-black"
              >
                {current.plan.name}
              </h2>
              <p data-plan-muted className="mt-2 text-sm text-violet-100">
                Status:{" "}
                {premium
                  ? statusLabel(current.subscription?.status)
                  : current.subscription?.status === "ACTIVE"
                    ? "Ativo"
                    : "Cancelado"}{" "}
                · Início:{" "}
                {current.subscription?.startedAt
                  ? new Date(current.subscription.startedAt).toLocaleDateString(
                      "pt-BR",
                    )
                  : "—"}
              </p>
              <p data-plan-muted className="text-sm text-violet-100">
                Próxima renovação:{" "}
                {current.subscription?.nextRenewalAt
                  ? new Date(
                      current.subscription.nextRenewalAt,
                    ).toLocaleDateString("pt-BR")
                  : "Sem renovação agendada"}
              </p>
            </div>
            <div
              data-plan-consumption
              className="rounded-2xl bg-white/10 p-4 text-right"
            >
              <p className="text-sm">Consumo atual</p>
              <strong className="text-2xl">
                {current.consumption.campaigns} campanhas
              </strong>
            </div>
          </div>
          <button
            onClick={() =>
              void lifecycle(
                current.subscription?.status === "ACTIVE"
                  ? "cancel"
                  : "reactivate",
              )
            }
            className="mt-5 rounded-xl bg-white px-4 py-2 text-sm font-bold text-violet-700"
          >
            {current.subscription?.status === "ACTIVE"
              ? "Cancelar renovação"
              : "Reativar plano"}
          </button>
        </section>
      )}
      <div
        data-plan-grid
        className="mt-7 grid gap-5 md:grid-cols-2 xl:grid-cols-4"
      >
        {plans.map((plan, index) => (
          <article
            key={plan.id}
            data-plan-card={activeId === plan.id ? "active" : "standard"}
            className={`relative flex flex-col rounded-3xl border bg-white p-6 shadow-sm ${activeId === plan.id ? "border-violet-600 ring-2 ring-violet-100" : "border-zinc-200"}`}
          >
            {premium && activeId === plan.id && (
              <span className={styles.badge}>Plano ativo</span>
            )}
            {!premium && index === 1 && (
              <span className="absolute -top-3 left-5 rounded-full bg-violet-600 px-3 py-1 text-xs font-black text-white">
                Mais escolhido
              </span>
            )}
            <Crown
              aria-hidden="true"
              data-plan-icon
              className="text-violet-600"
            />
            <h2 className="mt-4 text-2xl font-black">{plan.name}</h2>
            <p data-plan-muted className="mt-2 min-h-12 text-sm text-zinc-500">
              {plan.description}
            </p>
            <p className="mt-5 text-3xl font-black">
              {money.format(Number(plan.monthlyPrice))}
              <span
                data-plan-muted
                className="text-sm font-medium text-zinc-500"
              >
                /mês
              </span>
            </p>
            <p data-plan-muted className="mt-1 text-xs text-zinc-500">
              Taxa SorteX:{" "}
              {Number(plan.platformFeeRate).toLocaleString("pt-BR")}%
            </p>
            <div className="mt-5 flex-1 space-y-2">
              {plan.features.map((feature) => (
                <p key={feature.id} className="flex gap-2 text-sm">
                  <Check
                    aria-hidden="true"
                    data-plan-feature
                    size={16}
                    className="mt-0.5 shrink-0 text-green-600"
                  />
                  <span>
                    {feature.name}: <b>{formatFeature(feature.value)}</b>
                  </span>
                </p>
              ))}
            </div>
            <button
              disabled={Boolean(busy) || activeId === plan.id}
              onClick={() => void choose(plan)}
              className="mt-6 h-11 rounded-xl bg-violet-600 px-4 font-bold text-white disabled:bg-zinc-200 disabled:text-zinc-500"
            >
              {busy === plan.id
                ? "Ativando..."
                : activeId === plan.id
                  ? "Plano atual"
                  : "Escolher plano"}
            </button>
          </article>
        ))}
      </div>
    </div>,
  );
}
function statusLabel(status?: string) {
  const labels: Record<string, string> = {
    ACTIVE: "Ativo",
    TRIAL: "Em teste",
    PAST_DUE: "Pagamento pendente",
    CANCELLED: "Cancelado",
    SUSPENDED: "Suspenso",
  };
  if (!status) return "Sem assinatura registrada";
  return Object.hasOwn(labels, status) ? labels[status] : "Não informado";
}
function formatFeature(value: Plan["features"][number]["value"]) {
  if (value === true) return "Incluído";
  if (value === -1) return "Personalizado";
  const labels: Record<string, string> = {
    BASIC: "Básica",
    PROFESSIONAL: "Profissional",
    ADVANCED: "Avançada",
    ENTERPRISE: "Empresarial",
  };
  return labels[String(value)] || String(value);
}
