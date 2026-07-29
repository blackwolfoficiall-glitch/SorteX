"use client";
/* eslint-disable @typescript-eslint/no-explicit-any, react-hooks/set-state-in-effect */

import {
  FormEvent,
  Suspense,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  cancelCommunication,
  abandonedReservations,
  communications,
  contacts,
  createCommunication,
  createTemplate,
  deleteTemplate,
  duplicateTemplate,
  executeCommunication,
  previewCommunication,
  segments,
  templates,
  updateTemplate,
  type Communication,
  type CrmContact,
  type MessageTemplate,
  type Segment,
} from "@/lib/crm/client";
import { getMyCampaigns } from "@/lib/campaigns/client";
import {
  getPersonalization,
  listIntegrations,
  type OrganizerIntegration,
} from "@/lib/organizer-platform/client";
import type { Campaign } from "@/lib/campaigns/types";
import {
  AiMessageAssistant,
  AudienceFilters,
  ChannelPreview,
  QuickPrompts,
  type GeneratedCopy,
} from "@/components/communication/SmartCommunicationTools";
import {
  BarChart3,
  Bot,
  CalendarClock,
  Check,
  ChevronRight,
  FileText,
  History as HistoryIcon,
  Mail,
  MessageCircle,
  Plus,
  Send,
  Smartphone,
} from "lucide-react";

type Tab =
  "OVERVIEW" | "NEW" | "TEMPLATES" | "SCHEDULED" | "HISTORY" | "METRICS";
const tabs: Array<[Tab, string]> = [
  ["OVERVIEW", "Visão geral"],
  ["NEW", "Nova comunicação"],
  ["TEMPLATES", "Modelos"],
  ["SCHEDULED", "Agendamentos"],
  ["HISTORY", "Histórico"],
  ["METRICS", "Métricas"],
];
const tabQuery: Record<Tab, string> = {
  OVERVIEW: "overview",
  NEW: "new",
  TEMPLATES: "templates",
  SCHEDULED: "schedules",
  HISTORY: "history",
  METRICS: "metrics",
};
const queryTab: Record<string, Tab> = {
  overview: "OVERVIEW",
  new: "NEW",
  templates: "TEMPLATES",
  schedules: "SCHEDULED",
  history: "HISTORY",
  metrics: "METRICS",
};
const tabIcons: Record<Tab, typeof Send> = {
  OVERVIEW: BarChart3,
  NEW: Plus,
  TEMPLATES: FileText,
  SCHEDULED: CalendarClock,
  HISTORY: HistoryIcon,
  METRICS: BarChart3,
};
const channelOptions: Array<{
  value: string;
  label: string;
  icon: typeof Send;
  available: boolean;
}> = [
  {
    value: "WHATSAPP",
    label: "WhatsApp",
    icon: MessageCircle,
    available: true,
  },
  { value: "EMAIL", label: "E-mail", icon: Mail, available: true },
  { value: "SMS", label: "SMS", icon: Smartphone, available: true },
  { value: "PUSH", label: "Push", icon: Send, available: false },
  { value: "TELEGRAM", label: "Telegram", icon: Send, available: false },
  { value: "INSTAGRAM", label: "Instagram", icon: Send, available: false },
  {
    value: "MESSENGER",
    label: "Messenger",
    icon: MessageCircle,
    available: false,
  },
];

export default function ComunicacaoPage() {
  return (
    <Suspense fallback={<p className="p-10">Carregando comunicação...</p>}>
      <CommunicationContent />
    </Suspense>
  );
}

function CommunicationContent() {
  const query = useSearchParams();
  const router = useRouter();
  const activeTabButton = useRef<HTMLButtonElement>(null);
  const tab = queryTab[query.get("tab") || ""] || "OVERVIEW";
  const [contactRows, setContactRows] = useState<CrmContact[]>([]);
  const [segmentRows, setSegmentRows] = useState<Segment[]>([]);
  const [campaignRows, setCampaignRows] = useState<Campaign[]>([]);
  const [templateRows, setTemplateRows] = useState<MessageTemplate[]>([]);
  const [history, setHistory] = useState<Communication[]>([]);
  const [integrations, setIntegrations] = useState<OrganizerIntegration[]>([]);
  const [message, setMessage] = useState("");
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);
  const [abandonedCount, setAbandonedCount] = useState(0);
  const [organizerName, setOrganizerName] = useState("Organizador");
  const load = async () => {
    setLoading(true);
    setLoadError("");
    try {
      const [
        contactResult,
        nextSegments,
        nextCampaigns,
        nextTemplates,
        nextHistory,
        nextIntegrations,
        abandoned,
        identity,
      ] = await Promise.all([
        contacts("?limit=100"),
        segments(),
        getMyCampaigns(),
        templates(),
        communications(),
        listIntegrations(),
        abandonedReservations("?limit=5").catch(() => ({
          items: [],
          total: 0,
          pages: 0,
        })),
        getPersonalization().catch(() => null),
      ]);
      setContactRows(contactResult.items);
      setSegmentRows(nextSegments);
      setCampaignRows(nextCampaigns);
      setTemplateRows(nextTemplates);
      setHistory(nextHistory);
      setIntegrations(nextIntegrations);
      setAbandonedCount(abandoned.total);
      if (identity?.brand.publicName)
        setOrganizerName(identity.brand.publicName.split(" ")[0]);
    } catch {
      setLoadError("Não foi possível carregar esta área.");
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void load();
  }, []);
  useEffect(() => {
    activeTabButton.current?.scrollIntoView({
      behavior: "smooth",
      block: "nearest",
      inline: "center",
    });
  }, [tab]);
  function navigate(next: Tab, filter?: string) {
    const params = new URLSearchParams(query.toString());
    params.set("tab", tabQuery[next]);
    if (filter) params.set("filter", filter);
    else params.delete("filter");
    router.push(`/dashboard/comunicacao?${params.toString()}`, {
      scroll: false,
    });
  }
  const historyFilter = query.get("filter");
  const visible =
    tab === "SCHEDULED"
      ? history.filter((item) => item.status === "QUEUED")
      : tab === "HISTORY" && historyFilter
        ? history.filter((item) =>
            historyFilter === "processed"
              ? item.status === "SKIPPED"
              : historyFilter === "failed"
                ? item.status === "FAILED"
                : true,
          )
        : history;
  return (
    <main className="min-h-screen overflow-x-hidden bg-zinc-100 p-3 sm:p-5 lg:p-8">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-sm font-bold uppercase text-violet-700">
              Relacionamento
            </p>
            <h1 className="text-2xl font-black sm:text-3xl">
              Comunicação inteligente
            </h1>
            <p className="mt-1 text-zinc-500">
              Converse com seus compradores, recupere vendas e automatize
              relacionamentos em um único lugar.
            </p>
            <span className="mt-2 inline-flex rounded-full bg-violet-100 px-3 py-1 text-[11px] font-black text-violet-700">
              Powered by IA SorteX
            </span>
          </div>
          <button
            onClick={() => navigate("NEW")}
            className="min-h-12 w-full rounded-xl bg-violet-700 px-5 py-3 font-bold text-white sm:w-auto"
          >
            Nova comunicação
          </button>
        </div>
        {message && (
          <p
            role="status"
            className="mt-4 rounded-xl bg-green-50 p-3 font-bold text-green-700"
          >
            {message}
          </p>
        )}
        <div
          className="mt-5 flex snap-x snap-mandatory gap-2 overflow-x-auto rounded-2xl border bg-white p-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          role="tablist"
          aria-label="Seções de Comunicação"
        >
          {tabs.map(([value, label]) => (
            <button
              key={value}
              ref={tab === value ? activeTabButton : undefined}
              role="tab"
              aria-selected={tab === value}
              aria-current={tab === value ? "page" : undefined}
              onClick={() => navigate(value)}
              className={`flex min-h-11 shrink-0 snap-center items-center gap-2 whitespace-nowrap rounded-xl border px-4 text-sm font-bold outline-none transition focus-visible:ring-4 focus-visible:ring-violet-200 ${tab === value ? "border-violet-700 bg-violet-700 text-white shadow-sm" : "border-transparent bg-zinc-50 text-violet-700 hover:bg-violet-50"}`}
            >
              {(() => {
                const Icon = tabIcons[value];
                return <Icon size={16} />;
              })()}
              {label}
            </button>
          ))}
        </div>
        {loading ? (
          <PanelSkeleton />
        ) : loadError ? (
          <ErrorPanel retry={() => void load()} />
        ) : (
          tab === "NEW" && (
            <Composer
              initialContact={query.get("contactId") || ""}
              initialSegment={query.get("segmentId") || ""}
              initialCampaign={query.get("campaignId") || ""}
              initialAudience={query.get("audience") || ""}
              initialContacts={(query.get("contactIds") || "")
                .split(",")
                .filter(Boolean)}
              openAi={query.get("ai") === "1"}
              initialTemplate={query.get("templateId") || ""}
              contacts={contactRows}
              segments={segmentRows}
              campaigns={campaignRows}
              templates={templateRows}
              integrations={integrations}
              close={() => navigate("HISTORY")}
              done={(text) => {
                setMessage(text);
                navigate("HISTORY");
                void load();
              }}
            />
          )
        )}
        {!loading &&
          !loadError &&
          (tab === "OVERVIEW" ? (
            <Overview
              organizerName={organizerName}
              history={history}
              abandonedCount={abandonedCount}
              campaigns={campaignRows}
              integrations={integrations}
              navigate={navigate}
              routerPush={(path) => router.push(path)}
            />
          ) : tab === "TEMPLATES" ? (
            <TemplatesPanel
              items={templateRows}
              applyTemplate={(id) => {
                const params = new URLSearchParams(query.toString());
                params.set("tab", "new");
                params.set("templateId", id);
                router.push(`/dashboard/comunicacao?${params.toString()}`);
              }}
              done={(text) => {
                setMessage(text);
                void load();
              }}
            />
          ) : tab === "METRICS" ? (
            <MetricsPanel
              history={history}
              integrations={integrations}
              connect={() => router.push("/dashboard/integracoes")}
            />
          ) : tab !== "NEW" ? (
            <HistoryPanel
              items={visible}
              scheduled={tab === "SCHEDULED"}
              reload={load}
              setMessage={setMessage}
            />
          ) : null)}
      </div>
    </main>
  );
}

function Composer({
  initialContact,
  initialSegment,
  initialCampaign,
  initialAudience,
  initialContacts,
  openAi,
  initialTemplate,
  contacts: contactRows,
  segments: segmentRows,
  campaigns,
  templates: templateRows,
  integrations,
  close,
  done,
}: {
  initialContact: string;
  initialSegment: string;
  initialCampaign: string;
  initialAudience: string;
  initialContacts: string[];
  openAi: boolean;
  initialTemplate: string;
  contacts: CrmContact[];
  segments: Segment[];
  campaigns: Campaign[];
  templates: MessageTemplate[];
  integrations: OrganizerIntegration[];
  close: () => void;
  done: (message: string) => void;
}) {
  const initialTemplateRow = templateRows.find(
    (item) => item.id === initialTemplate,
  );
  const [channels, setChannels] = useState<string[]>([
    initialTemplateRow?.channel || "WHATSAPP",
  ]);
  const [objective, setObjective] = useState("CAMPAIGN");
  const [previewChannel, setPreviewChannel] = useState(
    initialTemplateRow?.channel || "WHATSAPP",
  );
  const [audienceType, setAudienceType] = useState(
    initialSegment
      ? "SEGMENT"
      : initialContact
        ? "CONTACT"
        : initialAudience || "CONTACT",
  );
  const [contactId, setContactId] = useState(initialContact);
  const [segmentId, setSegmentId] = useState(initialSegment);
  const [campaignId, setCampaignId] = useState(initialCampaign);
  const [manualIds, setManualIds] = useState<string[]>(initialContacts);
  const [templateId, setTemplateId] = useState(initialTemplate);
  const [subject, setSubject] = useState(initialTemplateRow?.subject || "");
  const [content, setContent] = useState(
    initialTemplateRow?.content || "Olá, {{nome}}!",
  );
  const [scheduledAt, setScheduledAt] = useState("");
  const [preview, setPreview] = useState<any>();
  const [error, setError] = useState("");
  const [showAi, setShowAi] = useState(openAi);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [step, setStep] = useState(1);
  const [submitting, setSubmitting] = useState(false);
  const messageInput = useRef<HTMLTextAreaElement>(null);
  const supportedChannels = useMemo(
    () =>
      channels.filter((item) => ["WHATSAPP", "EMAIL", "SMS"].includes(item)),
    [channels],
  );
  const body = {
    channel: previewChannel,
    audienceType,
    contactId: contactId || undefined,
    segmentId: segmentId || undefined,
    campaignId: campaignId || undefined,
    contactIds: manualIds,
    templateId: templateId || undefined,
    subject: subject || undefined,
    content,
    scheduledAt: scheduledAt ? new Date(scheduledAt).toISOString() : undefined,
  };
  function chooseTemplate(id: string) {
    setTemplateId(id);
    const selected = templateRows.find((item) => item.id === id);
    if (selected) {
      setChannels([selected.channel]);
      setPreviewChannel(selected.channel);
      setSubject(selected.subject || "");
      setContent(selected.content);
    }
  }
  function applyCopy(copy: GeneratedCopy) {
    setSubject(copy.subject);
    setContent(copy.content);
  }
  function insertVariable(variable: string) {
    const input = messageInput.current;
    if (!input) {
      setContent((current) => `${current}${variable}`);
      return;
    }
    const start = input.selectionStart,
      end = input.selectionEnd;
    setContent(
      (current) => `${current.slice(0, start)}${variable}${current.slice(end)}`,
    );
    queueMicrotask(() => {
      input.focus();
      input.setSelectionRange(start + variable.length, start + variable.length);
    });
  }
  async function saveAsTemplate() {
    setSavingTemplate(true);
    setError("");
    try {
      await createTemplate({
        name: subject || `Modelo ${new Date().toLocaleDateString("pt-BR")}`,
        channel: supportedChannels[0] || "WHATSAPP",
        category: "MARKETING",
        subject: subject || undefined,
        content,
        variables: { nome: true, campanha: true, link: true },
      });
      done("Mensagem salva como modelo.");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível salvar o modelo.",
      );
    } finally {
      setSavingTemplate(false);
    }
  }
  async function showPreview() {
    try {
      setError("");
      setPreview(await previewCommunication(body));
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível gerar a prévia.",
      );
    }
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    if (submitting) return;
    if (
      !window.confirm(
        scheduledAt
          ? "Confirmar este agendamento no modo sandbox? Nenhuma mensagem externa será enviada."
          : "Processar este teste no sandbox? Nenhuma mensagem externa será enviada.",
      )
    )
      return;
    setSubmitting(true);
    try {
      if (!supportedChannels.length)
        throw new Error("Selecione ao menos um canal disponível em sandbox.");
      const results = await Promise.all(
        supportedChannels.map((channel) =>
          createCommunication({ ...body, channel }),
        ),
      );
      done(
        `${results.length} canal(is) registrado(s) em sandbox para o público selecionado.`,
      );
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível registrar a comunicação.",
      );
    } finally {
      setSubmitting(false);
    }
  }
  async function saveDraft() {
    if (submitting || !supportedChannels.length) return;
    setSubmitting(true);
    setError("");
    try {
      await Promise.all(
        supportedChannels.map((channel) =>
          createCommunication({ ...body, channel, draft: true }),
        ),
      );
      done("Comunicação salva como rascunho.");
    } catch {
      setError("Não foi possível salvar a comunicação.");
    } finally {
      setSubmitting(false);
    }
  }
  return (
    <section className="mt-5 overflow-hidden rounded-2xl border bg-white shadow-sm sm:rounded-3xl">
      {showAi && (
        <AiMessageAssistant
          campaigns={campaigns}
          onApply={applyCopy}
          close={() => setShowAi(false)}
        />
      )}
      <div className="flex justify-between gap-3 border-b p-4 sm:p-6">
        <div>
          <h2 className="text-xl font-black">Nova comunicação</h2>
          <p className="text-sm text-zinc-500">
            Configure o público e confira a prévia antes de confirmar.
          </p>
        </div>
        <button onClick={close} className="font-bold text-zinc-500">
          Fechar
        </button>
      </div>
      <div className="border-b bg-zinc-50 px-4 py-4 sm:px-6">
        <div className="flex items-center gap-2 overflow-x-auto [scrollbar-width:none]">
          {["Objetivo", "Público", "Canais", "Conteúdo", "Prévia", "Envio"].map(
            (label, index) => (
              <div key={label} className="flex shrink-0 items-center gap-2">
                <span
                  className={`grid size-7 place-items-center rounded-full text-xs font-black ${step === index + 1 ? "bg-violet-700 text-white" : step > index + 1 ? "bg-emerald-100 text-emerald-700" : "bg-zinc-200 text-zinc-500"}`}
                >
                  {step > index + 1 ? <Check size={14} /> : index + 1}
                </span>
                <span
                  className={`text-xs font-bold ${step === index + 1 ? "text-violet-700" : "text-zinc-400"}`}
                >
                  {label}
                </span>
                {index < 5 && (
                  <ChevronRight size={14} className="text-zinc-300" />
                )}
              </div>
            ),
          )}
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-zinc-200">
          <div
            className="h-full rounded-full bg-violet-700 transition-all"
            style={{ width: `${(step / 6) * 100}%` }}
          />
        </div>
      </div>
      <form onSubmit={submit} className="grid gap-5 p-4 sm:p-6">
        {step === 1 && (
          <Step
            number="1"
            title="Defina o objetivo"
            description="Escolha o resultado esperado para orientar a mensagem."
          >
            <Field label="Objetivo da comunicação">
              <select
                value={objective}
                onChange={(event) => setObjective(event.target.value)}
                className="input"
              >
                <option value="CAMPAIGN">Divulgar campanha</option>
                <option value="ABANDONED">Recuperar reserva</option>
                <option value="PAYMENT">Lembrar pagamento</option>
                <option value="PROMOTION">Anunciar promoção</option>
                <option value="PRIZE">Avisar cota premiada</option>
                <option value="WINNER">Comunicar ganhador</option>
                <option value="CUSTOM">Mensagem personalizada</option>
              </select>
            </Field>
          </Step>
        )}
        {step === 3 && (
          <Step
            number="3"
            title="Escolha os canais"
            description="Você pode combinar somente canais disponíveis."
          >
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-7">
              {channelOptions.map(({ value, label, icon: Icon, available }) => {
                const selected = channels.includes(value),
                  official =
                    value === "WHATSAPP" &&
                    integrations.some(
                      (item) =>
                        item.type === "WHATSAPP" && item.status === "CONNECTED",
                    );
                return (
                  <div
                    key={value}
                    className={`relative min-h-28 rounded-2xl border p-3 text-left transition ${selected ? "border-violet-600 bg-violet-50 text-violet-800" : "bg-white hover:border-violet-200"} ${available ? "" : "opacity-55"}`}
                  >
                    <button
                      type="button"
                      disabled={!available}
                      onClick={() => {
                        setChannels((current) =>
                          selected
                            ? current.filter((item) => item !== value)
                            : [...current, value],
                        );
                        setPreviewChannel(value);
                      }}
                      className="w-full text-left disabled:cursor-not-allowed"
                    >
                      <Icon size={20} />
                      <strong className="mt-2 block text-sm">{label}</strong>
                      <small className="mt-1 block text-[11px]">
                        {official
                          ? "Canal oficial conectado"
                          : available
                            ? selected
                              ? "Selecionado em sandbox"
                              : "Disponível em sandbox"
                            : "Em breve"}
                      </small>
                      {selected && (
                        <Check className="absolute right-2 top-2" size={16} />
                      )}
                    </button>
                    {available && !official && (
                      <a
                        href="/dashboard/integracoes"
                        className="mt-2 inline-block text-[11px] font-black text-violet-700"
                      >
                        Conectar canal
                      </a>
                    )}
                  </div>
                );
              })}
            </div>
          </Step>
        )}
        {step === 2 && (
          <Step
            number="2"
            title="Defina o público"
            description="Combine filtros ou utilize segmentos existentes."
          >
            <div className="grid gap-4 lg:grid-cols-2">
              <Field label="Público">
                <select
                  value={audienceType}
                  onChange={(event) => setAudienceType(event.target.value)}
                  className="input"
                >
                  <option value="CONTACT">Contato individual</option>
                  <option value="SEGMENT">Segmento</option>
                  <option value="CAMPAIGN">Compradores de campanha</option>
                  <option value="ABANDONED">Reservas abandonadas</option>
                  <option value="MANUAL">Lista selecionada</option>
                </select>
              </Field>
              {audienceType === "CONTACT" && (
                <Field label="Contato">
                  <select
                    required
                    value={contactId}
                    onChange={(event) => setContactId(event.target.value)}
                    className="input"
                  >
                    <option value="">Selecione</option>
                    {contactRows.map((contact) => (
                      <option key={contact.id} value={contact.id}>
                        {contact.name}
                      </option>
                    ))}
                  </select>
                </Field>
              )}
              {audienceType === "SEGMENT" && (
                <Field label="Segmento">
                  <select
                    required
                    value={segmentId}
                    onChange={(event) => setSegmentId(event.target.value)}
                    className="input"
                  >
                    <option value="">Selecione</option>
                    {segmentRows.map((segment) => (
                      <option key={segment.id} value={segment.id}>
                        {segment.name}
                      </option>
                    ))}
                  </select>
                </Field>
              )}
              {audienceType === "CAMPAIGN" && (
                <CampaignSelect
                  value={campaignId}
                  set={setCampaignId}
                  rows={campaigns}
                />
              )}
              {audienceType === "MANUAL" && (
                <Field label="Contatos selecionados">
                  <select
                    multiple
                    value={manualIds}
                    onChange={(event) =>
                      setManualIds(
                        Array.from(
                          event.target.selectedOptions,
                          (option) => option.value,
                        ),
                      )
                    }
                    className="min-h-32 rounded-xl border p-3"
                  >
                    {contactRows.map((contact) => (
                      <option key={contact.id} value={contact.id}>
                        {contact.name}
                      </option>
                    ))}
                  </select>
                </Field>
              )}
              <AudienceFilters
                contacts={contactRows}
                onApply={(ids) => {
                  setManualIds(ids);
                  setAudienceType("MANUAL");
                }}
              />
            </div>
          </Step>
        )}
        {step >= 4 && (
          <Step
            number={String(step)}
            title={
              step === 4
                ? "Crie o conteúdo"
                : step === 5
                  ? "Confira a prévia"
                  : "Revise e processe"
            }
            description={
              step === 4
                ? "Use a IA SorteX, um modelo ou escreva livremente."
                : step === 5
                  ? "Valide o conteúdo em cada canal selecionado."
                  : "Confira público, canais e modo antes de confirmar."
            }
          >
            <div className="grid gap-4 lg:grid-cols-2">
              {step === 4 && (
                <>
                  <div className="lg:col-span-2 flex flex-col gap-3 sm:flex-row sm:items-center">
                    <button
                      type="button"
                      onClick={() => setShowAi(true)}
                      className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-violet-700 to-fuchsia-600 px-5 font-bold text-white"
                    >
                      <Bot size={19} />
                      Gerar mensagem com IA
                    </button>
                    <span className="text-xs text-zinc-500">
                      Gera três opções, versões curta e longa e CTA.
                    </span>
                  </div>
                  <QuickPrompts
                    campaign={campaigns.find((item) => item.id === campaignId)}
                    onApply={applyCopy}
                  />
                  <Field label="Campanha relacionada (opcional)">
                    <select
                      value={campaignId}
                      onChange={(event) => setCampaignId(event.target.value)}
                      className="input"
                    >
                      <option value="">Nenhuma</option>
                      {campaigns.map((campaign) => (
                        <option key={campaign.id} value={campaign.id}>
                          {campaign.title}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Template">
                    <select
                      value={templateId}
                      onChange={(event) => chooseTemplate(event.target.value)}
                      className="input"
                    >
                      <option value="">Mensagem livre</option>
                      {templateRows.map((template) => (
                        <option key={template.id} value={template.id}>
                          {template.name}
                        </option>
                      ))}
                    </select>
                  </Field>
                  {channels.includes("EMAIL") && (
                    <Field label="Assunto">
                      <input
                        value={subject}
                        onChange={(event) => setSubject(event.target.value)}
                        className="input"
                      />
                    </Field>
                  )}
                  <Field label="Agendar (opcional)">
                    <input
                      type="datetime-local"
                      value={scheduledAt}
                      onChange={(event) => setScheduledAt(event.target.value)}
                      className="input"
                    />
                  </Field>
                  <label className="grid gap-1 lg:col-span-2">
                    <span className="text-sm font-bold">Mensagem</span>
                    <textarea
                      ref={messageInput}
                      required
                      value={content}
                      onChange={(event) => setContent(event.target.value)}
                      className="min-h-32 rounded-xl border p-3"
                    />
                    <div
                      className="mt-2 flex flex-wrap gap-1"
                      aria-label="Inserir variável"
                    >
                      {[
                        "nome",
                        "cidade",
                        "campanha",
                        "premio",
                        "valor",
                        "quantidade",
                        "telefone",
                        "prazo",
                        "link",
                        "data",
                        "hora",
                      ].map((variable) => (
                        <button
                          key={variable}
                          type="button"
                          onClick={() => insertVariable(`{{${variable}}}`)}
                          className="rounded-lg bg-zinc-100 px-2 py-1 text-[11px] font-bold text-zinc-600 hover:bg-violet-100 hover:text-violet-700"
                        >{`{{${variable}}}`}</button>
                      ))}
                    </div>
                  </label>
                </>
              )}
              {error && (
                <p className="lg:col-span-2 rounded-xl bg-red-50 p-3 text-red-700">
                  {error}
                </p>
              )}
              {step === 5 && preview && (
                <div className="lg:col-span-2 rounded-2xl bg-violet-50 p-4">
                  <strong>
                    Prévia para {preview.recipients} destinatário(s)
                  </strong>
                  {preview.subject && (
                    <p className="mt-2 font-bold">{preview.subject}</p>
                  )}
                  <p className="mt-1 whitespace-pre-wrap">{preview.content}</p>
                </div>
              )}
              {step === 5 && (
                <div className="lg:col-span-2">
                  <div className="mb-3 flex flex-wrap gap-2">
                    {channels.map((item) => (
                      <button
                        key={item}
                        type="button"
                        onClick={() => setPreviewChannel(item)}
                        className={`rounded-full px-3 py-2 text-xs font-bold ${previewChannel === item ? "bg-violet-700 text-white" : "bg-zinc-100"}`}
                      >
                        Prévia {translate(item)}
                      </button>
                    ))}
                  </div>
                  <ChannelPreview
                    channel={previewChannel}
                    subject={subject}
                    content={content}
                  />
                  <button
                    type="button"
                    onClick={showPreview}
                    className="mt-4 rounded-xl border px-5 py-3 font-bold"
                  >
                    Atualizar destinatários e variáveis
                  </button>
                </div>
              )}
              {step === 6 && (
                <div className="lg:col-span-2 rounded-2xl bg-zinc-50 p-5">
                  <h4 className="font-black">Resumo da comunicação</h4>
                  <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                    <DetailRow
                      label="Objetivo"
                      value={objectiveLabel(objective)}
                    />
                    <DetailRow
                      label="Público"
                      value={audienceLabel(audienceType)}
                    />
                    <DetailRow
                      label="Contatos"
                      value={
                        preview
                          ? String(preview.recipients)
                          : "Confirme a prévia"
                      }
                    />
                    <DetailRow
                      label="Canais"
                      value={
                        supportedChannels.map(translate).join(", ") || "Nenhum"
                      }
                    />
                    <DetailRow
                      label="Agendamento"
                      value={
                        scheduledAt
                          ? new Date(scheduledAt).toLocaleString("pt-BR")
                          : "Processar agora"
                      }
                    />
                    <DetailRow
                      label="Modo"
                      value={"Sandbox — nenhum envio externo"}
                    />
                  </dl>
                  <p className="mt-4 rounded-xl bg-amber-50 p-3 text-sm font-bold text-amber-800">
                    Nenhuma mensagem externa será enviada. O processamento será
                    registrado apenas como teste no sandbox.
                  </p>
                </div>
              )}
              {step === 6 && (
                <div className="flex flex-wrap gap-2 lg:col-span-2">
                  <button
                    type="button"
                    onClick={showPreview}
                    className="rounded-xl border px-5 py-3 font-bold"
                  >
                    Revisar prévia
                  </button>
                  <button
                    disabled={!supportedChannels.length || submitting}
                    className="min-h-12 rounded-xl bg-violet-700 px-5 py-3 font-bold text-white disabled:opacity-40"
                  >
                    {submitting
                      ? "Processando…"
                      : scheduledAt
                        ? "Agendar no sandbox"
                        : "Processar teste no sandbox"}
                  </button>
                  <button
                    type="button"
                    disabled={submitting || !content.trim()}
                    onClick={() => void saveDraft()}
                    className="min-h-12 rounded-xl border px-5 py-3 font-bold disabled:opacity-50"
                  >
                    Salvar rascunho
                  </button>
                  <button
                    type="button"
                    disabled={savingTemplate || !content.trim()}
                    onClick={() => void saveAsTemplate()}
                    className="min-h-12 rounded-xl border border-violet-200 px-5 py-3 font-bold text-violet-700 disabled:opacity-50"
                  >
                    {savingTemplate
                      ? "Salvando modelo..."
                      : "Salvar como modelo"}
                  </button>
                </div>
              )}
            </div>
          </Step>
        )}
        <div className="sticky bottom-0 z-10 -mx-4 -mb-4 flex items-center justify-between gap-3 border-t bg-white/95 p-4 backdrop-blur sm:-mx-6 sm:-mb-6 sm:px-6">
          <button
            type="button"
            onClick={() =>
              step === 1 ? close() : setStep((current) => current - 1)
            }
            className="min-h-11 rounded-xl border px-5 font-bold"
          >
            {step === 1 ? "Fechar" : "Voltar"}
          </button>
          {step < 6 && (
            <button
              type="button"
              onClick={() => {
                if (step === 3 && !supportedChannels.length) {
                  setError("Selecione ao menos um canal disponível.");
                  return;
                }
                setError("");
                setStep((current) => current + 1);
                if (step === 4) void showPreview();
              }}
              className="min-h-11 rounded-xl bg-violet-700 px-5 font-black text-white"
            >
              Continuar
            </button>
          )}
        </div>
      </form>
    </section>
  );
}

function HistoryPanel({
  items,
  scheduled,
  reload,
  setMessage,
}: {
  items: Communication[];
  scheduled: boolean;
  reload: () => Promise<void>;
  setMessage: (value: string) => void;
}) {
  const [selected, setSelected] = useState<Communication>();
  const [search, setSearch] = useState("");
  const [channel, setChannel] = useState("");
  const [status, setStatus] = useState("");
  const filtered = items.filter(
    (item) =>
      (!channel || item.channel === channel) &&
      (!status || item.status === status) &&
      (!search ||
        `${item.subject || ""} ${item.contact.name} ${item.content}`
          .toLowerCase()
          .includes(search.toLowerCase())),
  );
  return (
    <section className="mt-5">
      <div className="mb-4 grid gap-2 rounded-2xl border bg-white p-3 sm:grid-cols-3">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar comunicação"
          aria-label="Buscar comunicação"
          className="input"
        />
        <select
          value={channel}
          onChange={(event) => setChannel(event.target.value)}
          aria-label="Filtrar por canal"
          className="input"
        >
          <option value="">Todos os canais</option>
          <option value="WHATSAPP">WhatsApp</option>
          <option value="EMAIL">E-mail</option>
          <option value="SMS">SMS</option>
        </select>
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          aria-label="Filtrar por status"
          className="input"
        >
          <option value="">Todos os status</option>
          <option value="QUEUED">Agendada</option>
          <option value="SKIPPED">Processada em sandbox</option>
          <option value="FAILED">Falhou</option>
          <option value="CANCELLED">Cancelada</option>
        </select>
      </div>
      <div className="grid gap-3">
        {filtered.map((item) => (
          <article key={item.id} className="rounded-2xl bg-white p-5 shadow-sm">
            <div className="flex flex-wrap justify-between gap-3">
              <div>
                <strong>
                  {item.subject ||
                    `${translate(item.channel)} para ${item.contact.name}`}
                </strong>
                <p className="text-sm text-zinc-500">
                  {item.contact.name} · {item.destinationMasked} ·{" "}
                  {new Date(item.scheduledAt).toLocaleString("pt-BR")}
                </p>
              </div>
              <span className="rounded-full bg-violet-50 px-3 py-1 text-xs font-bold text-violet-700">
                {translate(item.status)}
              </span>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                onClick={() => setSelected(item)}
                className="rounded-xl border px-3 py-2 text-sm font-bold"
              >
                Ver detalhes
              </button>
              {scheduled && (
                <>
                  <button
                    onClick={() =>
                      executeCommunication(item.id).then((result) => {
                        setMessage(result.message);
                        void reload();
                      })
                    }
                    className="rounded-xl bg-violet-700 px-3 py-2 text-sm font-bold text-white"
                  >
                    Executar agora em sandbox
                  </button>
                  <button
                    onClick={() => cancelCommunication(item.id).then(reload)}
                    className="rounded-xl px-3 py-2 text-sm font-bold text-red-600"
                  >
                    Cancelar
                  </button>
                </>
              )}
            </div>
            {selected?.id === item.id && (
              <div className="mt-4 rounded-xl bg-zinc-50 p-4">
                <p className="whitespace-pre-wrap text-sm">{item.content}</p>
                <p className="mt-2 text-xs text-zinc-500">
                  Resultado:{" "}
                  {item.failureReason || "Aguardando processamento sandbox"}
                </p>
              </div>
            )}
          </article>
        ))}
        {!filtered.length && (
          <p className="rounded-2xl bg-white p-10 text-center text-zinc-500">
            {scheduled
              ? "Nenhuma comunicação agendada."
              : "Nenhuma comunicação encontrada."}
          </p>
        )}
      </div>
    </section>
  );
}

function TemplatesPanel({
  items,
  done,
  applyTemplate,
}: {
  items: MessageTemplate[];
  done: (message: string) => void;
  applyTemplate: (id: string) => void;
}) {
  const [editing, setEditing] = useState<MessageTemplate>();
  const [name, setName] = useState("");
  const [channel, setChannel] = useState("WHATSAPP");
  const [subject, setSubject] = useState("");
  const [content, setContent] = useState("");
  const [search, setSearch] = useState("");
  const visibleItems = items.filter(
    (item) =>
      !search ||
      `${item.name} ${item.category} ${item.channel} ${item.subject || ""}`
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  function edit(item: MessageTemplate) {
    setEditing(item);
    setName(item.name);
    setChannel(item.channel);
    setSubject(item.subject || "");
    setContent(item.content);
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    const body = {
      name,
      channel,
      category: "MARKETING",
      subject: subject || undefined,
      content,
      variables: {},
    };
    if (editing) await updateTemplate(editing.id, body);
    else await createTemplate(body);
    setEditing(undefined);
    setName("");
    setSubject("");
    setContent("");
    done(editing ? "Template atualizado." : "Template criado.");
  }
  return (
    <section className="mt-5 grid gap-5 xl:grid-cols-[1fr_1.5fr]">
      <form onSubmit={submit} className="rounded-3xl bg-white p-5">
        <h2 className="text-lg font-black">
          {editing ? "Editar template" : "Novo template"}
        </h2>
        <input
          required
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Nome"
          className="input mt-4"
        />
        <select
          value={channel}
          onChange={(event) => setChannel(event.target.value)}
          className="input mt-3"
        >
          <option value="WHATSAPP">WhatsApp</option>
          <option value="EMAIL">E-mail</option>
          <option value="SMS">SMS</option>
        </select>
        <input
          value={subject}
          onChange={(event) => setSubject(event.target.value)}
          placeholder="Assunto"
          className="input mt-3"
        />
        <textarea
          required
          value={content}
          onChange={(event) => setContent(event.target.value)}
          placeholder="Conteúdo"
          className="mt-3 min-h-32 w-full rounded-xl border p-3"
        />
        <button className="mt-3 rounded-xl bg-violet-700 px-5 py-3 font-bold text-white">
          Salvar template
        </button>
      </form>
      <div>
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Buscar modelos"
          aria-label="Buscar modelos"
          className="input mb-3"
        />
        <div className="grid gap-3 md:grid-cols-2">
          {visibleItems.map((item) => (
            <article key={item.id} className="rounded-2xl bg-white p-5">
              <div className="flex justify-between">
                <strong>{item.name}</strong>
                <span className="text-xs font-bold text-violet-700">
                  {translate(item.channel)}
                </span>
              </div>
              <p className="mt-2 line-clamp-3 text-sm text-zinc-600">
                {item.content}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  onClick={() => applyTemplate(item.id)}
                  className="text-sm font-black text-violet-700"
                >
                  Usar
                </button>
                {!item.isSystemTemplate && (
                  <button
                    onClick={() => edit(item)}
                    className="text-sm font-bold text-violet-700"
                  >
                    Editar
                  </button>
                )}
                <button
                  onClick={() =>
                    duplicateTemplate(item.id).then(() =>
                      done("Template duplicado."),
                    )
                  }
                  className="text-sm font-bold"
                >
                  Duplicar
                </button>
                {!item.isSystemTemplate && (
                  <button
                    onClick={() =>
                      deleteTemplate(item.id).then(() =>
                        done("Template excluído."),
                      )
                    }
                    className="text-sm font-bold text-red-600"
                  >
                    Excluir
                  </button>
                )}
              </div>
            </article>
          ))}
          {!visibleItems.length && (
            <p className="rounded-2xl bg-white p-8 text-center text-zinc-500 md:col-span-2">
              Nenhum modelo criado.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="grid gap-1">
      <span className="text-sm font-bold">{label}</span>
      {children}
    </label>
  );
}
function CampaignSelect({
  value,
  set,
  rows,
}: {
  value: string;
  set: (value: string) => void;
  rows: Campaign[];
}) {
  return (
    <Field label="Campanha">
      <select
        required
        value={value}
        onChange={(event) => set(event.target.value)}
        className="input"
      >
        <option value="">Selecione</option>
        {rows.map((campaign) => (
          <option key={campaign.id} value={campaign.id}>
            {campaign.title}
          </option>
        ))}
      </select>
    </Field>
  );
}
function translate(value: string) {
  return (
    (
      {
        WHATSAPP: "WhatsApp",
        EMAIL: "E-mail",
        SMS: "SMS",
        QUEUED: "Agendada",
        SKIPPED: "Processada em sandbox",
        CANCELLED: "Cancelada",
        FAILED: "Falhou",
        DRAFT: "Rascunho",
      } as Record<string, string>
    )[value] || value
  );
}
function objectiveLabel(value: string) {
  return (
    (
      {
        CAMPAIGN: "Divulgar campanha",
        ABANDONED: "Recuperar reserva",
        PAYMENT: "Lembrar pagamento",
        PROMOTION: "Anunciar promoção",
        PRIZE: "Cota premiada",
        WINNER: "Comunicar ganhador",
        CUSTOM: "Mensagem personalizada",
      } as Record<string, string>
    )[value] || value
  );
}
function audienceLabel(value: string) {
  return (
    (
      {
        CONTACT: "Contato individual",
        SEGMENT: "Segmento",
        CAMPAIGN: "Compradores da campanha",
        ABANDONED: "Reservas abandonadas",
        MANUAL: "Seleção manual",
      } as Record<string, string>
    )[value] || value
  );
}
function Stat({
  label,
  value,
  onClick,
}: {
  label: string;
  value: string | number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className="rounded-2xl border bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-violet-300 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-violet-200"
    >
      <p className="text-xs font-bold text-zinc-500">{label}</p>
      <strong className="mt-2 block text-2xl font-black text-zinc-900">
        {value}
      </strong>
      <span className="mt-2 block text-[11px] font-black text-violet-700">
        Abrir seção →
      </span>
    </button>
  );
}
function Overview({
  organizerName,
  history,
  abandonedCount,
  campaigns,
  integrations,
  navigate,
  routerPush,
}: {
  organizerName: string;
  history: Communication[];
  abandonedCount: number;
  campaigns: Campaign[];
  integrations: OrganizerIntegration[];
  navigate: (tab: Tab, filter?: string) => void;
  routerPush: (path: string) => void;
}) {
  const failed = history.filter((item) => item.status === "FAILED").length,
    queued = history.filter((item) => item.status === "QUEUED").length,
    processed = history.filter((item) => item.status === "SKIPPED").length,
    whatsapp = integrations.some(
      (item) => item.type === "WHATSAPP" && item.status === "CONNECTED",
    ),
    campaign = campaigns[0];
  const analysisUrl = `/dashboard/ia?analysis=abandoned-reservations&origin=communication${campaign ? `&campaignId=${campaign.id}` : ""}`;
  const opportunities = [
    ...(abandonedCount > 0
      ? [
          {
            title: "Reservas abandonadas",
            detail: `${abandonedCount} reserva(s) podem receber uma comunicação de recuperação.`,
            action: () =>
              routerPush(
                `/dashboard/comunicacao?tab=new&audience=ABANDONED&ai=1${campaign ? `&campaignId=${campaign.id}` : ""}`,
              ),
          },
        ]
      : []),
    ...(failed > 0
      ? [
          {
            title: "Comunicações que falharam",
            detail: `${failed} registro(s) precisam de revisão antes de uma nova tentativa.`,
            action: () => navigate("HISTORY", "failed"),
          },
        ]
      : []),
  ];
  return (
    <section className="mt-5 space-y-5">
      <div className="overflow-hidden rounded-3xl bg-gradient-to-br from-violet-950 via-violet-800 to-fuchsia-700 p-6 text-white sm:p-8">
        <p className="text-sm font-bold text-violet-200">
          Olá, {organizerName}.
        </p>
        <h2 className="mt-2 max-w-3xl text-2xl font-black sm:text-3xl">
          Existem oportunidades de comunicação que podem gerar novas vendas
          hoje.
        </h2>
        <p className="mt-3 max-w-2xl text-sm text-violet-100">
          O resumo abaixo usa somente contatos, campanhas e comunicações
          registrados na sua conta.
        </p>
        <button
          onClick={() => navigate("NEW")}
          className="mt-6 rounded-xl bg-white px-5 py-3 font-black text-violet-800"
        >
          Criar nova comunicação
        </button>
      </div>
      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <article className="rounded-3xl border bg-white p-5 sm:p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs font-black uppercase tracking-wide text-violet-600">
                Oportunidades de hoje
              </p>
              <h3 className="mt-1 text-xl font-black">O que merece atenção</h3>
            </div>
            <Bot className="text-violet-600" />
          </div>
          {opportunities.length ? (
            <div className="mt-5 space-y-3">
              {opportunities.map((item) => (
                <div key={item.title} className="rounded-2xl bg-zinc-50 p-4">
                  <h4 className="font-black">{item.title}</h4>
                  <p className="mt-1 text-sm text-zinc-500">{item.detail}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <button
                      onClick={item.action}
                      className="rounded-xl bg-violet-700 px-4 py-2 text-sm font-black text-white"
                    >
                      Criar mensagem
                    </button>
                    <button
                      onClick={() =>
                        routerPush(
                          "/dashboard/crm/automacoes?template=abandoned",
                        )
                      }
                      className="rounded-xl border px-4 py-2 text-sm font-bold"
                    >
                      Criar automação
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-6 rounded-2xl bg-zinc-50 p-6 text-center text-sm text-zinc-500">
              Nenhuma oportunidade de comunicação encontrada hoje.
            </p>
          )}
        </article>
        <article className="rounded-3xl border border-violet-200 bg-violet-50 p-5 sm:p-6">
          <p className="text-xs font-black uppercase tracking-wide text-violet-700">
            IA SorteX recomenda
          </p>
          <h3 className="mt-2 text-xl font-black">
            {abandonedCount > 0
              ? "Priorize a recuperação de reservas"
              : "Mantenha sua comunicação organizada"}
          </h3>
          <p className="mt-3 text-sm leading-6 text-zinc-600">
            {abandonedCount > 0
              ? `Há ${abandonedCount} reserva(s) abandonada(s). Prepare uma mensagem curta e revise antes de processar no sandbox.`
              : queued > 0
                ? `Você possui ${queued} comunicação(ões) agendada(s). Revise datas e público antes do processamento.`
                : "Não há evidência suficiente para recomendar um disparo agora."}
          </p>
          <dl className="mt-4 grid gap-2 text-xs">
            <DetailRow
              label="Canal recomendado"
              value={
                whatsapp ? "WhatsApp Business" : "Conecte um canal oficial"
              }
            />
            <DetailRow
              label="Público"
              value={
                abandonedCount > 0 ? "Reservas abandonadas" : "Não definido"
              }
            />
            <DetailRow
              label="Impacto"
              value="Estimativa indisponível sem histórico suficiente"
            />
          </dl>
          <div className="mt-5 flex flex-wrap gap-2">
            <button
              onClick={() =>
                routerPush(
                  `/dashboard/comunicacao?tab=new${abandonedCount > 0 ? "&audience=ABANDONED" : ""}&ai=1`,
                )
              }
              className="rounded-xl bg-violet-700 px-4 py-2 text-sm font-black text-white"
            >
              Criar comunicação
            </button>
            <button
              onClick={() => routerPush(analysisUrl)}
              className="rounded-xl border border-violet-300 px-4 py-2 text-sm font-bold"
            >
              Ver análise
            </button>
          </div>
        </article>
      </div>
      <article className="rounded-3xl border bg-white p-5 sm:p-6">
        <h3 className="text-xl font-black">Automatize comunicações</h3>
        <p className="mt-1 text-sm text-zinc-500">
          Abra o construtor com uma receita e revise cada etapa antes de ativar.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {[
            ["Reserva abandonada", "abandoned"],
            ["Pagamento pendente", "payment"],
            ["Campanha encerrando", "campaign-ending"],
            ["Compra aprovada", "purchase-approved"],
          ].map(([label, template]) => (
            <button
              key={template}
              onClick={() =>
                routerPush(`/dashboard/crm/automacoes?template=${template}`)
              }
              className="flex min-h-20 items-center justify-between rounded-2xl bg-zinc-50 p-4 text-left font-black transition hover:bg-violet-50 hover:text-violet-700"
            >
              {label}
              <ChevronRight size={18} />
            </button>
          ))}
        </div>
      </article>
      <section className="rounded-3xl border bg-white p-5 sm:p-6">
        <h3 className="text-xl font-black">Resumo operacional</h3>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
          <Stat
            label="Mensagens registradas"
            value={history.length}
            onClick={() => navigate("HISTORY")}
          />
          <Stat
            label="Processadas em sandbox"
            value={processed}
            onClick={() => navigate("HISTORY", "processed")}
          />
          <Stat
            label="Agendadas"
            value={queued}
            onClick={() => navigate("SCHEDULED")}
          />
          <Stat
            label="Falharam"
            value={failed}
            onClick={() => navigate("HISTORY", "failed")}
          />
          <Stat
            label="Entregues"
            value="—"
            onClick={() => navigate("METRICS")}
          />
          <Stat label="Lidas" value="—" onClick={() => navigate("METRICS")} />
        </div>
      </section>
      <ChannelStatus integrations={integrations} />
    </section>
  );
}
function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 rounded-xl bg-white/70 p-3">
      <dt className="text-zinc-500">{label}</dt>
      <dd className="text-right font-bold">{value}</dd>
    </div>
  );
}
function ChannelStatus({
  integrations,
}: {
  integrations: OrganizerIntegration[];
}) {
  const whatsapp = integrations.find((item) => item.type === "WHATSAPP");
  const channels = (
    <div className="mt-3 grid gap-2 text-xs sm:grid-cols-2 lg:grid-cols-4">
      <Channel
        name="WhatsApp Business"
        status={
          whatsapp?.status === "CONNECTED" ? "Conectado" : "Não conectado"
        }
        active={whatsapp?.status === "CONNECTED"}
      />
      <Channel name="E-mail" status="Não conectado" />
      <Channel name="Push" status="Em preparação" />
      <Channel name="SMS" status="Não conectado" />
      <Channel name="Telegram" status="Em breve" />
      <Channel name="Instagram Direct" status="Em breve" />
      <Channel name="Messenger" status="Em breve" />
    </div>
  );
  return (
    <>
      <details className="rounded-2xl border bg-white p-4 sm:hidden">
        <summary className="cursor-pointer list-none font-black">
          Status dos canais{" "}
          <span className="ml-1 text-xs font-normal text-zinc-500">
            Veja quais canais estão disponíveis para envio.
          </span>
        </summary>
        {channels}
      </details>
      <section className="hidden rounded-2xl border bg-white p-5 sm:block">
        <h2 className="font-black">Status dos canais</h2>
        <p className="mt-1 text-sm text-zinc-500">
          Veja quais canais estão disponíveis para envio.
        </p>
        {channels}
      </section>
    </>
  );
}
function Channel({
  name,
  status,
  active = false,
}: {
  name: string;
  status: string;
  active?: boolean;
}) {
  return (
    <div className="rounded-xl bg-zinc-50 p-3">
      <b className="block">{name}</b>
      <span
        className={`mt-1 block ${active ? "text-emerald-700" : "text-zinc-500"}`}
      >
        {active ? "● " : "○ "}
        {status}
      </span>
    </div>
  );
}
function MetricsPanel({
  history,
  integrations,
  connect,
}: {
  history: Communication[];
  integrations: OrganizerIntegration[];
  connect: () => void;
}) {
  const channels = ["WHATSAPP", "EMAIL", "SMS"],
    hasOfficial = integrations.some(
      (item) =>
        item.status === "CONNECTED" &&
        (item.type === "WHATSAPP" || item.type === "EMAIL"),
    );
  if (!hasOfficial)
    return (
      <section className="mt-5 rounded-3xl border bg-white p-10 text-center">
        <BarChart3 className="mx-auto text-zinc-300" size={40} />
        <h2 className="mt-4 text-xl font-black">
          Ainda não há dados suficientes.
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-zinc-500">
          Conecte um canal oficial para começar a acompanhar métricas de
          entrega, leitura, clique e conversão.
        </p>
        <button
          onClick={connect}
          className="mt-5 rounded-xl bg-violet-700 px-5 py-3 font-black text-white"
        >
          Conectar canal
        </button>
      </section>
    );
  return (
    <section className="mt-5 grid gap-4 lg:grid-cols-[1.2fr_1fr]">
      <article className="rounded-2xl border bg-white p-5">
        <h2 className="text-lg font-black">Desempenho por canal</h2>
        <div className="mt-4 space-y-3">
          {channels.map((channel) => {
            const total = history.filter(
              (item) => item.channel === channel,
            ).length;
            const width = history.length
              ? Math.max(4, (total / history.length) * 100)
              : 0;
            return (
              <div key={channel}>
                <div className="flex justify-between text-sm">
                  <span>{translate(channel)}</span>
                  <strong>{total}</strong>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-zinc-100">
                  <div
                    className="h-full rounded-full bg-violet-600"
                    style={{ width: `${width}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </article>
      <article className="rounded-2xl border bg-white p-5">
        <h2 className="text-lg font-black">Métricas oficiais</h2>
        <p className="mt-3 text-sm leading-6 text-zinc-500">
          Os indicadores usam somente eventos devolvidos pelos canais
          conectados. Nenhum resultado é estimado.
        </p>
      </article>
    </section>
  );
}
function Step({
  number,
  title,
  description,
  children,
}: {
  number: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border bg-zinc-50/70 p-3 sm:p-5">
      <div className="mb-4 flex items-center gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-violet-700 text-sm font-black text-white">
          {number}
        </span>
        <div>
          <h3 className="font-black">{title}</h3>
          <p className="text-xs text-zinc-500">{description}</p>
        </div>
        <ChevronRight className="ml-auto hidden text-zinc-300 sm:block" />
      </div>
      {children}
    </section>
  );
}
function PanelSkeleton() {
  return (
    <div className="mt-5 animate-pulse space-y-4 rounded-3xl border bg-white p-6">
      <div className="h-7 w-56 rounded bg-zinc-200" />
      <div className="h-28 rounded-2xl bg-zinc-100" />
      <div className="h-52 rounded-2xl bg-zinc-100" />
    </div>
  );
}
function ErrorPanel({ retry }: { retry: () => void }) {
  return (
    <div className="mt-5 rounded-3xl border bg-white p-10 text-center">
      <h2 className="text-xl font-black">
        Não foi possível carregar esta área.
      </h2>
      <p className="mt-2 text-sm text-zinc-500">
        Verifique sua conexão e tente novamente.
      </p>
      <button
        onClick={retry}
        className="mt-5 rounded-xl bg-violet-700 px-5 py-3 font-black text-white"
      >
        Tentar novamente
      </button>
    </div>
  );
}
