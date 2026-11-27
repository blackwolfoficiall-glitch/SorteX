"use client";
import Link from "next/link";
import { type FormEvent, useCallback, useEffect, useRef, useState } from "react";
import PremiumScope from "@/components/premium/PremiumScope";
import styles from "./mini-campaigns-premium.module.css";
import {
  Copy,
  Edit3,
  ExternalLink,
  LoaderCircle,
  Pause,
  Play,
  Plus,
  Square,
  Ticket,
  Trash2,
  X,
} from "lucide-react";
import { getMyCampaigns } from "@/lib/campaigns/client";
import type { Campaign } from "@/lib/campaigns/types";
import {
  createMiniCampaign,
  deleteMiniCampaign,
  listMiniCampaigns,
  miniCampaignAction,
  updateMiniCampaign,
  type MiniCampaign,
} from "@/lib/organizer-platform/client";
const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});
const labels: Record<string, string> = {
  DRAFT: "Rascunho",
  PUBLISHED: "Publicada",
  PAUSED: "Pausada",
  FINISHED: "Finalizada",
  CANCELLED: "Cancelada",
  MAIN_CAMPAIGN_TICKETS: "Títulos da campanha principal",
  PIX: "Pix",
  PRODUCT: "Produto",
  BONUS: "Bônus",
  OTHER: "Outro",
};
const empty = {
  name: "",
  mainCampaignId: "",
  prizeType: "MAIN_CAMPAIGN_TICKETS",
  prizeDescription: "",
  maxTickets: 100,
  ticketPrice: 1,
  purchaseLimitPerBuyer: 10,
  startsAt: "",
  endsAt: "",
  drawAt: "",
  rules: "",
  description: "",
  imageUrl: "",
};
export default function MiniCampanhasPage() {
  const [items, setItems] = useState<MiniCampaign[]>([]),
    [campaigns, setCampaigns] = useState<Campaign[]>([]),
    [form, setForm] = useState({ ...empty }),
    [editing, setEditing] = useState(""),
    [open, setOpen] = useState(false),
    [loading, setLoading] = useState(true),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [loadFailed, setLoadFailed] = useState(false);
  const dialog = useRef<HTMLDialogElement>(null);
  const load = useCallback(async () => {
    setLoading(true);
    setLoadFailed(false);
    try {
      const [mini, owned] = await Promise.all([
        listMiniCampaigns(),
        getMyCampaigns(),
      ]);
      setItems(mini);
      setCampaigns(owned);
      if (owned[0])
        setForm((current) => current.mainCampaignId ? current : { ...current, mainCampaignId: owned[0].id });
    } catch {
      setLoadFailed(true);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);
  useEffect(() => {
    if (!open) return;
    const modal = dialog.current;
    modal?.showModal();
    return () => modal?.close();
  }, [open]);
  function close() {
    dialog.current?.close();
    setOpen(false);
  }
  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const body = {
        ...form,
        maxTickets: Number(form.maxTickets),
        ticketPrice: Number(form.ticketPrice),
        purchaseLimitPerBuyer: Number(form.purchaseLimitPerBuyer) || undefined,
        startsAt: form.startsAt
          ? new Date(form.startsAt).toISOString()
          : undefined,
        endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : undefined,
        drawAt: form.drawAt ? new Date(form.drawAt).toISOString() : undefined,
        imageUrl: form.imageUrl || undefined,
        description: form.description || undefined,
      };
      if (editing) await updateMiniCampaign(editing, body);
      else await createMiniCampaign(body);
      close();
      setEditing("");
      setForm({ ...empty, mainCampaignId: campaigns[0]?.id || "" });
      await load();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível salvar a Mini Campanha.",
      );
    } finally {
      setBusy(false);
    }
  }
  function edit(item: MiniCampaign) {
    setError("");
    setEditing(item.id);
    setForm({
      name: item.name,
      mainCampaignId: item.mainCampaign.id,
      prizeType: item.prizeType,
      prizeDescription: item.prizeDescription,
      maxTickets: item.maxTickets,
      ticketPrice: Number(item.ticketPrice),
      purchaseLimitPerBuyer: item.purchaseLimitPerBuyer ?? 10,
      startsAt: toLocal(item.startsAt),
      endsAt: toLocal(item.endsAt),
      drawAt: toLocal(item.drawAt),
      rules: item.rules,
      description: item.description ?? "",
      imageUrl: item.imageUrl ?? "",
    });
    setOpen(true);
  }
  async function action(id: string, value: string) {
    setBusy(true);
    setError("");
    try {
      await miniCampaignAction(id, value);
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Ação não concluída.");
    } finally {
      setBusy(false);
    }
  }
  return (
    <PremiumScope className={styles.page}>
      <header className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>
            Campanhas vinculadas
          </p>
          <h1 className={styles.title}>Mini Campanhas</h1>
          <p className={styles.copy}>
            Gerencie campanhas menores ligadas a uma campanha principal.
            Estoque, pedidos e resultado ficam separados.
          </p>
        </div>
        <button
          type="button"
          disabled={loading || loadFailed || !campaigns.length}
          onClick={() => {
            setError("");
            setEditing("");
            setForm({ ...empty, mainCampaignId: campaigns[0]?.id || "" });
            setOpen(true);
          }}
          className={styles.primary}
        >
          <Plus size={18} aria-hidden="true" />
          Criar Mini Campanha
        </button>
      </header>
      {!loading && !loadFailed && !campaigns.length && (
        <p className={styles.notice}>Crie uma campanha principal antes de criar uma Mini Campanha. <Link href="/dashboard/campanhas/nova">Abrir criação de campanha</Link></p>
      )}
      {!open && error && (
        <p role="alert" className={styles.error}>
          {error}{" "}
          {error.includes("plano") && (
            <a
              href="/dashboard/configuracoes/plano"
              className="font-bold underline"
            >
              Ver planos
            </a>
          )}
        </p>
      )}
      {loading ? (
        <div className={styles.state} role="status">
          <LoaderCircle size={18} className={styles.spinner} aria-hidden="true" /> Carregando Mini Campanhas…
        </div>
      ) : loadFailed ? (
        <section className={styles.state}>
          <p role="alert">Não foi possível carregar as Mini Campanhas.</p>
          <button type="button" onClick={() => void load()} className={styles.control}>Tentar novamente</button>
        </section>
      ) : items.length ? (
        <section className={styles.grid} aria-label="Mini Campanhas da conta">
          {items.map((item) => (
            <article
              key={item.id}
              className={styles.card}
              aria-label={item.name}
            >
              <header className={styles.cardTop}>
                <span className={styles.icon}><Ticket size={22} aria-hidden="true" /></span>
                <span className={styles.badge} data-status={item.status}>{labels[item.status] || item.status}</span>
              </header>
              <div className={styles.cardBody}>
                <h2 className={styles.heading}>{item.name}</h2>
                <p className={styles.copy}>Vinculada a {item.mainCampaign.title}</p>
                <dl className={styles.fields}>
                  <Info label="Prêmio" value={labels[item.prizeType] || item.prizeType} />
                  <Info label="Preço por título" value={money.format(Number(item.ticketPrice))} />
                  <Info label="Títulos vendidos" value={`${item.soldTickets} de ${item.maxTickets}`} />
                  <Info label="Pedidos" value={item._count?.orders === undefined ? "Não informado" : String(item._count.orders)} />
                </dl>
                <div className={styles.actions}>
                  <button
                    onClick={() => edit(item)}
                    className={styles.control}
                    aria-label="Editar"
                    disabled={busy || !["DRAFT", "PAUSED"].includes(item.status)}
                    title={item.status === "PUBLISHED" ? "Pause a Mini Campanha antes de editar." : undefined}
                  >
                    <Edit3 size={17} aria-hidden="true" /> Editar
                  </button>
                  <button
                    onClick={() => void action(item.id, "duplicate")}
                    className={styles.control}
                    disabled={busy} aria-label="Duplicar"
                  >
                    <Copy size={17} />
                  </button>
                  {item.status !== "PUBLISHED" &&
                    item.status !== "FINISHED" && (
                      <button
                        onClick={() => void action(item.id, "publish")}
                        className={styles.control} data-tone="success"
                        disabled={busy} aria-label="Publicar"
                      >
                        <Play size={17} />
                      </button>
                    )}
                  {item.status === "PUBLISHED" && (
                    <button
                      onClick={() => void action(item.id, "pause")}
                      className={styles.control}
                      disabled={busy} aria-label="Pausar"
                    >
                      <Pause size={17} />
                    </button>
                  )}
                  {item.status !== "FINISHED" && (
                    <button
                      onClick={() => void action(item.id, "finish")}
                      className={styles.control} data-tone="danger"
                      disabled={busy} aria-label="Finalizar"
                    >
                      <Square size={17} />
                    </button>
                  )}
                  <button
                    onClick={() =>
                      confirm("Excluir esta Mini Campanha?") &&
                      void deleteMiniCampaign(item.id)
                        .then(load)
                        .catch((cause) => setError(cause.message))
                    }
                    className={styles.control} data-tone="danger"
                    disabled={busy || item.soldTickets > 0} aria-label="Excluir"
                    title={item.soldTickets > 0 ? "Mini Campanhas com títulos vendidos não podem ser excluídas." : undefined}
                  >
                    <Trash2 size={17} />
                  </button>
                  {item.status === "PUBLISHED" ? (
                    <Link href={`/mini-campanhas/${item.slug}`} prefetch={false} className={styles.control}>Link público <ExternalLink size={15} aria-hidden="true" /></Link>
                  ) : (
                    <span className={styles.muted}>Link público indisponível neste status.</span>
                  )}
                </div>
              </div>
            </article>
          ))}
        </section>
      ) : (
        <section className={styles.state}>
          <h2 className={styles.heading}>Nenhuma Mini Campanha criada</h2>
          <p className={styles.copy}>
            Crie uma experiência menor vinculada a uma campanha principal.
          </p>
        </section>
      )}
      {open && (
        <dialog ref={dialog} className={styles.dialog} aria-labelledby="mini-editor-title" onCancel={(event) => { event.preventDefault(); close(); }} onClick={(event) => { if (event.target === event.currentTarget) close(); }}>
          <div className={styles.dialogBody}>
            <header className={styles.hero}>
              <div>
                <h2 className={styles.heading} id="mini-editor-title">{editing ? "Editar" : "Criar"} Mini Campanha</h2>
                <p className={styles.copy}>Salvar aqui não processa pagamentos. A disponibilidade da campanha depende do status de publicação.</p>
              </div>
              <button type="button" onClick={close} className={styles.control} aria-label="Fechar editor"><X size={19} aria-hidden="true" /></button>
            </header>
            {error && <div className={styles.error} role="alert">{error} {error.includes("plano") && <Link href="/dashboard/configuracoes/plano">Ver planos</Link>}</div>}
            <form onSubmit={submit} className={styles.form}>
              <Field label="Nome">
                <input
                  required
                  minLength={3}
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </Field>
              <Field label="Campanha principal">
                <select
                  required
                  value={form.mainCampaignId}
                  onChange={(e) =>
                    setForm({ ...form, mainCampaignId: e.target.value })
                  }
                >
                  <option value="">Selecione</option>
                  {campaigns.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Tipo de prêmio">
                <select
                  value={form.prizeType}
                  onChange={(e) =>
                    setForm({ ...form, prizeType: e.target.value })
                  }
                >
                  {[
                    "MAIN_CAMPAIGN_TICKETS",
                    "PIX",
                    "PRODUCT",
                    "BONUS",
                    "OTHER",
                  ].map((v) => (
                    <option key={v} value={v}>
                      {labels[v]}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Prêmio">
                <input
                  required
                  value={form.prizeDescription}
                  onChange={(e) =>
                    setForm({ ...form, prizeDescription: e.target.value })
                  }
                />
              </Field>
              <Field label="Quantidade máxima de títulos">
                <input
                  required
                  type="number"
                  min={1}
                  value={form.maxTickets}
                  onChange={(e) =>
                    setForm({ ...form, maxTickets: Number(e.target.value) })
                  }
                />
              </Field>
              <Field label="Preço por título">
                <input
                  required
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={form.ticketPrice}
                  onChange={(e) =>
                    setForm({ ...form, ticketPrice: Number(e.target.value) })
                  }
                />
              </Field>
              <Field label="Limite por comprador">
                <input
                  type="number"
                  min={1}
                  value={form.purchaseLimitPerBuyer}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      purchaseLimitPerBuyer: Number(e.target.value),
                    })
                  }
                />
              </Field>
              <Field label="Imagem (URL HTTPS opcional)">
                <input
                  type="url"
                  value={form.imageUrl}
                  onChange={(e) =>
                    setForm({ ...form, imageUrl: e.target.value })
                  }
                />
              </Field>
              <Field label="Início">
                <input
                  type="datetime-local"
                  value={form.startsAt}
                  onChange={(e) =>
                    setForm({ ...form, startsAt: e.target.value })
                  }
                />
              </Field>
              <Field label="Término">
                <input
                  type="datetime-local"
                  value={form.endsAt}
                  onChange={(e) => setForm({ ...form, endsAt: e.target.value })}
                />
              </Field>
              <Field label="Data e hora do resultado">
                <input
                  type="datetime-local"
                  value={form.drawAt}
                  onChange={(e) => setForm({ ...form, drawAt: e.target.value })}
                />
              </Field>
              <Field label="Descrição">
                <input
                  value={form.description}
                  onChange={(e) =>
                    setForm({ ...form, description: e.target.value })
                  }
                />
              </Field>
              <label className={`${styles.label} ${styles.formWide}`}>
                Regra
                <textarea
                  required
                  minLength={10}
                  className={styles.textarea}
                  value={form.rules}
                  onChange={(e) => setForm({ ...form, rules: e.target.value })}
                />
              </label>
              <button
                disabled={busy}
                className={`${styles.primary} ${styles.formWide}`}
              >
                {busy ? "Salvando..." : "Salvar Mini Campanha"}
              </button>
            </form>
          </div>
        </dialog>
      )}
    </PremiumScope>
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
    <label className={styles.label}>
      {label}
      {children}
    </label>
  );
}
function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className={styles.field}>
      <dt>{label}</dt><dd>{value}</dd>
    </div>
  );
}
function toLocal(value: string | null) {
  return value
    ? new Date(
        new Date(value).getTime() - new Date(value).getTimezoneOffset() * 60000,
      )
        .toISOString()
        .slice(0, 16)
    : "";
}
