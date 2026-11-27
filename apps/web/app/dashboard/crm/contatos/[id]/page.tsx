"use client";

import Link from "next/link";
import { ArrowLeft, MessageCircle, Star } from "lucide-react";
import {
  useCallback,
  useEffect,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import { useParams } from "next/navigation";
import { useAuthorizedUser } from "@/components/auth/RoleGate";
import { AuthApiError } from "@/lib/auth/client";
import { CrmNotice, CrmWorkspace } from "@/components/crm/CrmWorkspace";
import ui from "@/components/crm/crm-workspace-premium.module.css";
import {
  addContactTag,
  addNote,
  contact,
  createTask,
  removeContactTag,
  setContactStatus,
  tags,
  type CrmContact,
  type CrmTag,
} from "@/lib/crm/client";

type ContactDetails = CrmContact & {
  lastInteractionAt: string | null;
  user?: {
    purchases: Array<{
      id: string;
      campaign: { title: string };
      quantity: number;
      total: number | string;
      status: string;
      tickets: Array<{ number: number | string }>;
      payments: Array<{ status: string }>;
    }>;
  } | null;
  outboundMessages?: Array<{
    id: string;
    channel: string;
    status: string;
    subject?: string | null;
    content: string;
    createdAt: string;
  }>;
  interactions: Array<{ id: string; title: string; occurredAt: string }>;
  notes: Array<{ id: string; content: string }>;
};

export default function Perfil() {
  const { id } = useParams<{ id: string }>();
  const organizer = useAuthorizedUser();
  return organizer ? (
    <ContactProfile key={`${organizer.id}:${id}`} id={id} />
  ) : null;
}

function ContactProfile({ id }: { id: string }) {
  const [data, setData] = useState<ContactDetails | null>(null);
  const [allTags, setAllTags] = useState<CrmTag[]>([]);
  const [note, setNote] = useState("");
  const [tagId, setTagId] = useState("");
  const [taskTitle, setTaskTitle] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loadError, setLoadError] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(
    async (isCurrent: () => boolean = () => true) => {
      setLoading(true);
      setLoadError("");
      try {
        const [next, tagRows] = await Promise.all([contact(id), tags()]);
        if (!isCurrent()) return;
        setData(next as ContactDetails);
        setAllTags(tagRows);
      } catch (cause) {
        if (!isCurrent()) return;
        setData(null);
        setLoadError(
          cause instanceof AuthApiError && [403, 404].includes(cause.status)
            ? "Contato indisponível para esta conta."
            : "Não foi possível carregar o perfil do contato.",
        );
      } finally {
        if (isCurrent()) setLoading(false);
      }
    },
    [id],
  );
  useEffect(() => {
    let active = true;
    void Promise.resolve().then(() => {
      if (active) return load(() => active);
    });
    return () => {
      active = false;
    };
  }, [load]);

  async function mutate(
    action: () => Promise<unknown>,
    success: string,
    reset?: () => void,
  ) {
    if (busy) return;
    setError("");
    setMessage("");
    setBusy(true);
    try {
      await action();
      reset?.();
      setMessage(success);
      await load();
    } catch {
      setError("Não foi possível concluir a alteração. Tente novamente.");
    } finally {
      setBusy(false);
    }
  }
  function submitNote(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!note.trim()) return;
    void mutate(
      () => addNote(id, note),
      "Nota adicionada.",
      () => setNote(""),
    );
  }
  function addTask(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!taskTitle.trim()) return;
    void mutate(
      () => createTask({ title: taskTitle, contactId: id, priority: "MEDIUM" }),
      "Tarefa criada.",
      () => setTaskTitle(""),
    );
  }

  const purchases = data?.user?.purchases ?? [];
  const approved = purchases.filter((purchase) =>
    purchase.payments.some((payment) => payment.status === "APPROVED"),
  );
  const average =
    approved.length && data ? Number(data.totalSpent) / approved.length : 0;
  const person =
    data &&
    [
      data.email,
      data.phone,
      [data.city, data.state].filter(Boolean).join(" - "),
    ]
      .filter(Boolean)
      .join(" · ");

  return (
    <CrmWorkspace
      title={data?.name ?? "Perfil do contato"}
      eyebrow="CRM Intelligence · Perfil 360º"
      subtitle={
        person || "Consulte as informações e o histórico deste contato."
      }
      actions={
        <Link
          href="/dashboard/crm/contatos"
          className={`sx-premium-button ${ui.heroAction}`}
        >
          <ArrowLeft size={16} aria-hidden="true" /> Voltar aos contatos
        </Link>
      }
    >
      {loading && <CrmNotice>Carregando perfil…</CrmNotice>}
      {loadError && (
        <CrmNotice kind="error">
          {loadError}
          <p>
            <button
              type="button"
              className="sx-premium-button"
              onClick={() => void load()}
            >
              Tentar novamente
            </button>
          </p>
        </CrmNotice>
      )}
      {error && <CrmNotice kind="error">{error}</CrmNotice>}
      {message && <CrmNotice kind="success">{message}</CrmNotice>}
      {data && (
        <>
          <section
            className={`sx-premium-surface ${ui.panel}`}
            aria-labelledby="crm-contact-activity"
          >
            <div className={ui.row}>
              <h2 id="crm-contact-activity" className="sx-premium-section">
                Resumo do relacionamento
              </h2>
              <span className="sx-premium-badge">{translate(data.status)}</span>
            </div>
            <div className={ui.metricGrid}>
              <Stat label="Compras aprovadas" value={approved.length} />
              <Stat label="Total gasto" value={money(data.totalSpent)} />
              <Stat label="Ticket médio" value={money(average)} />
              <Stat
                label="Última atividade"
                value={
                  data.lastInteractionAt
                    ? new Date(data.lastInteractionAt).toLocaleDateString(
                        "pt-BR",
                      )
                    : "—"
                }
              />
            </div>
            <div className={ui.actions}>
              <button
                type="button"
                className="sx-premium-button"
                disabled={busy}
                onClick={() =>
                  void mutate(
                    () => setContactStatus(id, "VIP"),
                    "Status VIP atualizado.",
                  )
                }
              >
                <Star size={16} aria-hidden="true" /> Marcar como VIP
              </button>
              <Link
                href={`/dashboard/comunicacao?tab=new&contactId=${id}`}
                className="sx-premium-button"
              >
                <MessageCircle size={16} aria-hidden="true" /> Abrir comunicação
              </Link>
              <Link
                href={`/dashboard/comunicacao?tab=new&contactId=${id}&ai=1`}
                className="sx-premium-button"
                data-variant="ghost"
              >
                Sugerir mensagem
              </Link>
            </div>
          </section>
          <section
            className={`sx-premium-surface ${ui.panel}`}
            aria-labelledby="crm-profile-tags"
          >
            <h2 className="sx-premium-section" id="crm-profile-tags">
              Etiquetas do contato
            </h2>
            <div className={ui.actions}>
              {data.tags?.map(({ tag }) => (
                <button
                  type="button"
                  key={tag.id}
                  className="sx-premium-button"
                  disabled={busy}
                  aria-label={`Remover etiqueta ${tag.name}`}
                  onClick={() =>
                    void mutate(
                      () => removeContactTag(id, tag.id),
                      "Etiqueta removida.",
                    )
                  }
                >
                  {tag.name} ×
                </button>
              ))}
              {!data.tags?.length && (
                <p className={ui.label}>Nenhuma etiqueta neste contato.</p>
              )}
            </div>
            <div className={ui.actions}>
              <label className={ui.fieldLabel}>
                Etiqueta para adicionar
                <select
                  value={tagId}
                  onChange={(event) => setTagId(event.target.value)}
                  className={ui.field}
                >
                  <option value="">Escolher etiqueta</option>
                  {allTags
                    .filter(
                      (tag) =>
                        !data.tags?.some(
                          (current) => current.tag.id === tag.id,
                        ),
                    )
                    .map((tag) => (
                      <option key={tag.id} value={tag.id}>
                        {tag.name}
                      </option>
                    ))}
                </select>
              </label>
              <button
                type="button"
                className="sx-premium-button"
                disabled={busy || !tagId}
                onClick={() =>
                  void mutate(
                    () => addContactTag(id, tagId),
                    "Etiqueta aplicada.",
                    () => setTagId(""),
                  )
                }
              >
                Aplicar etiqueta
              </button>
            </div>
          </section>

          <div className={ui.detailGrid}>
            <Panel title="Compras, reservas e títulos">
              {purchases.map((purchase) => (
                <article key={purchase.id} className={ui.inset}>
                  <div className={ui.row}>
                    <strong>{purchase.campaign.title}</strong>
                    <span className="sx-premium-badge">
                      {translate(purchase.status)}
                    </span>
                  </div>
                  <p className={ui.label}>
                    {purchase.quantity} títulos · {money(purchase.total)}
                  </p>
                  <p className={ui.label}>
                    Números:{" "}
                    {purchase.tickets
                      .map((ticket) => ticket.number)
                      .join(", ") || "—"}
                  </p>
                  <p className={ui.label}>
                    Pagamentos:{" "}
                    {purchase.payments
                      .map((payment) => translate(payment.status))
                      .join(", ") || "Nenhum"}
                  </p>
                </article>
              ))}
              {!purchases.length && (
                <p className={ui.empty}>Nenhuma compra ou reserva.</p>
              )}
            </Panel>
            <Panel title="Histórico de comunicação">
              {data.outboundMessages?.map((item) => (
                <article key={item.id} className={ui.inset}>
                  <div className={ui.row}>
                    <strong>{translate(item.channel)}</strong>
                    <span className="sx-premium-badge">
                      {translate(item.status)}
                    </span>
                  </div>
                  <p className={ui.detailText}>
                    {item.subject || item.content}
                  </p>
                  <p className={ui.label}>
                    {new Date(item.createdAt).toLocaleString("pt-BR")}
                  </p>
                </article>
              ))}
              {!data.outboundMessages?.length && (
                <p className={ui.empty}>Nenhuma comunicação registrada.</p>
              )}
            </Panel>
            <Panel title="Interações">
              {data.interactions.map((item) => (
                <article key={item.id} className={ui.inset}>
                  <strong>{item.title}</strong>
                  <p className={ui.label}>
                    {new Date(item.occurredAt).toLocaleString("pt-BR")}
                  </p>
                </article>
              ))}
              {!data.interactions.length && (
                <p className={ui.empty}>Nenhuma interação registrada.</p>
              )}
            </Panel>
            <Panel title="Notas e tarefas">
              <form onSubmit={submitNote} className={ui.stack}>
                <label className={ui.fieldLabel}>
                  Nota interna
                  <textarea
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    required
                    placeholder="Adicionar nota"
                    className={ui.field}
                  />
                </label>
                <div>
                  <button
                    type="submit"
                    className="sx-premium-button"
                    data-variant="primary"
                    disabled={busy}
                  >
                    Adicionar nota
                  </button>
                </div>
              </form>
              <form onSubmit={addTask} className={ui.stack}>
                <label className={ui.fieldLabel}>
                  Título da tarefa
                  <input
                    required
                    value={taskTitle}
                    onChange={(event) => setTaskTitle(event.target.value)}
                    placeholder="Nova tarefa"
                    className={ui.field}
                  />
                </label>
                <div>
                  <button
                    type="submit"
                    className="sx-premium-button"
                    disabled={busy}
                  >
                    Criar tarefa
                  </button>
                </div>
              </form>
              {data.notes.map((item) => (
                <p key={item.id} className={`${ui.inset} ${ui.detailText}`}>
                  {item.content}
                </p>
              ))}
            </Panel>
          </div>
        </>
      )}
    </CrmWorkspace>
  );
}

function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className={`sx-premium-surface ${ui.panel}`}>
      <h2 className="sx-premium-section">{title}</h2>
      {children}
    </section>
  );
}
function Stat({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className={ui.inset}>
      <p className={ui.label}>{label}</p>
      <strong className={ui.metricValue}>{value}</strong>
    </div>
  );
}
function money(value: number | string) {
  return Number(value).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
}
function translate(value: string) {
  return (
    (
      {
        LEAD: "Lead",
        CUSTOMER: "Cliente",
        VIP: "VIP",
        INACTIVE: "Inativo",
        BLOCKED: "Bloqueado",
        APPROVED: "Aprovado",
        PENDING: "Pendente",
        AWAITING_PAYMENT: "Aguardando pagamento",
        EXPIRED: "Expirada",
        PAID: "Paga",
        WHATSAPP: "WhatsApp",
        EMAIL: "E-mail",
        SMS: "SMS",
        SKIPPED: "Simulada",
        QUEUED: "Agendada",
        CANCELLED: "Cancelada",
      } as Record<string, string>
    )[value] || value
  );
}
