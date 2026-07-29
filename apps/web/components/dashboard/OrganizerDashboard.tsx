"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  Bot,
  CircleDollarSign,
  CreditCard,
  Gift,
  LoaderCircle,
  Megaphone,
  Plus,
  Sparkles,
  Ticket,
  TrendingUp,
  Users,
} from "lucide-react";
import { getMyCampaigns } from "@/lib/campaigns/client";
import type { Campaign } from "@/lib/campaigns/types";
import { mediaUrl } from "@/components/campaigns/CampaignDashboard";
import { getCurrentUser } from "@/lib/auth/client";
import {
  getPersonalization,
  type Brand,
} from "@/lib/organizer-platform/client";
import Image from "next/image";
import { getDashboard, type DashboardSummary } from "@/lib/api/dashboard";
import {
  dashboard as getCrmDashboard,
  type CrmDashboard,
} from "@/lib/crm/client";
import { getOrganizerProfile } from "@/lib/organizers/client";
import type { OrganizerProfile } from "@/lib/organizers/types";
import VerificationStatusBadge from "@/components/organizador/VerificationStatusBadge";

const money = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function OrganizerDashboard() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [dashboard, setDashboard] = useState<DashboardSummary | null>(null);
  const [dashboardError, setDashboardError] = useState("");
  const [crm, setCrm] = useState<CrmDashboard | null>(null);
  const [organizerProfile, setOrganizerProfile] = useState<OrganizerProfile | null>(null);
  const [period, setPeriod] = useState("30 dias");
  const [renderedAt] = useState(() => Date.now());
  const [identity, setIdentity] = useState<{
    name: string;
    brand: Brand;
    id: string;
  } | null>(null);
  useEffect(() => {
    Promise.allSettled([getMyCampaigns(), getDashboard(), getCrmDashboard()])
      .then(([campaignResult, dashboardResult, crmResult]) => {
        if (campaignResult.status === "fulfilled")
          setCampaigns(campaignResult.value);
        if (dashboardResult.status === "fulfilled") {
          setDashboard(dashboardResult.value.summary);
        } else {
          setDashboardError(
            dashboardResult.reason instanceof Error
              ? dashboardResult.reason.message
              : "Não foi possível carregar os indicadores.",
          );
        }
        if (crmResult.status === "fulfilled") setCrm(crmResult.value);
      })
      .finally(() => setLoading(false));
  }, []);
  useEffect(() => {
    Promise.all([getCurrentUser(), getPersonalization(), getOrganizerProfile()])
      .then(([user, data, profile]) => {
        setIdentity({ name: user.name, brand: data.brand, id: user.id });
        setOrganizerProfile(profile);
      },
      )
      .catch(() => undefined);
  }, []);
  const published = campaigns.filter((item) => item.status === "PUBLISHED");
  const totals = useMemo(
    () => ({
      revenue: campaigns.reduce((sum, item) => sum + item.grossRevenue, 0),
      sold: campaigns.reduce((sum, item) => sum + item.soldNumbers, 0),
      participants: campaigns.reduce((sum, item) => sum + item.soldNumbers, 0),
    }),
    [campaigns],
  );
  const averageTicket =
    dashboard?.averageTicket ??
    (totals.sold ? totals.revenue / totals.sold : 0);

  if (loading)
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <LoaderCircle className="animate-spin text-violet-700" />
      </div>
    );
  return (
    <div className="space-y-7">
      {organizerProfile && organizerProfile.verificationStatus !== "VERIFIED" && (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-amber-950 sm:flex sm:items-center sm:justify-between sm:gap-5">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-black">Seu cadastro está em análise pela Equipe SorteX.</h2>
              <VerificationStatusBadge status={organizerProfile.verificationStatus} />
            </div>
            <p className="mt-1 text-sm text-amber-900">
              Você já pode configurar sua conta e preparar suas campanhas. Publicações e recebimentos reais serão liberados após a aprovação.
            </p>
            <p className="mt-1 text-xs text-amber-700">
              Última atualização: {new Date(organizerProfile.updatedAt).toLocaleString("pt-BR")}
            </p>
          </div>
          <div className="mt-4 flex shrink-0 flex-wrap gap-2 sm:mt-0">
            <Link href="/organizador/verificacao" className="rounded-xl bg-amber-900 px-4 py-2.5 text-sm font-bold text-white">Acompanhar análise</Link>
            <Link href="/organizador/verificacao?edit=1" className="rounded-xl border border-amber-300 bg-white px-4 py-2.5 text-sm font-bold">Revisar cadastro</Link>
          </div>
        </section>
      )}
      <header className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-4">
          {identity?.brand.profileImageUrl ? (
            <Image
              src={`/api/brand-assets/${identity.id}/profile`}
              width={64}
              height={64}
              unoptimized
              alt="Foto do organizador"
              className="h-16 w-16 shrink-0 rounded-full object-cover"
            />
          ) : (
            <span className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-violet-700 text-xl font-black text-white">
              {(identity?.brand.publicName || identity?.name || "O")
                .slice(0, 2)
                .toUpperCase()}
            </span>
          )}
          <div className="min-w-0">
            <p className="text-sm font-bold uppercase tracking-wider text-violet-600">
              Visão geral
            </p>
            <h1 className="mt-1 truncate text-2xl font-black sm:text-3xl">
              Bem-vindo,{" "}
              {
                (
                  identity?.brand.publicName ||
                  identity?.name ||
                  "Organizador"
                ).split(" ")[0]
              }{" "}
              👋
            </h1>
            <p className="mt-1 text-zinc-500">
              Acompanhe campanhas, clientes e oportunidades em um só lugar.
            </p>
          </div>
        </div>
        <Link
          href="/dashboard/campanhas/nova"
          className="inline-flex items-center gap-2 rounded-2xl bg-violet-700 px-5 py-3 font-bold text-white"
        >
          <Plus size={18} /> Criar campanha
        </Link>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        <Metric
          title="Saldo arrecadado"
          value={money(dashboard?.grossRevenue ?? totals.revenue)}
          icon={CircleDollarSign}
          featured
        />
        <Metric
          title="Recebido hoje"
          value={money(dashboard?.revenueToday ?? 0)}
          icon={TrendingUp}
        />
        <Metric
          title="Receita do mês"
          value={money(dashboard?.revenueMonth ?? totals.revenue)}
          icon={BarChart3}
        />
        <Metric
          title="Campanhas ativas"
          value={String(dashboard?.activeCampaigns ?? published.length)}
          icon={Ticket}
        />
        <Metric
          title="Cotas vendidas"
          value={(dashboard?.soldTickets ?? totals.sold).toLocaleString(
            "pt-BR",
          )}
          icon={Gift}
        />
      </section>
      {dashboardError && (
        <p
          role="alert"
          className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
        >
          {dashboardError} Os demais dados do painel continuam disponíveis.
        </p>
      )}

      <section className="grid gap-5 xl:grid-cols-[1.7fr_1fr]">
        <div className="rounded-3xl border bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-black">Desempenho de vendas</h2>
              <p className="text-sm text-zinc-500">
                Receita consolidada das campanhas.
              </p>
            </div>
            <div className="flex gap-2">
              {["Hoje", "7 dias", "30 dias", "12 meses"].map((item) => (
                <button
                  key={item}
                  onClick={() => setPeriod(item)}
                  className={`rounded-xl px-3 py-2 text-xs font-bold ${period === item ? "bg-violet-700 text-white" : "bg-zinc-100"}`}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-8 flex h-56 items-end gap-3 rounded-2xl bg-gradient-to-b from-violet-50/70 to-white px-4 pt-10">
            {[28, 42, 35, 60, 48, 74, 66, 82, 58, 90, 72, 96].map(
              (height, index) => (
                <div
                  key={index}
                  className="flex-1 rounded-t-lg bg-gradient-to-t from-violet-700 to-violet-400"
                  style={{ height: `${totals.revenue ? height : 6}%` }}
                />
              ),
            )}
          </div>
          <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-4">
            <SmallMetric
              label="Participantes"
              value={dashboard?.participants ?? totals.participants}
            />
            <SmallMetric label="Ticket médio" value={money(averageTicket)} />
            <SmallMetric label="Conversão" value="—" />
            <SmallMetric label="Visitantes" value="—" />
          </div>
        </div>
        <div className="space-y-5">
          <div className="rounded-3xl bg-zinc-950 p-6 text-white">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-zinc-400">Gateway conectado</p>
                <h2 className="mt-1 text-xl font-black">Mercado Pago</h2>
              </div>
              <CreditCard className="text-violet-400" />
            </div>
            <div className="mt-5 flex justify-between border-t border-zinc-800 pt-4 text-sm">
              <span>Taxa média</span>
              <strong>Conforme contrato</strong>
            </div>
            <Link
              href="/organizador/gateways/mercado-pago"
              className="mt-5 block rounded-xl bg-white py-3 text-center text-sm font-bold text-zinc-950"
            >
              Configurar Gateway
            </Link>
          </div>
          <div className="rounded-3xl border bg-white p-6">
            <h2 className="text-xl font-black">CRM Inteligente</h2>
            <div className="mt-4 grid grid-cols-3 gap-2">
              <SmallMetric label="Em risco" value={crm?.abandoned ?? "—"} />
              <SmallMetric label="VIP" value={crm?.vip ?? "—"} />
              <SmallMetric label="Leads" value={crm?.leads ?? "—"} />
            </div>
            <div className="mt-4 grid gap-2">
              <ActionButton
                label="Recuperar clientes"
                href="/dashboard/crm/contatos?status=INACTIVE&origin=dashboard"
              />
              <ActionButton
                label="Falar com VIPs"
                href="/dashboard/comunicacao?tab=new&audience=VIP&origin=dashboard"
              />
              <ActionButton
                label="Boas-vindas"
                href="/dashboard/crm/automacoes?template=welcome&origin=dashboard"
              />
            </div>
          </div>
        </div>
      </section>

      <section className="grid gap-5 xl:grid-cols-[1fr_1.7fr]">
        <div className="rounded-3xl bg-gradient-to-br from-violet-800 to-fuchsia-700 p-6 text-white">
          <div className="flex items-center gap-3">
            <Bot />
            <h2 className="text-xl font-black">Painel IA SorteX</h2>
          </div>
          <div className="mt-5 space-y-3">
            <Insight
              title="Melhor horário para vender"
              text="Disponível após reunir histórico suficiente de vendas."
              href="/dashboard/ia?analysis=sales-time&origin=dashboard"
            />
            <Insight
              title="Campanhas abaixo da média"
              text={
                published.length
                  ? "Compare o progresso das campanhas ativas abaixo."
                  : "Publique uma campanha para iniciar a análise."
              }
              href="/dashboard/ia?analysis=underperforming-campaigns&origin=dashboard"
            />
            <Insight
              title="Sugestões automáticas"
              text="Use promoções e acompanhe a evolução diária."
              href="/dashboard/ia?analysis=recommendations&origin=dashboard"
            />
            <Insight
              title="Previsão de faturamento"
              text={
                totals.revenue
                  ? `Base atual: ${money(totals.revenue)}.`
                  : "Aguardando as primeiras vendas."
              }
              href="/dashboard/ia?analysis=revenue-forecast&origin=dashboard"
            />
          </div>
        </div>
        <div className="rounded-3xl border bg-white p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-black">Campanhas ativas</h2>
            <Link
              href="/dashboard/campanhas?status=PUBLISHED"
              className="text-sm font-bold text-violet-700"
            >
              Ver todas
            </Link>
          </div>
          <div className="mt-5 space-y-4">
            {published.map((campaign) => (
              <CampaignRow key={campaign.id} campaign={campaign} renderedAt={renderedAt} />
            ))}
            {!published.length && <Empty text="Nenhuma campanha publicada." />}
          </div>
        </div>
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <div className="rounded-3xl border bg-white p-6">
          <h2 className="text-xl font-black">Atividades recentes</h2>
          <div className="mt-5">
            <Empty text="As próximas compras, PIX aprovados, afiliados e impulsionamentos aparecerão aqui." />
          </div>
        </div>
        <div className="rounded-3xl border bg-white p-6">
          <h2 className="text-xl font-black">Ações rápidas</h2>
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {[
              [Plus, "Criar campanha", "/dashboard/campanhas/nova"],
              [Gift, "Criar promoção", "/dashboard/promocoes"],
              [Megaphone, "Enviar WhatsApp", "/dashboard/comunicacao"],
              [Ticket, "Criar cupom", "/dashboard/promocoes"],
              [
                Sparkles,
                "Impulsionar",
                `/dashboard/ads?action=create${published[0] ? `&campaignId=${published[0].id}` : ""}`,
              ],
              [BarChart3, "Relatórios", "/dashboard/financeiro"],
            ].map(([Icon, label, href]) => (
              <Link
                key={String(label)}
                href={String(href)}
                className="rounded-2xl bg-zinc-50 p-4 text-sm font-bold hover:bg-violet-50 hover:text-violet-700"
              >
                <Icon size={20} className="mb-3" />
                {String(label)}
              </Link>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}

function Metric({
  title,
  value,
  icon: Icon,
  featured = false,
}: {
  title: string;
  value: string;
  icon: typeof Users;
  featured?: boolean;
}) {
  return (
    <div
      className={`rounded-3xl p-5 shadow-sm ${featured ? "bg-gradient-to-br from-violet-700 to-purple-600 text-white sm:col-span-2 xl:col-span-1" : "border bg-white"}`}
    >
      <Icon className={featured ? "text-violet-200" : "text-violet-700"} />
      <p
        className={`mt-5 text-sm ${featured ? "text-violet-100" : "text-zinc-500"}`}
      >
        {title}
      </p>
      <p className="mt-1 text-2xl font-black">{value}</p>
    </div>
  );
}
function SmallMetric({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <div className="rounded-2xl bg-zinc-50 p-3">
      <p className="text-xs text-zinc-500">{label}</p>
      <p className="mt-1 font-black">{value}</p>
    </div>
  );
}
function ActionButton({ label, href }: { label: string; href: string }) {
  return (
    <Link
      href={href}
      className="rounded-xl border px-3 py-2 text-left text-sm font-bold hover:border-violet-300 hover:bg-violet-50"
    >
      {label}
    </Link>
  );
}
function Insight({ title, text, href }: { title: string; text: string; href: string }) {
  return (
    <Link
      href={href}
      aria-label={`${title}: abrir análise na IA SorteX`}
      className="block rounded-2xl bg-white/10 p-4 outline-none transition hover:bg-white/20 active:scale-[.99] focus-visible:ring-2 focus-visible:ring-white"
    >
      <p className="font-bold">{title}</p>
      <p className="mt-1 text-sm text-violet-100">{text}</p>
    </Link>
  );
}
function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-2xl bg-zinc-50 p-6 text-center text-sm text-zinc-500">
      {text}
    </div>
  );
}
function CampaignRow({ campaign, renderedAt }: { campaign: Campaign; renderedAt: number }) {
  const percent = campaign.totalNumbers
    ? Math.min(100, (campaign.soldNumbers / campaign.totalNumbers) * 100)
    : 0;
  const days = campaign.drawDate
    ? Math.max(
        0,
        Math.ceil(
          (new Date(campaign.drawDate).getTime() - renderedAt) / 86400000,
        ),
      )
    : null;
  return (
    <div className="grid gap-4 rounded-2xl border p-4 sm:grid-cols-[72px_1fr_auto] sm:items-center">
      {campaign.coverImageUrl ? (
        <Image
          src={mediaUrl(campaign.coverImageUrl)}
          alt={campaign.title}
          width={64}
          height={64}
          unoptimized
          className="h-16 w-16 rounded-xl object-cover"
        />
      ) : (
        <div className="flex h-16 w-16 items-center justify-center rounded-xl bg-violet-100">
          <Ticket className="text-violet-500" />
        </div>
      )}
      <div>
        <h3 className="font-black">{campaign.title}</h3>
        <p className="mt-1 text-xs text-zinc-500">
          {campaign.soldNumbers} participantes · {money(campaign.grossRevenue)}{" "}
          · {days === null ? "Sem data" : `${days} dias restantes`}
        </p>
        <div className="mt-2 h-2 overflow-hidden rounded-full bg-zinc-100">
          <div
            className="h-full bg-violet-600"
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>
      <Link
        href={`/dashboard/campanhas/${campaign.id}/editar`}
        className="rounded-xl bg-zinc-950 px-4 py-2 text-center text-xs font-bold text-white"
      >
        Gerenciar
      </Link>
    </div>
  );
}
