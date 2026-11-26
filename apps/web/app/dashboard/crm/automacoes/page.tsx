"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { type FormEvent, useEffect, useRef, useState } from "react";
import AutomationShortcutLink, { automationPath } from "@/components/crm/AutomationShortcutLink";
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
    key: "welcome",
    name: "Boas-vindas",
    trigger: "PURCHASE_APPROVED",
    delay: "0",
    action: "QUEUE_EXTERNAL_MESSAGE",
    message:
      "Olá, {{nome}}! Seja bem-vindo(a) à SorteX. Obrigado por participar da campanha {{campanha}}.",
  },
  {
    key: "abandoned",
    name: "Recuperar reserva abandonada",
    trigger: "RESERVATION_EXPIRED",
    delay: "15",
    action: "QUEUE_EXTERNAL_MESSAGE",
    message:
      "Olá, {{nome}}! Sua reserva expirou. Confira a campanha e tente novamente.",
  },
  {
    key: "payment",
    name: "Lembrar pagamento pendente",
    trigger: "PURCHASE_PENDING",
    delay: "30",
    action: "QUEUE_EXTERNAL_MESSAGE",
    message:
      "Olá, {{nome}}! Seu pagamento está pendente. Conclua dentro do prazo.",
  },
  {
    key: "purchase-approved",
    name: "Agradecer compra aprovada",
    trigger: "PURCHASE_APPROVED",
    delay: "0",
    action: "CREATE_NOTIFICATION",
    message: "Compra aprovada. Obrigado por participar!",
  },
  {
    key: "draw-approaching",
    name: "Lembrar sorteio próximo",
    trigger: "DRAW_APPROACHING",
    delay: "0",
    action: "CREATE_NOTIFICATION",
    message: "O sorteio está próximo. Acompanhe sua campanha.",
  },
  {
    key: "prize-won",
    name: "Divulgar cota premiada",
    trigger: "PRIZE_WON",
    delay: "0",
    action: "CREATE_NOTIFICATION",
    message: "Uma cota premiada foi encontrada.",
  },
];

type Template = (typeof automationTemplates)[number];
type Shortcut =
  | { kind: "default" | "new" | "templates" | "unknown-template" }
  | { kind: "template"; template: Template }
  | { kind: "status"; status: "ACTIVE" | "PAUSED" };

const defaultForm = {
  name: "",
  trigger: "PURCHASE_APPROVED",
  action: "CREATE_NOTIFICATION",
  delay: "0",
  message: "Acompanhamento automático da SorteX",
};

export default function Automacoes() {
  const query = useSearchParams();
  const templateKey = query.get("template");
  const status = query.get("status");
  const template = automationTemplates.find((item) => item.key === templateKey);
  const shortcut: Shortcut = template
    ? { kind: "template", template }
    : templateKey
      ? { kind: "unknown-template" }
      : query.get("action") === "new"
        ? { kind: "new" }
        : query.get("templates") === "1"
          ? { kind: "templates" }
          : status === "active" || status === "paused"
            ? { kind: "status", status: status === "active" ? "ACTIVE" : "PAUSED" }
            : { kind: "default" };
  // Local edits belong to this navigation intent, not a previous shortcut.
  const key = shortcut.kind === "template" ? shortcut.template.key
    : shortcut.kind === "status" ? shortcut.status : shortcut.kind;
  return <AutomationWorkspace key={key} shortcut={shortcut} />;
}

function AutomationWorkspace({ shortcut }: { shortcut: Shortcut }) {
  const initial = shortcut.kind === "template" ? shortcut.template : defaultForm;
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState("");
  const [refreshIndex, setRefreshIndex] = useState(0);
  const [name, setName] = useState(initial.name);
  const [triggerType, setTriggerType] = useState(initial.trigger);
  const [actionType, setActionType] = useState(initial.action);
  const [delayMinutes, setDelayMinutes] = useState(initial.delay);
  const [days, setDays] = useState("30");
  const [message, setMessage] = useState(initial.message);
  const [builderOpen, setBuilderOpen] = useState(shortcut.kind === "template" || shortcut.kind === "new");
  const [feedback, setFeedback] = useState("");
  const [testError, setTestError] = useState("");
  const [testingId, setTestingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const submitting = useRef(false);
  const [saveError, setSaveError] = useState("");
  const gallery = useRef<HTMLHeadingElement>(null);
  const list = useRef<HTMLHeadingElement>(null);
  const builder = useRef<HTMLHeadingElement>(null);
  function load() {
    setLoading(true);
    setListError("");
    setRefreshIndex((index) => index + 1);
  }
  useEffect(() => {
    let active = true;
    void automations()
      .then((result) => { if (active) setItems(result); })
      .catch(() => { if (active) setListError("Não foi possível carregar as automações."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [refreshIndex]);
  useEffect(() => {
    if (shortcut.kind === "templates" || shortcut.kind === "unknown-template") gallery.current?.focus();
    if (shortcut.kind === "status") list.current?.focus();
  }, [shortcut.kind]);
  useEffect(() => {
    if (builderOpen) builder.current?.focus();
  }, [builderOpen]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (submitting.current) return;
    submitting.current = true;
    setSaving(true);
    setFeedback("");
    setSaveError("");
    try {
      await createAutomation({
        name,
        triggerType,
        triggerConfig:
          triggerType === "NO_PURCHASE_DAYS" ? { days: Number(days) } : {},
        audienceType: "CONTACT",
        audienceConfig: {},
        actionType,
        actionConfig:
          actionType === "CREATE_NOTIFICATION" ? { title: name, message } : { message },
        delayMinutes: Number(delayMinutes),
      });
      setBuilderOpen(false);
      applyFields(defaultForm);
      setFeedback("Fluxo salvo como rascunho. Ele não foi ativado.");
      load();
    } catch (cause) {
      setSaveError(cause instanceof Error ? cause.message : "Não foi possível salvar o rascunho.");
    } finally {
      submitting.current = false;
      setSaving(false);
    }
  }

  async function runSandboxTest(id: string) {
    if (testingId) return;
    setTestingId(id);
    setFeedback("");
    setTestError("");
    try {
      const updated = await testAutomation(id);
      setItems((current) =>
        current.map((item) => item.id === id ? updated : item),
      );
      setFeedback("Teste executado no sandbox. Nenhuma mensagem externa foi enviada.");
    } catch (cause) {
      setTestError(
        cause instanceof Error ? cause.message : "Não foi possível executar o teste sandbox.",
      );
    } finally {
      setTestingId(null);
    }
  }
  function applyFields(fields: typeof defaultForm) {
    setName(fields.name);
    setTriggerType(fields.trigger);
    setDelayMinutes(fields.delay);
    setActionType(fields.action);
    setMessage(fields.message);
    setDays("30");
    setSaveError("");
  }
  function applyTemplate(template: Template) {
    applyFields(template);
    setBuilderOpen(true);
    builder.current?.focus();
  }
  const activeFilter = shortcut.kind === "status" ? shortcut.status : null;
  const visible = activeFilter ? items.filter((item) => item.status === activeFilter) : items;

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
        {testError && <p role="alert" className="mt-4 rounded-xl bg-red-50 p-3 text-sm font-bold text-red-800">{testError}</p>}
        <section className="mt-5" aria-labelledby="automation-models">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 ref={gallery} id="automation-models" tabIndex={-1} className="scroll-mt-24 text-lg font-black">
                Modelos de automação
              </h2>
              <p className="text-sm text-zinc-500">
                Comece por um fluxo seguro e personalize antes de ativar.
              </p>
            </div>
            <button
              type="button"
              disabled={saving}
              onClick={() => setBuilderOpen((value) => !value)}
              className="min-h-11 w-full rounded-xl bg-violet-700 px-5 font-bold text-white sm:w-auto"
            >
              {builderOpen ? "Fechar construtor" : "+ Nova automação"}
            </button>
          </div>
          {shortcut.kind === "unknown-template" && (
            <p className="mt-3 text-sm text-zinc-600">
              Este modelo não está disponível. Escolha um dos modelos abaixo.
            </p>
          )}
          <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
            {automationTemplates.map((template) => (
              <button
                key={template.key}
                type="button"
                disabled={saving}
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
            aria-labelledby="automation-builder"
            className="mt-5 grid gap-5 rounded-3xl border bg-white p-4 shadow-sm lg:grid-cols-[1fr_1.2fr] lg:p-6"
          >
            <section className="grid content-start gap-3 rounded-2xl bg-zinc-50 p-4">
              <h2 ref={builder} id="automation-builder" tabIndex={-1}
                className="scroll-mt-24 text-xs font-black uppercase tracking-wide text-violet-600">
                Configuração
              </h2>
              <input
                required
                value={name}
                onChange={(event) => setName(event.target.value)}
                aria-label="Nome da automação"
                placeholder="Nome da automação"
                className="h-11 rounded-xl border px-3"
              />
              <select
                aria-label="Gatilho"
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
              aria-label="Ação"
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
              aria-label="Atraso em minutos"
              placeholder="Atraso em minutos"
              className="h-11 rounded-xl border px-3"
            />
            {triggerType === "NO_PURCHASE_DAYS" && (
              <input
                type="number"
                min="1"
                value={days}
                onChange={(event) => setDays(event.target.value)}
                aria-label="Dias sem comprar"
                placeholder="Dias sem comprar"
                className="h-11 rounded-xl border px-3"
              />
            )}
            <textarea
              aria-label="Mensagem"
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              className="min-h-24 rounded-xl border p-3 lg:col-span-2"
            />
            {saveError && <p role="alert" className="text-sm text-red-700 md:col-span-2">{saveError}</p>}
            <button type="submit" disabled={saving}
              className="rounded-xl bg-violet-700 px-5 py-3 font-bold text-white disabled:opacity-50 md:col-span-2">
              {saving ? "Salvando rascunho..." : "Salvar fluxo como rascunho"}
            </button>
          </form>
        )}
        <section className="mt-5" aria-labelledby="automation-list">
          <h2 ref={list} id="automation-list" tabIndex={-1} className="scroll-mt-24 text-lg font-black">
            {activeFilter === "ACTIVE" ? "Fluxos ativos" : activeFilter === "PAUSED" ? "Fluxos pausados" : "Fluxos cadastrados"}
          </h2>
          <nav aria-label="Filtrar fluxos por status" className="my-3 flex flex-wrap gap-2">
            {([
              { label: "Todos", status: null, href: automationPath },
              { label: "Ativos", status: "ACTIVE", href: `${automationPath}?status=active` },
              { label: "Pausados", status: "PAUSED", href: `${automationPath}?status=paused` },
            ] as const).map((filter) => (
              <AutomationShortcutLink key={filter.label} href={filter.href}
                aria-current={activeFilter === filter.status ? "page" : undefined}
                className={`rounded-xl border px-3 py-2 text-sm font-bold ${activeFilter === filter.status ? "bg-violet-700 text-white" : "bg-white text-violet-700"}`}>
                {filter.label}
              </AutomationShortcutLink>
            ))}
          </nav>
          {loading ? <p role="status" className="text-sm text-zinc-600">Carregando fluxos...</p>
            : listError ? <p role="alert" className="text-sm text-red-700">{listError}</p>
            : !visible.length && <p className="text-sm text-zinc-600">Nenhum fluxo encontrado neste filtro.</p>}
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {visible.map((item) => (
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
                      type="button"
                      onClick={() => void runSandboxTest(item.id)}
                      disabled={testingId !== null}
                      className="text-sm font-bold text-violet-700 disabled:opacity-50"
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
        </section>
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
