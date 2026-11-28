"use client";
/* eslint-disable react-hooks/set-state-in-effect */

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Bot,
  CheckCircle2,
  CheckSquare,
  CircleDollarSign,
  Clock3,
  LoaderCircle,
  MapPin,
  Sparkles,
  TicketX,
  TrendingUp,
  UserPlus,
  Users,
} from "lucide-react";
import PremiumScope from "@/components/premium/PremiumScope";
import "./crm-overview-premium.css";
import CrmNav from "@/components/crm/CrmNav";
import AutomationShortcutLink from "@/components/crm/AutomationShortcutLink";
import { dashboard, type CrmDashboard } from "@/lib/crm/client";
import { getPersonalization } from "@/lib/organizer-platform/client";

const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export default function Crm() {
  const [data, setData] = useState<CrmDashboard | null>(null),
    [name, setName] = useState("Organizador"),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(""),
    [reload, setReload] = useState(0);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");
    dashboard()
      .then((result) => { if (active) setData(result); })
      .catch(() => { if (active) setError("Não foi possível carregar esta área."); })
      .finally(() => { if (active) setLoading(false); });
    getPersonalization()
      .then((identity) => {
        if (active) setName(identity?.brand?.publicName?.trim().split(/\s+/)[0] || "Organizador");
      })
      .catch(() => undefined);
    return () => {
      active = false;
    };
  }, [reload]);
  const opportunities = useMemo(
    () =>
      data
        ? [
            ...(data.abandoned > 0
              ? [
                  {
                    title: "Reservas abandonadas",
                    detail: `${data.abandoned} reserva(s) aguardam uma ação de recuperação.`,
                    priority: "Alta",
                    href: "/dashboard/crm/reservas-abandonadas",
                    action: "Ver reservas",
                  },
                ]
              : []),
            ...(data.pendingPayments > 0
              ? [
                  {
                    title: "Pagamentos pendentes",
                    detail: `${data.pendingPayments} compra(s) ainda aguardam confirmação.`,
                    priority: "Alta",
                    href: "/dashboard/comunicacao?tab=new&objective=PAYMENT",
                    action: "Criar comunicação",
                  },
                ]
              : []),
            ...(data.leads > 0
              ? [
                  {
                    title: "Leads para relacionamento",
                    detail: `${data.leads} contato(s) estão classificados como lead.`,
                    priority: "Média",
                    href: "/dashboard/crm/contatos?status=LEAD",
                    action: "Abrir contatos",
                  },
                ]
              : []),
            ...(data.inactive > 0
              ? [
                  {
                    title: "Clientes inativos",
                    detail: `${data.inactive} contato(s) estão marcados como inativos.`,
                    priority: "Média",
                    href: "/dashboard/crm/contatos?status=INACTIVE",
                    action: "Revisar contatos",
                  },
                ]
              : []),
            ...(data.overdueTasks > 0
              ? [
                  {
                    title: "Tarefas vencidas",
                    detail: `${data.overdueTasks} tarefa(s) passaram do prazo.`,
                    priority: "Alta",
                    href: "/dashboard/crm/tarefas?status=overdue",
                    action: "Abrir tarefas",
                  },
                ]
              : []),
            ...(data.pausedAutomations > 0
              ? [
                  {
                    title: "Automações pausadas",
                    detail: `${data.pausedAutomations} fluxo(s) estão pausados.`,
                    priority: "Baixa",
                    href: "/dashboard/crm/automacoes?status=paused",
                    action: "Revisar fluxos",
                  },
                ]
              : []),
          ]
        : [],
    [data],
  );
  if (loading || error || !data)
    return (
      <PremiumScope className="sx-crm-overview">
        <CrmHeader />
        <div className="sx-crm-navigation"><CrmNav /></div>
        <section className="sx-premium-surface sx-crm-panel">
          {loading ? (
            <p className="sx-crm-loading" role="status">
              <LoaderCircle size={20} aria-hidden="true" /> Consultando indicadores do CRM…
            </p>
          ) : (
            <>
              <p className="sx-crm-error" role="alert">Não foi possível carregar esta área.</p>
              <p className="sx-premium-muted">Verifique sua conexão e tente novamente.</p>
              <button type="button" onClick={() => setReload((value) => value + 1)}
                className="sx-premium-button sx-crm-retry" data-variant="primary">
                Tentar novamente
              </button>
            </>
          )}
        </section>
      </PremiumScope>
    );
  const cards = [
    {
      label: "Contatos",
      value: data.total,
      detail: "Base de relacionamento",
      href: "/dashboard/crm/contatos",
      icon: Users,
    },
    {
      label: "Leads",
      value: data.leads,
      detail: "Oportunidades em aberto",
      href: "/dashboard/crm/contatos?status=LEAD",
      icon: UserPlus,
    },
    {
      label: "Clientes",
      value: data.customers,
      detail: "Compradores identificados",
      href: "/dashboard/crm/contatos?status=CUSTOMER",
      icon: CheckCircle2,
    },
    {
      label: "VIP",
      value: data.vip,
      detail: "Relacionamentos prioritários",
      href: "/dashboard/crm/contatos?status=VIP",
      icon: Sparkles,
    },
    {
      label: "Total gasto",
      value: money.format(data.totalSpent),
      detail: "Valor acumulado da base",
      href: "/dashboard/crm/contatos?order=spent",
      icon: CircleDollarSign,
    },
    {
      label: "Ticket médio",
      value: money.format(data.averageSpent),
      detail: "Média das vendas aprovadas",
      href: "/dashboard/crm/contatos?order=spent",
      icon: TrendingUp,
    },
    {
      label: "Reservas abandonadas",
      value: data.abandoned,
      detail: "Possíveis recuperações",
      href: "/dashboard/crm/reservas-abandonadas",
      icon: TicketX,
    },
    {
      label: "Tarefas pendentes",
      value: data.tasks,
      detail: "Abertas ou em andamento",
      href: "/dashboard/crm/tarefas",
      icon: CheckSquare,
    },
  ];
  return (
    <PremiumScope className="sx-crm-overview">
      <CrmHeader />
      <div className="sx-crm-navigation"><CrmNav /></div>
      <section className="sx-premium-ticket sx-crm-hero" aria-labelledby="sx-crm-focus">
        <p className="sx-crm-hero-eyebrow">Olá, {name}.</p>
        <h2 id="sx-crm-focus" className="sx-premium-title">Relacionamentos em foco</h2>
        <p>Revise sua base, reservas e tarefas usando os indicadores da sua operação.</p>
        <div className="sx-crm-actions">
          <a href="#oportunidades" className="sx-premium-button">Ver oportunidades <ArrowRight size={15} aria-hidden="true" /></a>
          <Link href="/dashboard/crm/contatos?action=new" className="sx-premium-button sx-crm-hero-secondary">
            Adicionar contato
          </Link>
        </div>
      </section>
        <section
          id="oportunidades"
          className="sx-crm-grid sx-crm-grid-split" aria-label="Oportunidades"
        >
          <article className="sx-premium-surface sx-crm-panel">
            <p className="sx-crm-eyebrow">
              Oportunidades na operação
            </p>
            <h2 className="sx-premium-section">O que merece atenção</h2>
            {opportunities.length ? (
              <div className="sx-crm-opportunity-grid">
                {opportunities.slice(0, 4).map((item) => (
                  <AutomationShortcutLink
                    key={item.title}
                    href={item.href}
                    className="sx-crm-link sx-crm-inset sx-crm-opportunity"
                  >
                    <div className="sx-crm-pair">
                      <h3 className="sx-crm-strong">{item.title}</h3>
                      <span
                        className="sx-premium-badge sx-crm-priority" data-priority={item.priority}
                      >
                        Prioridade {item.priority}
                      </span>
                    </div>
                    <p className="sx-premium-muted">{item.detail}</p>
                    <span className="sx-crm-action-text">
                      {item.action}
                      <ArrowRight size={14} aria-hidden="true" />
                    </span>
                  </AutomationShortcutLink>
                ))}
              </div>
            ) : (
              <p className="sx-crm-empty sx-premium-muted">
                Nenhuma oportunidade registrada nos indicadores atuais.
              </p>
            )}
          </article>
          <article className="sx-premium-surface sx-crm-panel sx-crm-guidance">
            <p className="sx-crm-eyebrow">
              Sugestão pelos indicadores
            </p>
            <h2 className="sx-premium-section">
              {data.abandoned > 0
                ? "Priorize a recuperação de reservas"
                : "Mantenha a base organizada"}
            </h2>
            <p className="sx-premium-muted">
              {data.abandoned > 0
                ? `Existem ${data.abandoned} reservas abandonadas. Revise os compradores e consulte as opções de comunicação disponíveis.`
                : data.leads > 0
                  ? `Você possui ${data.leads} leads. Organize uma próxima ação para avançar o relacionamento.`
                  : "Não há evidência suficiente para recomendar uma ação urgente agora."}
            </p>
            <p className="sx-premium-muted">Sugestão baseada em regras do CRM, não gerada por IA. Estes atalhos não enviam mensagens.</p>
            <dl className="sx-crm-guidance-list">
              <Row
                label="Público"
                value={
                  data.abandoned > 0
                    ? "Reservas abandonadas"
                    : "Contatos do CRM"
                }
              />
              <Row
                label="Prioridade"
                value={data.abandoned > 0 ? "Alta" : "Normal"}
              />
              <Row
                label="Impacto"
                value="Estimativa indisponível sem histórico suficiente"
              />
            </dl>
            <div className="sx-crm-actions">
              <Link
                href="/dashboard/crm/reservas-abandonadas"
                className="sx-premium-button" data-variant="primary"
              >
                Ver reservas
              </Link>
              <Link
                href="/dashboard/comunicacao?tab=new&objective=ABANDONED&audience=ABANDONED"
                className="sx-premium-button"
              >
                Criar comunicação
              </Link>
              <AutomationShortcutLink
                href="/dashboard/crm/automacoes?template=abandoned"
                className="sx-premium-button"
              >
                Criar automação
              </AutomationShortcutLink>
            </div>
          </article>
        </section>
        <section aria-labelledby="sx-crm-indicators">
          <div className="mb-3">
            <h2 id="sx-crm-indicators" className="sx-premium-section">Indicadores principais</h2>
            <p className="sx-premium-muted">
              Selecione um indicador para abrir a análise correspondente.
            </p>
          </div>
          <div className="sx-crm-metrics">
            {cards.map((card) => {
              const Icon = card.icon;
              return (
                <Link
                  key={card.label}
                  href={card.href}
                  className="sx-premium-surface sx-crm-panel sx-crm-link sx-crm-metric"
                >
                  <span className="sx-crm-metric-icon">
                    <Icon size={18} aria-hidden="true" />
                  </span>
                  <p className="sx-crm-label">
                    {card.label}
                  </p>
                  <strong className="sx-crm-metric-value">
                    {card.value}
                  </strong>
                  <p className="sx-premium-muted">
                    {card.detail}
                  </p>
                </Link>
              );
            })}
          </div>
        </section>
        <section className="sx-crm-grid sx-crm-grid-triple">
          <Panel title="Relacionamento" icon={<Users size={19} aria-hidden="true" />}>
            <ActionLine
              label="Pagamentos pendentes"
              value={data.pendingPayments}
              href="/dashboard/comunicacao?tab=new&objective=PAYMENT"
            />
            <ActionLine
              label="Segmentos ativos"
              value={data.segments}
              href="/dashboard/crm/segmentos"
            />
            <ActionLine
              label="Clientes inativos"
              value={data.inactive}
              href="/dashboard/crm/contatos?status=INACTIVE"
            />
            <div className="sx-crm-actions">
              <SmallLink href="/dashboard/crm/contatos">
                Gerenciar contatos
              </SmallLink>
              <SmallLink href="/dashboard/crm/segmentos?action=new">
                Criar segmento
              </SmallLink>
              <SmallLink href="/dashboard/comunicacao?tab=new">
                Criar comunicação
              </SmallLink>
            </div>
          </Panel>
          <Panel title="Automações" icon={<Bot size={19} aria-hidden="true" />}>
            <ActionLine
              label="Fluxos ativos"
              value={data.automations}
              href="/dashboard/crm/automacoes?status=active"
            />
            <ActionLine
              label="Fluxos pausados"
              value={data.pausedAutomations}
              href="/dashboard/crm/automacoes?status=paused"
            />
            <ActionLine
              label="Reserva abandonada"
              value={data.abandoned}
              href="/dashboard/crm/automacoes?template=abandoned"
            />
            <div className="sx-crm-actions">
              <SmallLink href="/dashboard/crm/automacoes">
                Abrir automações
              </SmallLink>
              <SmallLink href="/dashboard/crm/automacoes?action=new">
                Criar automação
              </SmallLink>
              <SmallLink href="/dashboard/crm/automacoes?templates=1">
                Usar modelo pronto
              </SmallLink>
            </div>
          </Panel>
          <Panel title="Tarefas" icon={<CheckSquare size={19} aria-hidden="true" />}>
            <div className="sx-crm-mini-grid">
              <Mini label="Abertas ou em andamento" value={data.tasks} />
              <Mini label="Em andamento" value={data.tasksInProgress} />
              <Mini
                label="Vencidas"
                value={data.overdueTasks}
                alert={data.overdueTasks > 0}
              />
              <Mini label="Concluídas hoje" value={data.completedToday} />
            </div>
            <div className="sx-crm-actions">
              <SmallLink href="/dashboard/crm/tarefas">Abrir central</SmallLink>
              <SmallLink href="/dashboard/crm/tarefas?action=new">
                Criar tarefa
              </SmallLink>
            </div>
          </Panel>
        </section>
        <section className="sx-crm-grid sx-crm-grid-split">
          <Panel title="Contatos por cidade" icon={<MapPin size={19} aria-hidden="true" />}>
            <div className="sx-crm-cities">
              {data.cities.map((city) => {
                const label = city.city
                    ? titleCase(city.city)
                    : "Cidade não informada",
                  count = city._count,
                  percent = data.total
                    ? Math.round((count / data.total) * 100)
                    : 0;
                return (
                  <Link
                    key={city.city || "missing"}
                    href={city.city ? `/dashboard/crm/contatos?city=${encodeURIComponent(city.city)}` : "/dashboard/crm/contatos?cityMissing=1"}
                    className="sx-crm-link sx-crm-inset sx-crm-city"
                  >
                    <strong className="sx-crm-strong">{label}</strong>
                    <span className="sx-premium-muted">
                      {count} contato(s) · {percent}%
                    </span>
                    <span className="sx-crm-strong">
                      {formatAggregate(city._sum.totalSpent)}
                    </span>
                    <span className="sx-premium-muted">
                      Média por contato: {formatAggregate(city._avg.totalSpent)}
                    </span>
                  </Link>
                );
              })}
            </div>
            {!data.cities.length && (
              <p className="sx-crm-empty sx-premium-muted">
                Sem localização suficiente para análise.
              </p>
            )}
            <Link
              href="/dashboard/crm/contatos?cityMissing=1"
              className="sx-premium-button sx-crm-retry" data-variant="ghost"
            >
              Corrigir cadastros incompletos <ArrowRight size={15} aria-hidden="true" />
            </Link>
          </Panel>
          <Panel
            title="Próximas ações recomendadas"
            icon={<Clock3 size={19} aria-hidden="true" />}
          >
            <div className="sx-crm-stack">
              <Next
                href="/dashboard/crm/reservas-abandonadas"
                label="Recuperar reservas"
                detail={`${data.abandoned} pendente(s)`}
              />
              <Next
                href="/dashboard/crm/segmentos"
                label="Revisar segmentos"
                detail={`${data.segments} ativo(s)`}
              />
              <Next
                href="/dashboard/crm/contatos?status=LEAD"
                label="Contatar leads"
                detail={`${data.leads} lead(s)`}
              />
              <Next
                href="/dashboard/crm/automacoes?template=payment"
                label="Automatizar pagamentos"
                detail={`${data.pendingPayments} pendente(s)`}
              />
            </div>
          </Panel>
        </section>
        <section className="sx-premium-surface sx-crm-panel">
          <h2 className="sx-premium-section">Resumo operacional</h2>
          <div className="sx-crm-mini-grid sx-crm-summary">
            <Mini label="Contatos cadastrados" value={data.total} />
            <Mini label="Segmentos ativos" value={data.segments} />
            <Mini label="Automações ativas" value={data.automations} />
            <Mini label="Tarefas pendentes" value={data.tasks} />
            <Mini label="Reservas abandonadas" value={data.abandoned} />
            <Mini label="Pagamentos pendentes" value={data.pendingPayments} />
          </div>
        </section>
    </PremiumScope>
  );
}
function CrmHeader() {
  return (
    <header className="sx-crm-header">
      <div>
        <p className="sx-premium-badge">CRM Intelligence</p>
        <h1 className="sx-premium-title">CRM SorteX</h1>
        <p className="sx-premium-muted">Contatos, segmentos e oportunidades de relacionamento da sua operação.</p>
      </div>
      <div className="sx-crm-actions">
        <Link href="/dashboard/crm/contatos?action=new" className="sx-premium-button" data-variant="primary">
          <UserPlus size={17} aria-hidden="true" /> Adicionar contato
        </Link>
        <Link href="/dashboard/crm/segmentos?action=new" className="sx-premium-button">Criar segmento</Link>
      </div>
    </header>
  );
}

function formatAggregate(value: number | string | null) {
  return value !== null && value !== "" && Number.isFinite(Number(value))
    ? money.format(Number(value))
    : "Não informado";
}
function Panel({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <article className="sx-premium-surface sx-crm-panel">
      <h2 className="sx-premium-section sx-crm-panel-title">
        {icon}
        {title}
      </h2>
      <div className="sx-crm-panel-body">{children}</div>
    </article>
  );
}
function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="sx-crm-inset sx-crm-pair">
      <dt className="sx-premium-muted">{label}</dt>
      <dd className="sx-crm-strong">{value}</dd>
    </div>
  );
}
function ActionLine({
  label,
  value,
  href,
}: {
  label: string;
  value: number;
  href: string;
}) {
  return (
    <AutomationShortcutLink
      href={href}
      className="sx-crm-link sx-crm-line"
    >
      <span className="sx-premium-muted">{label}</span>
      <span className="sx-crm-action-text">
        {value}
        <ArrowRight size={14} aria-hidden="true" />
      </span>
    </AutomationShortcutLink>
  );
}
function SmallLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <AutomationShortcutLink
      href={href}
      className="sx-premium-button"
    >
      {children}
    </AutomationShortcutLink>
  );
}
function Mini({
  label,
  value,
  alert = false,
}: {
  label: string;
  value: number;
  alert?: boolean;
}) {
  return (
    <div className="sx-crm-inset" data-urgent={alert || undefined}>
      <span className="sx-crm-label">{label}</span>
      <strong className="sx-crm-mini-value">
        {value}
      </strong>
    </div>
  );
}
function Next({
  href,
  label,
  detail,
}: {
  href: string;
  label: string;
  detail: string;
}) {
  return (
    <AutomationShortcutLink
      href={href}
      className="sx-crm-link sx-crm-inset sx-crm-line"
    >
      <span>
        <b className="block">{label}</b>
        <small className="sx-premium-muted">{detail}</small>
      </span>
      <ArrowRight className="sx-crm-arrow" size={16} aria-hidden="true" />
    </AutomationShortcutLink>
  );
}
function titleCase(value: string) {
  return value
    .toLocaleLowerCase("pt-BR")
    .replace(
      /(^|\s)(\p{L})/gu,
      (_, space, letter) => `${space}${letter.toLocaleUpperCase("pt-BR")}`,
    );
}
