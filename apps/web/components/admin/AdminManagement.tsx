"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useState } from "react";
import {
  BadgeCheck,
  Copy,
  LoaderCircle,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
} from "lucide-react";
import { authRequest } from "@/lib/auth/client";
import { useAuthorizedUser } from "@/components/auth/RoleGate";
import { hasAdminPermission } from "@/lib/admin/authorization";

type Mode = "approvals" | "plans" | "gateways" | "team" | "fees";
type Json = Record<string, any>;
const endpoint: Record<Mode, string> = {
  approvals: "approvals?limit=50",
  plans: "plans",
  gateways: "gateways",
  team: "team",
  fees: "approvals?limit=100",
};
const titles: Record<Mode, [string, string]> = {
  approvals: [
    "Fila de aprovações",
    "Analise cadastros, documentos e risco antes de liberar o organizador.",
  ],
  plans: ["Planos", "Valores, limites e taxa padrão aplicados pelo backend."],
  gateways: [
    "Gateways",
    "Configuração administrativa em sandbox, sem credenciais expostas.",
  ],
  team: ["Equipe SorteX", "Membros administrativos e papéis internos."],
  fees: [
    "Taxas SorteX",
    "Condições individuais, isenções e prioridade da regra de taxa.",
  ],
};

export default function AdminManagement({ mode }: { mode: Mode }) {
  const user = useAuthorizedUser();
  const [items, setItems] = useState<Json[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [query, setQuery] = useState("");
  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const data = await authRequest<any>(
        `/api/admin/platform/${endpoint[mode]}`,
        { cache: "no-store" },
      );
      setItems(Array.isArray(data) ? data : data.data || []);
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível carregar os dados.",
      );
    } finally {
      setLoading(false);
    }
  }, [mode]);
  useEffect(() => {
    void load();
  }, [load]);
  const shown = items.filter((item) =>
    JSON.stringify(item).toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <main className="p-5 pt-20 lg:p-8">
      <div className="mx-auto max-w-7xl space-y-6">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-black uppercase tracking-[.2em] text-violet-600">
              Equipe SorteX
            </p>
            <h1 className="mt-2 text-3xl font-black">{titles[mode][0]}</h1>
            <p className="mt-1 text-slate-500">{titles[mode][1]}</p>
          </div>
          {mode !== "approvals" &&
            mode !== "fees" &&
            user &&
            hasAdminPermission(
              user,
              mode === "team" ? "USERS_WRITE" : "SETTINGS_WRITE",
            ) && <Editor mode={mode} onSaved={load} />}
        </header>
        <section className="flex flex-wrap gap-3 rounded-2xl border bg-white p-4 shadow-sm">
          <label className="relative min-w-64 flex-1">
            <Search
              className="absolute left-3 top-3 text-slate-400"
              size={19}
            />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Pesquisar"
              className="h-11 w-full rounded-xl border pl-10 pr-3"
            />
          </label>
          <button
            onClick={load}
            className="inline-flex items-center gap-2 rounded-xl border px-4 font-bold"
          >
            <RefreshCw size={18} />
            Atualizar
          </button>
        </section>
        {error && (
          <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">
            <p>{error}</p>
            <button onClick={load} className="mt-2 font-bold underline">
              Tentar novamente
            </button>
          </div>
        )}
        {loading ? (
          <div className="grid min-h-64 place-items-center">
            <LoaderCircle className="animate-spin text-violet-600" />
          </div>
        ) : (
          <List mode={mode} items={shown} />
        )}
      </div>
    </main>
  );
}

function List({ mode, items }: { mode: Mode; items: Json[] }) {
  if (!items.length)
    return (
      <div className="rounded-3xl border border-dashed bg-white p-12 text-center">
        <BadgeCheck className="mx-auto text-violet-600" />
        <h2 className="mt-4 text-xl font-black">Nenhum registro encontrado</h2>
        <p className="mt-1 text-sm text-slate-500">
          A lista será atualizada quando houver dados reais.
        </p>
      </div>
    );
  if (mode === "approvals" || mode === "fees")
    return (
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => (
          <article
            key={item.id}
            className="rounded-3xl border bg-white p-5 shadow-sm"
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="font-black">
                  {item.organizationName || item.fullName}
                </h2>
                <p className="text-sm text-slate-500">{item.user?.email}</p>
              </div>
              <Status value={item.verificationStatus} />
            </div>
            <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
              <Info
                label="Cidade/UF"
                value={`${item.city || "-"} / ${item.state || "-"}`}
              />
              <Info label="Risco" value={translate(item.riskLevel)} />
              <Info
                label="Documentos"
                value={String(item.documents?.length || 0)}
              />
              <Info
                label="Taxa atual"
                value={`${Number(item.customPlatformFee ?? item.platformFee ?? 0).toFixed(2)}%`}
              />
            </dl>
            <Link
              href={`/admin/organizadores/${item.userId}`}
              className="mt-5 flex h-11 items-center justify-center rounded-xl bg-violet-600 font-bold text-white"
            >
              {mode === "fees" ? "Gerenciar plano e taxa" : "Abrir análise"}
            </Link>
          </article>
        ))}
      </div>
    );
  return (
    <div className="overflow-hidden rounded-3xl border bg-white shadow-sm">
      <div className="divide-y">
        {items.map((item) => (
          <article
            key={item.id}
            className="grid gap-3 p-5 md:grid-cols-[1.3fr_1fr_1fr_auto] md:items-center"
          >
            <div>
              <h2 className="font-black">{item.name || item.displayName}</h2>
              <p className="text-sm text-slate-500">
                {item.email || item.code || item.provider}
              </p>
            </div>
            <p className="text-sm">
              {translate(
                item.adminTeamRole ||
                  item.status ||
                  (item.isActive ? "ACTIVE" : "INACTIVE"),
              )}
            </p>
            <p className="text-sm text-slate-500">
              {item.monthlyPrice != null
                ? `${Number(item.monthlyPrice).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}/mês`
                : item.sandboxEnabled
                  ? "Sandbox habilitado"
                  : "Sem conexão real"}
            </p>
            <Status
              value={item.status || (item.isActive ? "ACTIVE" : "INACTIVE")}
            />
          </article>
        ))}
      </div>
    </div>
  );
}

function Editor({
  mode,
  onSaved,
}: {
  mode: Exclude<Mode, "approvals" | "fees">;
  onSaved: () => void;
}) {
  const [open, setOpen] = useState(false),
    [saving, setSaving] = useState(false),
    [message, setMessage] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setMessage("");
    const form = new FormData(event.currentTarget);
    try {
      let path = "";
      let body: Json = {};
      if (mode === "plans") {
        path = "plans";
        body = {
          code: String(form.get("code")).toUpperCase().replace(/\s+/g, "_"),
          name: form.get("name"),
          description: form.get("description"),
          monthlyPrice: Number(form.get("monthlyPrice")),
          annualPrice: Number(form.get("annualPrice") || 0),
          platformFeeRate: Number(form.get("platformFeeRate")),
          campaignLimit: Number(form.get("campaignLimit") || 1),
          ticketLimit: Number(form.get("ticketLimit") || 1000),
          teamMemberLimit: Number(form.get("teamMemberLimit") || 1),
          trialDays: Number(form.get("trialDays") || 0),
          isActive: true,
          sortOrder: 99,
          reason: "Atualização pelo painel administrativo",
        };
      } else if (mode === "gateways") {
        path = "gateways";
        body = {
          provider: String(form.get("provider")).toUpperCase(),
          displayName: form.get("name"),
          status: "CONFIGURING",
          sandboxEnabled: true,
          productionEnabled: false,
          splitAvailable: Boolean(form.get("split")),
          planBillingAvailable: Boolean(form.get("billing")),
          priority: Number(form.get("priority") || 100),
          estimatedFeeRate: Number(form.get("estimatedFee") || 0),
          collectionModel: "CONSOLIDATED",
          reason: "Configuração administrativa em sandbox",
        };
      } else {
        path = "team/invite";
        body = {
          name: form.get("name"),
          email: form.get("email"),
          adminTeamRole: form.get("role"),
          reason: "Convite criado pelo Superadministrador",
        };
      }
      await authRequest(`/api/admin/platform/${path}`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      setMessage(
        mode === "team"
          ? "Convite interno criado. O membro deverá definir a senha com fluxo seguro."
          : "Configuração salva.",
      );
      onSaved();
    } catch (cause) {
      setMessage(
        cause instanceof Error ? cause.message : "Não foi possível salvar.",
      );
    } finally {
      setSaving(false);
    }
  }
  return (
    <div>
      <button
        onClick={() => setOpen((v) => !v)}
        className="inline-flex h-12 items-center gap-2 rounded-xl bg-violet-600 px-5 font-bold text-white"
      >
        <Plus size={18} />
        {mode === "plans"
          ? "Novo plano"
          : mode === "gateways"
            ? "Configurar gateway"
            : "Convidar membro"}
      </button>
      {open && (
        <form
          onSubmit={submit}
          className="mt-3 grid min-w-[min(92vw,620px)] gap-3 rounded-2xl border bg-white p-5 shadow-xl md:grid-cols-2"
        >
          {mode === "plans" ? (
            <>
              <Field name="name" label="Nome" />
              <Field name="code" label="Código" />
              <Field name="monthlyPrice" label="Valor mensal" type="number" />
              <Field name="annualPrice" label="Valor anual" type="number" />
              <Field
                name="platformFeeRate"
                label="Taxa SorteX (%)"
                type="number"
              />
              <Field
                name="campaignLimit"
                label="Limite de campanhas"
                type="number"
              />
              <Field
                name="ticketLimit"
                label="Limite de títulos"
                type="number"
              />
              <Field
                name="teamMemberLimit"
                label="Usuários da equipe"
                type="number"
              />
              <Field name="trialDays" label="Dias de teste" type="number" />
              <Field name="description" label="Descrição" />
            </>
          ) : mode === "gateways" ? (
            <>
              <Field name="provider" label="Provedor" />
              <Field name="name" label="Nome exibido" />
              <Field
                name="estimatedFee"
                label="Taxa estimada (%)"
                type="number"
              />
              <Field name="priority" label="Prioridade" type="number" />
              <Check name="split" label="Split disponível" />
              <Check name="billing" label="Cobrança de planos" />
            </>
          ) : (
            <>
              <Field name="name" label="Nome" />
              <Field name="email" label="E-mail" type="email" />
              <label className="text-sm font-bold">
                Papel
                <select
                  name="role"
                  className="mt-1 h-11 w-full rounded-xl border px-3"
                >
                  {[
                    "SUPERADMIN",
                    "ADMIN",
                    "REGISTRATION_ANALYST",
                    "FINANCE",
                    "SUPPORT",
                    "AUDIT",
                  ].map((v) => (
                    <option key={v} value={v}>
                      {translate(v)}
                    </option>
                  ))}
                </select>
              </label>
            </>
          )}
          <button
            disabled={saving}
            className="h-11 rounded-xl bg-slate-950 px-5 font-bold text-white md:col-span-2"
          >
            {saving ? "Salvando..." : "Salvar"}
          </button>
          {message && <p className="text-sm md:col-span-2">{message}</p>}
        </form>
      )}
    </div>
  );
}
function Field({
  name,
  label,
  type = "text",
}: {
  name: string;
  label: string;
  type?: string;
}) {
  return (
    <label className="text-sm font-bold">
      {label}
      <input
        required
        name={name}
        type={type}
        step={type === "number" ? "0.01" : undefined}
        className="mt-1 h-11 w-full rounded-xl border px-3"
      />
    </label>
  );
}
function Check({ name, label }: { name: string; label: string }) {
  return (
    <label className="flex items-center gap-2 rounded-xl border p-3 text-sm font-bold">
      <input type="checkbox" name={name} />
      {label}
    </label>
  );
}
function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs font-bold uppercase text-slate-400">{label}</dt>
      <dd className="mt-1 font-semibold">{value}</dd>
    </div>
  );
}
function Status({ value }: { value: string }) {
  return (
    <span className="w-fit rounded-full bg-violet-50 px-3 py-1 text-xs font-black text-violet-700">
      {translate(value)}
    </span>
  );
}
function translate(value?: string) {
  return (
    (
      {
        PENDING: "Aguardando análise",
        UNDER_REVIEW: "Em análise",
        VERIFIED: "Aprovado",
        REJECTED: "Reprovado",
        SUSPENDED: "Suspenso",
        BLOCKED: "Bloqueado",
        INCOMPLETE: "Cadastro incompleto",
        CORRECTION_REQUESTED: "Correção solicitada",
        DOCUMENT_REQUESTED: "Documentação solicitada",
        CLOSED: "Encerrado",
        LOW: "Baixo risco",
        MEDIUM: "Médio risco",
        HIGH: "Alto risco",
        MANUAL_REVIEW: "Revisão manual",
        ACTIVE: "Ativo",
        INACTIVE: "Inativo",
        SUPERADMIN: "Superadministrador",
        ADMIN: "Administrador",
        REGISTRATION_ANALYST: "Analista de cadastro",
        FINANCE: "Financeiro",
        SUPPORT: "Suporte",
        AUDIT: "Auditoria",
        CONFIGURING: "Em configuração",
      } as Record<string, string>
    )[value || ""] ||
    value ||
    "-"
  );
}
