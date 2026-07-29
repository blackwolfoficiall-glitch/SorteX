"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { FormEvent, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  ArrowDown,
  Bell,
  Clock3,
  GitBranch,
  MessageCircle,
  Play,
  Plus,
} from "lucide-react";
import CrmNav from "@/components/crm/CrmNav";
import {
  automations,
  createAutomation,
  setAutomationStatus,
  testAutomation,
} from "@/lib/crm/client";

const triggers: Record<string, string> = {
  RESERVATION_EXPIRED: "Reserva expirada",
  PURCHASE_PENDING: "Pagamento pendente",
  PURCHASE_APPROVED: "Nova compra aprovada",
  NO_PURCHASE_DAYS: "Cliente sem comprar há X dias",
  DRAW_APPROACHING: "Campanha próxima do sorteio",
  PRIZE_WON: "Saiu uma cota premiada",
  AFFILIATE_JOINED: "Novo afiliado",
  CAMPAIGN_PERCENT_SOLD: "Campanha atingiu percentual vendido",
};
const actions: Record<string, string> = {
  CREATE_NOTIFICATION: "Criar notificação interna",
  ADD_TAG: "Adicionar etiqueta",
  CHANGE_CRM_STATUS: "Alterar status do CRM",
  CREATE_TASK: "Criar tarefa",
  QUEUE_EXTERNAL_MESSAGE: "Criar comunicação sandbox",
};
const statuses: Record<string, string> = {
  DRAFT: "Rascunho",
  ACTIVE: "Ativa",
  PAUSED: "Pausada",
  ENDED: "Encerrada",
  CANCELLED: "Cancelada",
};
const automationTemplates = [
  {
    name: "Boas-vindas",
    trigger: "PURCHASE_APPROVED",
    delay: "0",
    action: "QUEUE_EXTERNAL_MESSAGE",
    message:
      "Olá, {{nome}}! Seja bem-vindo(a) à SorteX. Obrigado por participar da campanha {{campanha}}.",
  },
  {
    name: "Recuperar reserva abandonada",
    trigger: "RESERVATION_EXPIRED",
    delay: "15",
    action: "QUEUE_EXTERNAL_MESSAGE",
    message:
      "Olá, {{nome}}! Sua reserva expirou. Confira a campanha e tente novamente.",
  },
  {
    name: "Lembrar pagamento pendente",
    trigger: "PURCHASE_PENDING",
    delay: "30",
    action: "QUEUE_EXTERNAL_MESSAGE",
    message:
      "Olá, {{nome}}! Seu pagamento está pendente. Conclua dentro do prazo.",
  },
  {
    name: "Agradecer compra aprovada",
    trigger: "PURCHASE_APPROVED",
    delay: "0",
    action: "CREATE_NOTIFICATION",
    message: "Compra aprovada. Obrigado por participar!",
  },
  {
    name: "Lembrar sorteio próximo",
    trigger: "DRAW_APPROACHING",
    delay: "0",
    action: "CREATE_NOTIFICATION",
    message: "O sorteio está próximo. Acompanhe sua campanha.",
  },
  {
    name: "Divulgar cota premiada",
    trigger: "PRIZE_WON",
    delay: "0",
    action: "CREATE_NOTIFICATION",
    message: "Uma cota premiada foi encontrada.",
  },
];

export default function Automacoes() {
  const searchParams = useSearchParams();
  const [items, setItems] = useState<any[]>([]);
  const [name, setName] = useState("");
  const [triggerType, setTriggerType] = useState("PURCHASE_APPROVED");
  const [actionType, setActionType] = useState("CREATE_NOTIFICATION");
  const [delayMinutes, setDelayMinutes] = useState("0");
  const [days, setDays] = useState("30");
  const [message, setMessage] = useState("Acompanhamento automático da SorteX");
  const [builderOpen, setBuilderOpen] = useState(false);
  const [feedback, setFeedback] = useState("");
  const load = () => automations().then(setItems);
  useEffect(() => {
    void load();
  }, []);
  useEffect(() => {
    if (searchParams.get("template") !== "welcome") return;
    const welcome = automationTemplates.find(
      (template) => template.name === "Boas-vindas",
    );
    if (welcome) applyTemplate(welcome);
  }, [searchParams]);
  async function submit(event: FormEvent) {
    event.preventDefault();
    await createAutomation({
      name,
      triggerType,
      triggerConfig:
        triggerType === "NO_PURCHASE_DAYS" ? { days: Number(days) } : {},
      audienceType: "CONTACT",
      audienceConfig: {},
      actionType,
      actionConfig:
        actionType === "CREATE_NOTIFICATION"
          ? { title: name, message }
          : { message },
      delayMinutes: Number(delayMinutes),
    });
    setName("");
    setBuilderOpen(false);
    await load();
  }
  function applyTemplate(template: (typeof automationTemplates)[number]) {
    setName(template.name);
    setTriggerType(template.trigger);
    setDelayMinutes(template.delay);
    setActionType(template.action);
    setMessage(template.message);
    setBuilderOpen(true);
  }
  return (
    <main className="min-h-screen overflow-x-hidden bg-zinc-100 p-3 sm:p-5 lg:p-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-2xl bg-violet-100 text-violet-700">
            <GitBranch />
          </span>
          <div>
            <h1 className="text-2xl font-black sm:text-3xl">
              Construtor de automações
            </h1>
            <p className="text-sm text-zinc-500">
              Fluxos locais com execução auditável. Mensagens externas
              permanecem em sandbox.
            </p>
          </div>
        </div>
        <div className="mt-4">
          <CrmNav />
        </div>
        {feedback && <p role="status" className="mt-4 rounded-xl bg-emerald-50 p-3 text-sm font-bold text-emerald-800">{feedback}</p>}
        <section className="mt-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-black">Modelos de automação</h2>
              <p className="text-sm text-zinc-500">
                Comece por um fluxo seguro e personalize antes de ativar.
              </p>
            </div>
            <button
              onClick={() => setBuilderOpen((value) => !value)}
              className="min-h-11 w-full rounded-xl bg-violet-700 px-5 font-bold text-white sm:w-auto"
            >
              {builderOpen ? "Fechar construtor" : "+ Nova automação"}
            </button>
          </div>
          <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
            {automationTemplates.map((template) => (
              <button
                key={template.name}
                onClick={() => applyTemplate(template)}
                className="rounded-2xl border bg-white p-4 text-left transition hover:border-violet-300 hover:bg-violet-50"
              >
                <strong className="text-sm">{template.name}</strong>
                <span className="mt-2 block text-xs text-zinc-500">
                  Usar e personalizar
                </span>
              </button>
            ))}
          </div>
        </section>
        {builderOpen && (
          <form
            onSubmit={submit}
            className="mt-5 grid gap-5 rounded-3xl border bg-white p-4 shadow-sm lg:grid-cols-[1fr_1.2fr] lg:p-6"
          >
            <section className="grid content-start gap-3 rounded-2xl bg-zinc-50 p-4">
              <p className="text-xs font-black uppercase tracking-wide text-violet-600">
                Configuração
              </p>
              <input
                required
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Nome da automação"
                className="h-11 rounded-xl border px-3"
              />
              <select
                value={triggerType}
                onChange={(event) => setTriggerType(event.target.value)}
                className="h-11 rounded-xl border px-3"
              >
                {Object.entries(triggers).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </section>
            <section className="rounded-2xl border border-violet-100 bg-gradient-to-b from-violet-50 to-white p-4">
              <p className="text-xs font-black uppercase tracking-wide text-violet-600">
                Prévia do fluxo
              </p>
              <FlowNode
                icon={<Play size={18} />}
                eyebrow="Quando acontecer"
                title={triggers[triggerType]}
              />
              <FlowArrow />
              <FlowNode
                icon={<GitBranch size={18} />}
                eyebrow="Condição"
                title={
                  triggerType === "NO_PURCHASE_DAYS"
                    ? `Sem compra há ${days} dia(s)`
                    : "Validar se o evento ainda está válido"
                }
              />
              <FlowArrow />
              <FlowNode
                icon={<Clock3 size={18} />}
                eyebrow="Aguardar"
                title={
                  Number(delayMinutes)
                    ? `${delayMinutes} minuto(s)`
                    : "Executar imediatamente"
                }
              />
              <FlowArrow />
              <FlowNode
                icon={
                  actionType === "QUEUE_EXTERNAL_MESSAGE" ? (
                    <MessageCircle size={18} />
                  ) : (
                    <Bell size={18} />
                  )
                }
                eyebrow="Então"
                title={actions[actionType]}
              />
              <div className="mt-3 flex justify-center">
                <span className="inline-flex items-center gap-2 rounded-full border border-dashed border-violet-300 px-3 py-2 text-xs font-bold text-violet-600">
                  <Plus size={14} />
                  Uma ação por automação
                </span>
              </div>
            </section>
            <select
              value={actionType}
              onChange={(event) => setActionType(event.target.value)}
              className="h-11 rounded-xl border px-3"
            >
              {Object.entries(actions).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <input
              type="number"
              min="0"
              value={delayMinutes}
              onChange={(event) => setDelayMinutes(event.target.value)}
              placeholder="Atraso em minutos"
              className="h-11 rounded-xl border px-3"
            />
            {triggerType === "NO_PURCHASE_DAYS" && (
              <input
                type="number"
                min="1"
                value={days}
                onChange={(event) => setDays(event.target.value)}
                placeholder="Dias sem comprar"
                className="h-11 rounded-xl border px-3"
              />
            )}
            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              className="min-h-24 rounded-xl border p-3 lg:col-span-2"
            />
            <button className="rounded-xl bg-violet-700 px-5 py-3 font-bold text-white md:col-span-2">
              Salvar fluxo como rascunho
            </button>
          </form>
        )}
        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => (
            <article key={item.id} className="rounded-2xl bg-white p-5">
              <div className="flex justify-between">
                <strong>{item.name}</strong>
                <span className="text-xs font-bold text-violet-700">
                  {statuses[item.status] || item.status}
                </span>
              </div>
              <p className="mt-2 text-sm text-zinc-500">
                {triggers[item.triggerType] || item.triggerType} →{" "}
                {actions[item.actionType] || item.actionType}
              </p>
              <p className="mt-1 text-xs text-zinc-400">
                {item.totalRuns} execuções
              </p>
              <div className="mt-4 flex gap-3">
                {item.status !== "ACTIVE" && (
                  <button
                    onClick={() =>
                      setAutomationStatus(item.id, "ACTIVE").then(load)
                    }
                    className="text-sm font-bold text-green-700"
                  >
                    Ativar
                  </button>
                )}
                {item.status === "ACTIVE" && (
                  <>
                    <button
                      onClick={() =>
                        testAutomation(item.id).then(() => {
                          setFeedback("Teste executado no sandbox. Nenhuma mensagem externa foi enviada.");
                          return load();
                        })
                      }
                      className="text-sm font-bold text-violet-700"
                    >
                      Executar teste sandbox
                    </button>
                    <button
                      onClick={() =>
                        setAutomationStatus(item.id, "PAUSED").then(load)
                      }
                      className="text-sm font-bold text-amber-700"
                    >
                      Pausar
                    </button>
                  </>
                )}
                {item.status !== "CANCELLED" && (
                  <button
                    onClick={() =>
                      setAutomationStatus(item.id, "CANCELLED").then(load)
                    }
                    className="text-sm font-bold text-red-600"
                  >
                    Cancelar
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      </div>
    </main>
  );
}
function FlowNode({
  icon,
  eyebrow,
  title,
}: {
  icon: React.ReactNode;
  eyebrow: string;
  title: string;
}) {
  return (
    <div className="mt-3 flex items-center gap-3 rounded-2xl border bg-white p-4 shadow-sm">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-violet-100 text-violet-700">
        {icon}
      </span>
      <div>
        <p className="text-[11px] font-black uppercase text-zinc-400">
          {eyebrow}
        </p>
        <strong className="text-sm">{title}</strong>
      </div>
    </div>
  );
}
function FlowArrow() {
  return (
    <div className="grid h-8 place-items-center text-violet-400">
      <ArrowDown size={18} />
    </div>
  );
}
