"use client";
import { FormEvent, useEffect, useState } from "react";
import {
  Copy,
  Edit3,
  ExternalLink,
  LoaderCircle,
  Pause,
  Play,
  Plus,
  Square,
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
    [error, setError] = useState("");
  const load = async () => {
    setLoading(true);
    try {
      const [mini, owned] = await Promise.all([
        listMiniCampaigns(),
        getMyCampaigns(),
      ]);
      setItems(mini);
      setCampaigns(owned);
      if (!form.mainCampaignId && owned[0])
        setForm((current) => ({ ...current, mainCampaignId: owned[0].id }));
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível carregar as Mini Campanhas.",
      );
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void load();
  }, []);
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
      setOpen(false);
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
    <div className="mx-auto max-w-7xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[.2em] text-violet-600">
            Campanhas vinculadas
          </p>
          <h1 className="mt-2 text-3xl font-black">Mini Campanhas</h1>
          <p className="mt-2 text-zinc-500">
            Estoque, pedidos, resultado e histórico independentes da campanha
            principal.
          </p>
        </div>
        <button
          disabled={loading || !campaigns.length}
          onClick={() => {
            setEditing("");
            setForm({ ...empty, mainCampaignId: campaigns[0]?.id || "" });
            setOpen(true);
          }}
          className="flex h-11 items-center gap-2 rounded-xl bg-violet-600 px-5 font-bold text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Plus size={18} />
          Criar Mini Campanha
        </button>
      </div>
      {error && (
        <p className="mt-5 rounded-2xl bg-red-50 p-4 text-red-700">
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
        <div className="grid h-64 place-items-center">
          <LoaderCircle className="animate-spin text-violet-600" />
        </div>
      ) : items.length ? (
        <div className="mt-7 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {items.map((item) => (
            <article
              key={item.id}
              className="overflow-hidden rounded-3xl border bg-white shadow-sm"
            >
              <div className="h-28 bg-gradient-to-br from-violet-100 via-white to-blue-100 p-5">
                <div className="flex justify-between">
                  <span className="rounded-full bg-white px-3 py-1 text-xs font-black text-violet-700">
                    {labels[item.status] || item.status}
                  </span>
                  <span className="text-xs font-bold text-zinc-500">
                    #{item.slug}
                  </span>
                </div>
              </div>
              <div className="p-5">
                <h2 className="text-xl font-black">{item.name}</h2>
                <p className="mt-1 text-sm text-zinc-500">
                  Vinculada a {item.mainCampaign.title}
                </p>
                <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
                  <Info
                    label="Prêmio"
                    value={labels[item.prizeType] || item.prizeType}
                  />
                  <Info
                    label="Preço"
                    value={money.format(Number(item.ticketPrice))}
                  />
                  <Info
                    label="Estoque"
                    value={`${item.soldTickets}/${item.maxTickets}`}
                  />
                  <Info
                    label="Pedidos"
                    value={String(item._count?.orders || 0)}
                  />
                </div>
                <div className="mt-5 flex flex-wrap gap-2">
                  <button
                    onClick={() => edit(item)}
                    className="rounded-xl bg-zinc-100 p-2"
                    aria-label="Editar"
                  >
                    <Edit3 size={17} />
                  </button>
                  <button
                    onClick={() => void action(item.id, "duplicate")}
                    className="rounded-xl bg-zinc-100 p-2"
                    aria-label="Duplicar"
                  >
                    <Copy size={17} />
                  </button>
                  {item.status !== "PUBLISHED" &&
                    item.status !== "FINISHED" && (
                      <button
                        onClick={() => void action(item.id, "publish")}
                        className="rounded-xl bg-green-50 p-2 text-green-700"
                        aria-label="Publicar"
                      >
                        <Play size={17} />
                      </button>
                    )}
                  {item.status === "PUBLISHED" && (
                    <button
                      onClick={() => void action(item.id, "pause")}
                      className="rounded-xl bg-amber-50 p-2 text-amber-700"
                      aria-label="Pausar"
                    >
                      <Pause size={17} />
                    </button>
                  )}
                  {item.status !== "FINISHED" && (
                    <button
                      onClick={() => void action(item.id, "finish")}
                      className="rounded-xl bg-red-50 p-2 text-red-700"
                      aria-label="Finalizar"
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
                    className="rounded-xl bg-red-50 p-2 text-red-700"
                    aria-label="Excluir"
                  >
                    <Trash2 size={17} />
                  </button>
                  <a
                    href={`/mini-campanhas/${item.slug}`}
                    className="ml-auto flex items-center gap-1 rounded-xl bg-violet-50 px-3 text-xs font-bold text-violet-700"
                  >
                    Link <ExternalLink size={14} />
                  </a>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="mt-7 rounded-3xl border bg-white p-14 text-center">
          <h2 className="text-xl font-black">Nenhuma Mini Campanha criada</h2>
          <p className="mt-2 text-zinc-500">
            Crie uma experiência menor vinculada a uma campanha principal.
          </p>
        </div>
      )}
      {open && (
        <div className="fixed inset-0 z-[70] overflow-y-auto bg-black/60 p-4">
          <div className="mx-auto my-6 max-w-3xl rounded-3xl bg-white p-6 sm:p-8">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-black">
                  {editing ? "Editar" : "Criar"} Mini Campanha
                </h2>
                <p className="text-sm text-zinc-500">
                  A publicação é local/sandbox; nenhum pagamento real será
                  processado.
                </p>
              </div>
              <button onClick={() => setOpen(false)} className="rounded-xl p-2">
                <X />
              </button>
            </div>
            <form onSubmit={submit} className="mt-6 grid gap-4 md:grid-cols-2">
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
              <label className="text-sm font-bold md:col-span-2">
                Regra
                <textarea
                  required
                  minLength={10}
                  className="mt-2 min-h-28 w-full rounded-xl border p-3"
                  value={form.rules}
                  onChange={(e) => setForm({ ...form, rules: e.target.value })}
                />
              </label>
              <button
                disabled={busy}
                className="h-12 rounded-xl bg-violet-600 font-bold text-white md:col-span-2"
              >
                {busy ? "Salvando..." : "Salvar Mini Campanha"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
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
    <label className="text-sm font-bold [&_input]:mt-2 [&_input]:h-11 [&_input]:w-full [&_input]:rounded-xl [&_input]:border [&_input]:px-3 [&_select]:mt-2 [&_select]:h-11 [&_select]:w-full [&_select]:rounded-xl [&_select]:border [&_select]:px-3">
      {label}
      {children}
    </label>
  );
}
function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-zinc-50 p-3">
      <span className="block text-[10px] font-bold uppercase text-zinc-400">
        {label}
      </span>
      <b className="mt-1 block">{value}</b>
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
