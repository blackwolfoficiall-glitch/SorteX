"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  BarChart3,
  Bot,
  CircleDollarSign,
  ArrowUpRight,
  CreditCard,
  ListChecks,
  Radio,
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
import { versionedCoverUrl } from "@/lib/campaigns/cover-revision";
import { ownedMediaUrl } from "@/components/campaigns/CampaignDashboard";
import { getCurrentUser } from "@/lib/auth/client";
import {
  getPersonalization,
  type Brand,
} from "@/lib/organizer-platform/client";
import Image from "next/image";
import { getDashboard, type DashboardResponse } from "@/lib/api/dashboard";
import { useAuthorizedUser } from "@/components/auth/RoleGate";
import DashboardPeriodMetrics from "./DashboardPeriodMetrics";
import styles from "./organizer-dashboard-premium.module.css";
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
  const user = useAuthorizedUser();
  return user?.role === "ORGANIZER" ? <DashboardForAccount key={user.id} /> : null;
}

function DashboardForAccount() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [snapshot, setSnapshot] = useState<DashboardResponse | null>(null);
  const dashboard = snapshot?.summary;
  const [dashboardError, setDashboardError] = useState("");
  const [crm, setCrm] = useState<CrmDashboard | null>(null);
  const [organizerProfile, setOrganizerProfile] =
    useState<OrganizerProfile | null>(null);
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
          setSnapshot(dashboardResult.value);
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
      })
      .catch(() => undefined);
  }, []);
  const published = campaigns.filter((item) => item.status === "PUBLISHED");
  const totals = useMemo(
    () => ({
      revenue: campaigns.reduce((sum, item) => sum + item.grossRevenue, 0),
      sold: campaigns.reduce((sum, item) => sum + item.soldNumbers, 0),
    }),
    [campaigns],
  );
  if (loading)
    return (
      <div data-organizer-dashboard className={styles.dashboard}>
        <div className={styles.loading} role="status">
          <LoaderCircle aria-hidden="true" />
          Carregando painel…
        </div>
      </div>
    );
  return (
    <div data-organizer-dashboard className={styles.dashboard}>
      {organizerProfile &&
        organizerProfile.verificationStatus !== "VERIFIED" && (
          <section className={styles.approval}>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="font-black">
                  Seu cadastro está em análise pela Equipe SorteX.
                </h2>
                <VerificationStatusBadge
                  status={organizerProfile.verificationStatus}
                />
              </div>
              <p className="mt-1 text-sm">
                Você já pode configurar sua conta e preparar suas campanhas.
                Publicações e recebimentos reais serão liberados após a
                aprovação.
              </p>
              <p className="mt-1 text-xs">
                Última atualização:{" "}
                {new Date(organizerProfile.updatedAt).toLocaleString("pt-BR")}
              </p>
            </div>
            <div className="mt-4 flex shrink-0 flex-wrap gap-2 sm:mt-0">
              <Link
                href="/organizador/verificacao"
                className={styles.primary}
              >
                Acompanhar análise
              </Link>
              <Link
                href="/organizador/verificacao?edit=1"
                className={styles.actionButton}
              >
                Revisar cadastro
              </Link>
            </div>
          </section>
        )}
      <header className={styles.hero}>
        <div className={styles.heroIdentity}>
          {identity?.brand.profileImageUrl ? (
            <Image
              src={`/api/brand-assets/${identity.id}/profile`}
              width={56}
              height={56}
              unoptimized
              alt="Foto do organizador"
              className={styles.avatar}
            />
          ) : (
            <span aria-hidden="true" className={styles.avatar}>
              {(identity?.brand.publicName || identity?.name || "O")
                .slice(0, 2)
                .toUpperCase()}
            </span>
          )}
          <div>
            <p className={styles.eyebrow}>Visão geral</p>
            <h1 className={styles.title}>
              Bem-vindo,{" "}
              {(identity?.brand.publicName || identity?.name || "Organizador").split(" ")[0]}
            </h1>
            <p className={styles.muted}>
              Acompanhe campanhas, clientes e oportunidades em um só lugar.
            </p>
          </div>
        </div>
        <Link href="/dashboard/campanhas/nova" className={styles.primary}>
          <Plus size={19} aria-hidden="true" /> Criar campanha
        </Link>
      </header>

      <div className={styles.topGrid}>
        <DashboardPeriodMetrics snapshot={snapshot} renderedAt={renderedAt} />
        <div className={styles.shortcuts}>
          <section className={`${styles.panel} ${styles.quickPanel}`} aria-labelledby="dashboard-quick-actions">
            <header className={styles.panelHeading}>
              <div>
                <p className={styles.eyebrow}>Sua operação</p>
                <h2 id="dashboard-quick-actions">Ações rápidas</h2>
              </div>
              <span className={styles.panelIcon}><ListChecks size={20} aria-hidden="true" /></span>
            </header>
            <div className={styles.quickActions}>
              {[
                { key: "create", icon: Plus, label: "Criar campanha", href: "/dashboard/campanhas/nova", hint: "Abrir editor" },
                { key: "promotion", icon: Gift, label: "Criar promoção", href: "/dashboard/promocoes", hint: "Gerenciar benefícios" },
                { key: "coupon", icon: Ticket, label: "Criar cupom", href: "/dashboard/promocoes", hint: "Consultar cupons" },
                { key: "communication", icon: Megaphone, label: "Enviar WhatsApp", href: "/dashboard/comunicacao", hint: "Ver canais e disponibilidade" },
                { key: "ads", icon: Sparkles, label: "Impulsionar", href: `/dashboard/ads?action=create${published[0] ? `&campaignId=${published[0].id}` : ""}`, hint: "Ads · somente leitura" },
                { key: "reports", icon: BarChart3, label: "Relatórios", href: "/dashboard/financeiro", hint: "Abrir financeiro" },
              ].map(({ key, icon: Icon, label, href, hint }) => (
                <Link
                  key={key}
                  href={href}
                  className={styles.quickAction}
                  aria-label={label}
                  aria-describedby={`dashboard-action-${key}`}
                >
                  <span className={styles.quickIcon}><Icon size={18} aria-hidden="true" /></span>
                  <span>
                    <strong>{label}</strong>
                    <small id={`dashboard-action-${key}`}>{hint}</small>
                  </span>
                </Link>
              ))}
            </div>
          </section>
          <section className={styles.copilot} aria-labelledby="dashboard-copilot">
            <header className={styles.panelHeading}>
              <div>
                <p className={styles.eyebrow}>Inteligência da operação</p>
                <h2 id="dashboard-copilot">SorteX Copilot</h2>
              </div>
              <span className={styles.panelIcon}><Sparkles size={20} aria-hidden="true" /></span>
            </header>
            <p className={styles.muted}>Consulte indicadores e explore sugestões na IA SorteX. Nenhuma ação é executada automaticamente.</p>
            <Link className={styles.actionButton} href="/dashboard/ia">Abrir Copilot <ArrowUpRight size={16} aria-hidden="true" /></Link>
          </section>
        </div>
      </div>

      <section aria-labelledby="dashboard-overview" className={styles.overview}>
        <div className={styles.panelHeading}>
          <div>
            <p className={styles.eyebrow}>Conta do organizador</p>
            <h2 id="dashboard-overview">Resumo da operação</h2>
          </div>
          <p className={styles.muted}>Hoje e mês seguem o horário do servidor.</p>
        </div>
        <div className={styles.metricGrid}>
          <Metric title="Arrecadação bruta" value={money(dashboard?.grossRevenue ?? totals.revenue)} icon={CircleDollarSign} detail="Não é saldo disponível" />
          <Metric title="Recebido hoje" value={dashboard ? money(dashboard.revenueToday) : "—"} icon={TrendingUp} detail="Resumo diário do servidor" />
          <Metric title="Receita do mês" value={dashboard ? money(dashboard.revenueMonth) : "—"} icon={BarChart3} detail="Mês-calendário do servidor" />
          <Metric title="Campanhas ativas" value={String(dashboard?.activeCampaigns ?? published.length)} icon={Ticket} />
          <Metric title="Cotas vendidas" value={(dashboard?.soldTickets ?? totals.sold).toLocaleString("pt-BR")} icon={Gift} />
        </div>
      </section>
      {dashboardError && (
        <p
          role="alert"
          className={styles.notice}
        >
          {dashboardError} Os demais dados do painel continuam disponíveis.
        </p>
      )}

      <div className={styles.operationalGrid}>
        <section className={styles.panel}>
          <header className={styles.panelHeading}>
            <div>
              <p className={styles.eyebrow}>Clientes e relacionamento</p>
              <h2>CRM Inteligente</h2>
            </div>
            <span className={styles.panelIcon}><Users size={20} aria-hidden="true" /></span>
          </header>
          <dl className={styles.crmMetrics}>
            <SmallMetric label="Em risco" value={crm?.abandoned ?? "—"} />
            <SmallMetric label="VIP" value={crm?.vip ?? "—"} />
            <SmallMetric label="Leads" value={crm?.leads ?? "—"} />
          </dl>
          <div className={styles.links}>
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
        </section>
        <section className={styles.panel}>
          <header className={styles.panelHeading}>
            <div>
              <p className={styles.eyebrow}>Integrações de pagamento</p>
              <h2>Gateways</h2>
            </div>
            <span className={styles.panelIcon}><CreditCard size={20} aria-hidden="true" /></span>
          </header>
          <p className={styles.muted}>A disponibilidade depende da configuração de cada provedor.</p>
          <ActionButton label="Conferir integrações" href="/dashboard/integracoes" />
        </section>
        <section className={styles.panel}>
          <header className={styles.panelHeading}>
            <div>
              <p className={styles.eyebrow}>Histórico da operação</p>
              <h2>Atividades recentes</h2>
            </div>
            <span className={styles.panelIcon}><Radio size={20} aria-hidden="true" /></span>
          </header>
          <Empty text="A linha do tempo ainda não está disponível neste painel." />
        </section>
      </div>

      <div className={styles.detailGrid}>
        <section className={styles.panel}>
          <header className={styles.panelHeading}>
            <div>
              <p className={styles.eyebrow}>Foco e crescimento</p>
              <h2>Painel IA SorteX</h2>
            </div>
            <span className={styles.panelIcon}><Bot size={20} aria-hidden="true" /></span>
          </header>
          <p className={styles.muted}>Atalhos para análises e sugestões. Nenhuma recomendação é gerada neste painel.</p>
          <div className={styles.links}>
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
        </section>
        <section className={styles.panel}>
          <header className={styles.panelHeading}>
            <div>
              <p className={styles.eyebrow}>Gestão de campanhas</p>
              <h2>Campanhas ativas</h2>
            </div>
            <Link href="/dashboard/campanhas?status=PUBLISHED" className={styles.textLink}>
              Ver todas <ArrowUpRight aria-hidden="true" size={16} />
            </Link>
          </header>
          <div className={styles.links}>
            {published.map((campaign) => (
              <CampaignRow
                key={campaign.id}
                campaign={campaign}
                renderedAt={renderedAt}
              />
            ))}
            {!published.length && <Empty text="Nenhuma campanha publicada." />}
          </div>
        </section>
      </div>
    </div>
  );
}

function Metric({ title, value, icon: Icon, detail }: {
  title: string;
  value: string;
  icon: typeof Users;
  detail?: string;
}) {
  return (
    <div className={styles.metricCard}>
      <span className={styles.panelIcon}><Icon size={18} aria-hidden="true" /></span>
      <dl>
        <dt>{title}</dt>
        <dd>{value}</dd>
        {detail && <dd className={styles.metricDetail}>{detail}</dd>}
      </dl>
    </div>
  );
}
function SmallMetric({ label, value }: {label: string; value: string | number}) {
  return (
    <div className={styles.smallMetric}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
function ActionButton({ label, href }: { label: string; href: string }) {
  return (
    <Link href={href} className={styles.actionButton}>
      {label}<ArrowUpRight aria-hidden="true" size={16} />
    </Link>
  );
}
function Insight({ title, text, href }: {title: string; text: string; href: string}) {
  return (
    <Link
      href={href}
      aria-label={`${title}: abrir análise na IA SorteX`}
      className={styles.insight}
    >
      <span>
        <strong>{title}</strong>
        <small>{text}</small>
      </span>
      <ArrowUpRight aria-hidden="true" size={18} />
    </Link>
  );
}
function Empty({ text }: { text: string }) {
  return <p className={styles.empty}>{text}</p>;
}
function CampaignRow({
  campaign,
  renderedAt,
}: {
  campaign: Campaign;
  renderedAt: number;
}) {
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
    <div className={styles.campaign}>
      {campaign.coverImageUrl ? (
        <Image
          src={versionedCoverUrl(ownedMediaUrl(campaign.coverImageUrl), campaign.coverImageRevision)}
          alt={campaign.title}
          width={64}
          height={64}
          unoptimized
          className={styles.campaignImage}
        />
      ) : (
        <div className={styles.campaignImage}>
          <Ticket aria-hidden="true" />
        </div>
      )}
      <div className={styles.campaignDetails}>
        <h3>{campaign.title}</h3>
        <p className={styles.muted}>
          {campaign.soldNumbers} cotas vendidas · {money(campaign.grossRevenue)}{" "}
          · {days === null ? "Sem data" : `${days} dias restantes`}
        </p>
        <progress aria-label="Percentual de cotas vendidas" value={percent} max={100} className={styles.progress} />
      </div>
      <Link
        href={`/dashboard/campanhas/${campaign.id}/editar`}
        className={styles.actionButton}
      >
        Gerenciar
      </Link>
    </div>
  );
}
