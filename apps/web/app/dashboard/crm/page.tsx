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
  MapPin,
  Sparkles,
  TicketX,
  TrendingUp,
  UserPlus,
  Users,
} from "lucide-react";
import CrmNav from "@/components/crm/CrmNav";
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
    Promise.all([dashboard(), getPersonalization().catch(() => null)])
      .then(([result, identity]) => {
        if (!active) return;
        setData(result);
        if (identity?.brand.publicName)
          setName(identity.brand.publicName.split(" ")[0]);
      })
      .catch(() => active && setError("Não foi possível carregar esta área."))
      .finally(() => active && setLoading(false));
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
  if (loading)
    return (
      <main className="min-h-screen bg-zinc-100 p-4 lg:p-8">
        <div className="mx-auto max-w-[1500px] animate-pulse space-y-5">
          <div className="h-24 rounded-3xl bg-white" />
          <div className="h-52 rounded-3xl bg-violet-200" />
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
              <div key={i} className="h-32 rounded-2xl bg-white" />
            ))}
          </div>
        </div>
      </main>
    );
  if (error || !data)
    return (
      <main className="grid min-h-[70vh] place-items-center bg-zinc-100 p-4">
        <div className="rounded-3xl border bg-white p-10 text-center">
          <h1 className="text-xl font-black">
            Não foi possível carregar esta área.
          </h1>
          <p className="mt-2 text-sm text-zinc-500">
            Verifique sua conexão e tente novamente.
          </p>
          <button
            onClick={() => setReload((value) => value + 1)}
            className="mt-5 rounded-xl bg-violet-700 px-5 py-3 font-bold text-white"
          >
            Tentar novamente
          </button>
        </div>
      </main>
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
    <main className="min-h-screen overflow-x-hidden bg-zinc-100 p-3 sm:p-5 lg:p-8">
      <div className="mx-auto max-w-[1500px]">
        <header className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-sm font-black uppercase tracking-wide text-violet-700">
              Relacionamento
            </p>
            <h1 className="mt-1 text-3xl font-black">CRM SorteX</h1>
            <p className="mt-2 max-w-3xl text-sm text-zinc-500 sm:text-base">
              Conheça seus compradores, organize relacionamentos e transforme
              oportunidades em novas vendas.
            </p>
            <span className="mt-2 inline-flex rounded-full bg-violet-100 px-3 py-1 text-[11px] font-black text-violet-700">
              Powered by IA SorteX
            </span>
          </div>
          <div className="flex w-full gap-2 sm:w-auto">
            <Link
              href="/dashboard/crm/contatos?action=new"
              className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-xl bg-violet-700 px-5 font-black text-white"
            >
              <UserPlus size={17} />
              Adicionar contato
            </Link>
            <Link
              href="/dashboard/crm/segmentos?action=new"
              className="flex min-h-12 flex-1 items-center justify-center rounded-xl border bg-white px-5 font-black"
            >
              Criar segmento
            </Link>
          </div>
        </header>
        <div className="mt-5">
          <CrmNav />
        </div>
        <section className="mt-5 overflow-hidden rounded-3xl bg-gradient-to-br from-violet-950 via-violet-800 to-fuchsia-700 p-6 text-white shadow-xl sm:p-8">
          <p className="text-sm font-bold text-violet-200">Olá, {name}.</p>
          <h2 className="mt-2 max-w-3xl text-2xl font-black sm:text-3xl">
            Seu relacionamento com os compradores pode gerar novas vendas hoje.
          </h2>
          <p className="mt-3 max-w-2xl text-sm text-violet-100">
            Analise contatos, recupere reservas e organize ações com ajuda da IA
            SorteX.
          </p>
          <div className="mt-6 flex flex-col gap-2 sm:flex-row">
            <a
              href="#oportunidades"
              className="rounded-xl bg-white px-5 py-3 text-center font-black text-violet-800"
            >
              Ver oportunidades
            </a>
            <Link
              href="/dashboard/crm/contatos?action=new"
              className="rounded-xl bg-white/10 px-5 py-3 text-center font-black"
            >
              Adicionar contato
            </Link>
          </div>
        </section>
        <section
          id="oportunidades"
          className="mt-5 grid gap-5 xl:grid-cols-[1.35fr_.65fr]"
        >
          <article className="rounded-3xl border bg-white p-5 sm:p-6">
            <p className="text-xs font-black uppercase tracking-wide text-violet-700">
              Oportunidades de hoje
            </p>
            <h2 className="mt-1 text-xl font-black">O que merece atenção</h2>
            {opportunities.length ? (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {opportunities.slice(0, 4).map((item) => (
                  <Link
                    key={item.title}
                    href={item.href}
                    className="group rounded-2xl bg-zinc-50 p-4 transition hover:bg-violet-50 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-200"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <h3 className="font-black">{item.title}</h3>
                      <span
                        className={`rounded-full px-2 py-1 text-[10px] font-black ${item.priority === "Alta" ? "bg-red-100 text-red-700" : item.priority === "Média" ? "bg-amber-100 text-amber-800" : "bg-blue-100 text-blue-700"}`}
                      >
                        {item.priority}
                      </span>
                    </div>
                    <p className="mt-2 text-sm text-zinc-500">{item.detail}</p>
                    <span className="mt-3 inline-flex items-center gap-1 text-xs font-black text-violet-700">
                      {item.action}
                      <ArrowRight size={14} />
                    </span>
                  </Link>
                ))}
              </div>
            ) : (
              <p className="mt-5 rounded-2xl bg-zinc-50 p-8 text-center text-sm text-zinc-500">
                Nenhuma oportunidade relevante encontrada hoje.
              </p>
            )}
          </article>
          <article className="rounded-3xl border border-violet-200 bg-violet-50 p-5 sm:p-6">
            <p className="text-xs font-black uppercase tracking-wide text-violet-700">
              IA SorteX recomenda
            </p>
            <h2 className="mt-2 text-xl font-black">
              {data.abandoned > 0
                ? "Priorize a recuperação de reservas"
                : "Mantenha a base organizada"}
            </h2>
            <p className="mt-3 text-sm leading-6 text-zinc-600">
              {data.abandoned > 0
                ? `Existem ${data.abandoned} reservas abandonadas. Revise os compradores e prepare uma comunicação antes de enviar.`
                : data.leads > 0
                  ? `Você possui ${data.leads} leads. Organize uma próxima ação para avançar o relacionamento.`
                  : "Não há evidência suficiente para recomendar uma ação urgente agora."}
            </p>
            <dl className="mt-4 space-y-2 text-xs">
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
            <div className="mt-5 flex flex-wrap gap-2">
              <Link
                href="/dashboard/crm/reservas-abandonadas"
                className="rounded-xl bg-violet-700 px-4 py-2 text-sm font-black text-white"
              >
                Ver reservas
              </Link>
              <Link
                href="/dashboard/comunicacao?tab=new&objective=ABANDONED&audience=ABANDONED"
                className="rounded-xl border border-violet-300 px-4 py-2 text-sm font-black"
              >
                Criar comunicação
              </Link>
              <Link
                href="/dashboard/crm/automacoes?template=abandoned"
                className="rounded-xl border border-violet-300 px-4 py-2 text-sm font-black"
              >
                Criar automação
              </Link>
            </div>
          </article>
        </section>
        <section className="mt-5">
          <div className="mb-3">
            <h2 className="text-xl font-black">Indicadores principais</h2>
            <p className="text-sm text-zinc-500">
              Selecione um indicador para abrir a análise correspondente.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {cards.map((card) => {
              const Icon = card.icon;
              return (
                <Link
                  key={card.label}
                  href={card.href}
                  className="group min-w-0 rounded-2xl border bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-violet-300 hover:shadow-md focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-200 sm:p-5"
                >
                  <span className="grid h-9 w-9 place-items-center rounded-xl bg-violet-50 text-violet-700">
                    <Icon size={18} />
                  </span>
                  <p className="mt-3 text-xs font-bold text-zinc-500">
                    {card.label}
                  </p>
                  <strong className="mt-1 block break-words text-xl font-black sm:text-2xl">
                    {card.value}
                  </strong>
                  <p className="mt-1 text-[11px] text-zinc-400">
                    {card.detail}
                  </p>
                </Link>
              );
            })}
          </div>
        </section>
        <section className="mt-5 grid gap-4 lg:grid-cols-3">
          <Panel title="Relacionamento" icon={<Users size={19} />}>
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
            <div className="mt-4 flex flex-wrap gap-2">
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
          <Panel title="Automações" icon={<Bot size={19} />}>
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
            <div className="mt-4 flex flex-wrap gap-2">
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
          <Panel title="Tarefas" icon={<CheckSquare size={19} />}>
            <div className="grid grid-cols-2 gap-2">
              <Mini label="Abertas" value={data.tasks} />
              <Mini label="Em andamento" value={data.tasksInProgress} />
              <Mini
                label="Vencidas"
                value={data.overdueTasks}
                alert={data.overdueTasks > 0}
              />
              <Mini label="Concluídas hoje" value={data.completedToday} />
            </div>
            <div className="mt-4 flex flex-wrap gap-2">
              <SmallLink href="/dashboard/crm/tarefas">Abrir central</SmallLink>
              <SmallLink href="/dashboard/crm/tarefas?action=new">
                Criar tarefa
              </SmallLink>
            </div>
          </Panel>
        </section>
        <section className="mt-5 grid gap-4 lg:grid-cols-[1.4fr_.6fr]">
          <Panel title="Contatos por cidade" icon={<MapPin size={19} />}>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
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
                    href={`/dashboard/crm/contatos?city=${encodeURIComponent(city.city || "")}`}
                    className="rounded-xl bg-zinc-50 p-3 transition hover:bg-violet-50"
                  >
                    <strong className="block truncate text-sm">{label}</strong>
                    <span className="mt-1 block text-xs text-zinc-500">
                      {count} contato(s) · {percent}%
                    </span>
                    <span className="mt-1 block text-xs font-bold text-zinc-700">
                      {money.format(Number(city._sum.totalSpent || 0))}
                    </span>
                    <span className="text-[10px] text-zinc-400">
                      Ticket {money.format(Number(city._avg.totalSpent || 0))}
                    </span>
                  </Link>
                );
              })}
            </div>
            {!data.cities.length && (
              <p className="rounded-xl bg-zinc-50 p-6 text-center text-sm text-zinc-500">
                Sem localização suficiente para análise.
              </p>
            )}
            <Link
              href="/dashboard/crm/contatos?cityMissing=1"
              className="mt-4 inline-flex items-center gap-2 text-sm font-black text-violet-700"
            >
              Corrigir cadastros incompletos <ArrowRight size={15} />
            </Link>
          </Panel>
          <Panel
            title="Próximas ações recomendadas"
            icon={<Clock3 size={19} />}
          >
            <div className="space-y-2">
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
        <section className="mt-5 rounded-3xl border bg-white p-5 sm:p-6">
          <h2 className="font-black">Resumo operacional</h2>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
            <Mini label="Contatos cadastrados" value={data.total} />
            <Mini label="Segmentos ativos" value={data.segments} />
            <Mini label="Automações ativas" value={data.automations} />
            <Mini label="Tarefas abertas" value={data.tasks} />
            <Mini label="Reservas abandonadas" value={data.abandoned} />
            <Mini label="Pagamentos pendentes" value={data.pendingPayments} />
          </div>
        </section>
      </div>
    </main>
  );
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
    <article className="rounded-3xl border bg-white p-5 shadow-sm">
      <h2 className="flex items-center gap-2 text-lg font-black">
        {icon}
        {title}
      </h2>
      <div className="mt-3">{children}</div>
    </article>
  );
}
function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 rounded-xl bg-white/70 p-3">
      <dt className="text-zinc-500">{label}</dt>
      <dd className="text-right font-bold">{value}</dd>
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
    <Link
      href={href}
      className="flex items-center justify-between border-b py-3 text-sm last:border-0 hover:text-violet-700"
    >
      <span className="text-zinc-500">{label}</span>
      <span className="flex items-center gap-2 font-black">
        {value}
        <ArrowRight size={14} />
      </span>
    </Link>
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
    <Link
      href={href}
      className="rounded-xl border px-3 py-2 text-xs font-black text-violet-700 hover:bg-violet-50"
    >
      {children}
    </Link>
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
    <div className={`rounded-xl p-3 ${alert ? "bg-red-50" : "bg-zinc-50"}`}>
      <span className="block text-[11px] font-bold text-zinc-500">{label}</span>
      <strong className={`mt-1 block text-lg ${alert ? "text-red-700" : ""}`}>
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
    <Link
      href={href}
      className="flex items-center justify-between gap-3 rounded-xl bg-zinc-50 p-3 text-sm transition hover:bg-violet-50"
    >
      <span>
        <b className="block">{label}</b>
        <small className="text-zinc-500">{detail}</small>
      </span>
      <ArrowRight className="text-violet-700" size={16} />
    </Link>
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
