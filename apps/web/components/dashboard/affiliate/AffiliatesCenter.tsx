"use client";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import {
  Check,
  Clipboard,
  Link2,
  Pause,
  Play,
  Plus,
  RotateCw,
  Send,
  Users,
} from "lucide-react";
import { getMyCampaigns } from "@/lib/campaigns/client";
import {
  activateProgram,
  affiliates,
  approveAffiliate,
  cancelInvite,
  commissionAction,
  createProgram,
  inviteAffiliate,
  organizerAffiliateDashboard,
  organizerCommissions,
  organizerConversions,
  pauseProgram,
  programs,
  resendInvite,
  suspendAffiliate,
  updateProgram,
  type AffiliateSummary,
  type OrganizerAffiliate,
  type Program,
} from "@/lib/affiliates/client";

const tabs = [
  "Visão geral",
  "Programas",
  "Afiliados",
  "Convites",
  "Vendas atribuídas",
  "Comissões",
  "Configurações",
];
const money = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const status: Record<string, string> = {
  DRAFT: "Rascunho",
  ACTIVE: "Ativo",
  PAUSED: "Pausado",
  ENDED: "Encerrado",
  INVITED: "Pendente",
  PENDING: "Aguardando aprovação",
  SUSPENDED: "Suspenso",
  INACTIVE: "Cancelado",
  APPROVED: "Aguardando liberação",
  AVAILABLE: "Liberada",
  PAID: "Paga",
  CANCELLED: "Cancelada",
  REVERSED: "Estornada",
};

export function AffiliatesCenter() {
  const [tab, setTab] = useState(tabs[0]);
  const [summary, setSummary] = useState<AffiliateSummary | null>(null);
  const [programList, setPrograms] = useState<Program[]>([]);
  const [affiliateList, setAffiliates] = useState<OrganizerAffiliate[]>([]);
  const [conversions, setConversions] = useState<any[]>([]);
  const [commissions, setCommissions] = useState<any[]>([]);
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [busy, setBusy] = useState(false);
  const [editingProgramId, setEditingProgramId] = useState("");
  const [message, setMessage] = useState("");
  const [inviteUrl, setInviteUrl] = useState("");
  const [program, setProgram] = useState({
    name: "",
    campaignId: "",
    commissionType: "PERCENTAGE",
    commissionPercentage: 10,
    commissionFixedAmount: 0,
    commissionBasis: "SALE",
    cookieDurationDays: 7,
    releaseDelayDays: 7,
    affiliateLimit: 100,
    startsAt: "",
    endsAt: "",
    rules: "",
  });
  const [invite, setInvite] = useState({
    programId: "",
    name: "",
    email: "",
    phone: "",
    message: "",
    validityDays: 7,
  });
  const load = useCallback(async () => {
    const [s, p, a, c, m, cs] = await Promise.all([
      organizerAffiliateDashboard(),
      programs(),
      affiliates(),
      organizerConversions(),
      organizerCommissions(),
      getMyCampaigns(),
    ]);
    setSummary(s);
    setPrograms(p);
    setAffiliates(a);
    setConversions(c);
    setCommissions(m);
    setCampaigns(cs);
    setInvite((current) =>
      current.programId || !p[0] ? current : { ...current, programId: p[0].id },
    );
  }, []);
  useEffect(() => {
    load().catch((e) =>
      setMessage(
        e instanceof Error ? e.message : "Não foi possível carregar afiliados.",
      ),
    );
  }, [load]);
  const invitations = affiliateList.filter((a) =>
    ["INVITED", "INACTIVE"].includes(a.status),
  );
  async function submitProgram(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const body = {
        ...program,
        campaignId: program.campaignId || undefined,
        commissionPercentage:
          program.commissionType === "PERCENTAGE"
            ? program.commissionPercentage
            : undefined,
        commissionFixedAmount:
          program.commissionType === "FIXED"
            ? program.commissionFixedAmount
            : undefined,
        minimumPayoutAmount: 0,
        attributionModel: "LAST_CLICK",
        startsAt: program.startsAt || undefined,
        endsAt: program.endsAt || undefined,
      };
      if (editingProgramId) await updateProgram(editingProgramId, body);
      else await createProgram(body);
      setMessage(editingProgramId ? "Programa atualizado com sucesso." : "Programa salvo como rascunho.");
      setEditingProgramId("");
      setProgram((v) => ({ ...v, name: "" }));
      await load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Erro ao criar programa.");
    } finally {
      setBusy(false);
    }
  }
  async function submitInvite(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const result = await inviteAffiliate(invite);
      setInviteUrl(result.inviteUrl);
      setMessage("Convite criado. Nenhuma mensagem externa foi enviada.");
      await load();
    } catch (e) {
      setMessage(e instanceof Error ? e.message : "Erro ao criar convite.");
    } finally {
      setBusy(false);
    }
  }
  async function copy(value: string) {
    await navigator.clipboard.writeText(value);
    setMessage("Link copiado com sucesso.");
  }
  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[.2em] text-violet-600">
            Crescimento orgânico
          </p>
          <h1 className="mt-2 text-3xl font-black">Afiliados</h1>
          <p className="mt-2 text-zinc-500">
            Programas, atribuição e comissões sem pagamento automático.
          </p>
        </div>
        <button
          onClick={() => setTab("Programas")}
          className="flex h-11 items-center gap-2 rounded-xl bg-violet-700 px-5 font-bold text-white"
        >
          <Plus size={18} />
          Criar programa
        </button>
      </header>
      {message && (
        <p
          role="status"
          className="rounded-2xl bg-violet-50 p-4 text-sm font-semibold text-violet-800"
        >
          {message}
        </p>
      )}
      <select
        aria-label="Seção de afiliados"
        value={tab}
        onChange={(e) => setTab(e.target.value)}
        className="h-12 w-full rounded-xl border bg-white px-3 font-bold md:hidden"
      >
        {tabs.map((x) => (
          <option key={x}>{x}</option>
        ))}
      </select>
      <nav className="hidden flex-wrap gap-2 md:flex">
        {tabs.map((x) => (
          <button
            key={x}
            onClick={() => setTab(x)}
            className={`rounded-xl px-4 py-2 text-sm font-bold ${tab === x ? "bg-violet-700 text-white" : "border bg-white text-zinc-600"}`}
          >
            {x}
          </button>
        ))}
      </nav>
      {tab === "Visão geral" && summary && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {[
            ["Programas ativos", summary.activePrograms],
            ["Afiliados ativos", summary.activeAffiliates],
            ["Convites pendentes", summary.pendingInvites],
            ["Cliques", summary.clicks],
            ["Reservas atribuídas", summary.attributedReservations],
            ["Vendas aprovadas", summary.approvedSales],
            ["Receita gerada", money(summary.generatedRevenue)],
            ["Comissões estimadas", money(summary.estimatedCommissions)],
            ["Comissões liberadas", money(summary.availableCommissions)],
            ["Comissões pagas", money(summary.paidCommissions)],
          ].map(([label, value]) => (
            <article
              key={String(label)}
              className="rounded-2xl border bg-white p-5 shadow-sm"
            >
              <span className="text-xs font-bold uppercase text-zinc-400">
                {label}
              </span>
              <strong className="mt-2 block text-2xl">{value}</strong>
            </article>
          ))}
        </div>
      )}
      {tab === "Programas" && (
        <div className="grid gap-5 xl:grid-cols-[420px_1fr]">
          <form
            onSubmit={submitProgram}
            className="rounded-3xl border bg-white p-6 shadow-sm"
          >
            <h2 className="text-xl font-black">{editingProgramId ? "Editar programa" : "Novo programa"}</h2>
            <Field label="Nome">
              <input
                required
                className={input}
                value={program.name}
                onChange={(e) =>
                  setProgram({ ...program, name: e.target.value })
                }
              />
            </Field>
            <Field label="Campanha">
              <select
                className={input}
                value={program.campaignId}
                onChange={(e) =>
                  setProgram({ ...program, campaignId: e.target.value })
                }
              >
                <option value="">Todas as campanhas</option>
                {campaigns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Tipo">
                <select
                  className={input}
                  value={program.commissionType}
                  onChange={(e) =>
                    setProgram({ ...program, commissionType: e.target.value })
                  }
                >
                  <option value="PERCENTAGE">Percentual por venda</option>
                  <option value="FIXED">Valor fixo</option>
                </select>
              </Field>
              <Field label="Valor">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className={input}
                  value={
                    program.commissionType === "PERCENTAGE"
                      ? program.commissionPercentage
                      : program.commissionFixedAmount
                  }
                  onChange={(e) =>
                    setProgram({
                      ...program,
                      [program.commissionType === "PERCENTAGE"
                        ? "commissionPercentage"
                        : "commissionFixedAmount"]: +e.target.value,
                    })
                  }
                />
              </Field>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Janela (dias)">
                <input
                  type="number"
                  className={input}
                  value={program.cookieDurationDays}
                  onChange={(e) =>
                    setProgram({
                      ...program,
                      cookieDurationDays: +e.target.value,
                    })
                  }
                />
              </Field>
              <Field label="Liberação (dias)">
                <input
                  type="number"
                  className={input}
                  value={program.releaseDelayDays}
                  onChange={(e) =>
                    setProgram({
                      ...program,
                      releaseDelayDays: +e.target.value,
                    })
                  }
                />
              </Field>
            </div>
            <Field label="Limite de afiliados">
              <input
                type="number"
                className={input}
                value={program.affiliateLimit}
                onChange={(e) =>
                  setProgram({ ...program, affiliateLimit: +e.target.value })
                }
              />
            </Field>
            <Field label="Regras e observações">
              <textarea
                className={`${input} min-h-24 py-3`}
                value={program.rules}
                onChange={(e) =>
                  setProgram({ ...program, rules: e.target.value })
                }
              />
            </Field>
            <button
              disabled={busy}
              className="mt-4 h-11 w-full rounded-xl bg-violet-700 font-bold text-white"
            >
              {editingProgramId ? "Salvar alterações" : "Salvar rascunho"}
            </button>
          </form>
          <div className="grid content-start gap-3 md:grid-cols-2">
            {programList.map((p) => (
              <article key={p.id} className="rounded-2xl border bg-white p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <h3 className="font-black">{p.name}</h3>
                    <p className="text-sm text-zinc-500">
                      {p._count?.affiliates || 0} afiliados ·{" "}
                      {p._count?.conversions || 0} vendas
                    </p>
                  </div>
                  <Badge>{status[p.status] || p.status}</Badge>
                </div>
                <p className="mt-3 text-sm">
                  {p.commissionType === "PERCENTAGE"
                    ? `${p.commissionPercentage}% por venda`
                    : `${money(Number(p.commissionFixedAmount || 0))} fixo`}{" "}
                  · janela de {p.cookieDurationDays} dias
                </p>
                <button
                  onClick={() =>
                    void (
                      p.status === "ACTIVE"
                        ? pauseProgram(p.id)
                        : activateProgram(p.id)
                    ).then(load)
                  }
                  className="mt-4 flex items-center gap-2 rounded-xl bg-violet-50 px-4 py-2 text-sm font-bold text-violet-700"
                >
                  {p.status === "ACTIVE" ? (
                    <>
                      <Pause size={15} />
                      Pausar
                    </>
                  ) : (
                    <>
                      <Play size={15} />
                      Ativar
                    </>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditingProgramId(p.id);
                    setProgram({
                      name: p.name,
                      campaignId: p.campaignId || "",
                      commissionType: p.commissionType,
                      commissionPercentage: Number(p.commissionPercentage || 0),
                      commissionFixedAmount: Number(p.commissionFixedAmount || 0),
                      commissionBasis: p.commissionBasis,
                      cookieDurationDays: p.cookieDurationDays,
                      releaseDelayDays: p.releaseDelayDays,
                      affiliateLimit: p.affiliateLimit || 100,
                      startsAt: p.startsAt?.slice(0, 16) || "",
                      endsAt: p.endsAt?.slice(0, 16) || "",
                      rules: p.rules || "",
                    });
                  }}
                  className="mt-2 rounded-xl border px-4 py-2 text-sm font-bold text-zinc-700"
                >
                  Editar
                </button>
              </article>
            ))}
          </div>
        </div>
      )}
      {tab === "Convites" && (
        <div className="grid gap-5 xl:grid-cols-[420px_1fr]">
          <form
            onSubmit={submitInvite}
            className="rounded-3xl border bg-white p-6"
          >
            <h2 className="text-xl font-black">Convidar afiliado</h2>
            <Field label="Programa">
              <select
                required
                className={input}
                value={invite.programId}
                onChange={(e) =>
                  setInvite({ ...invite, programId: e.target.value })
                }
              >
                <option value="">Selecione</option>
                {programList.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Nome">
              <input
                required
                className={input}
                value={invite.name}
                onChange={(e) => setInvite({ ...invite, name: e.target.value })}
              />
            </Field>
            <Field label="E-mail">
              <input
                required
                type="email"
                className={input}
                value={invite.email}
                onChange={(e) =>
                  setInvite({ ...invite, email: e.target.value })
                }
              />
            </Field>
            <Field label="WhatsApp">
              <input
                className={input}
                value={invite.phone}
                onChange={(e) =>
                  setInvite({
                    ...invite,
                    phone: e.target.value.replace(/\D/g, ""),
                  })
                }
              />
            </Field>
            <Field label="Mensagem opcional">
              <textarea
                className={`${input} min-h-20 py-3`}
                value={invite.message}
                onChange={(e) =>
                  setInvite({ ...invite, message: e.target.value })
                }
              />
            </Field>
            <button className="mt-4 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-zinc-950 font-bold text-white">
              <Send size={17} />
              Gerar convite
            </button>
            {inviteUrl && (
              <button
                type="button"
                onClick={() => copy(inviteUrl)}
                className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border p-3 text-sm font-bold"
              >
                <Clipboard size={16} />
                Copiar link
              </button>
            )}
          </form>
          <List>
            {invitations.map((a) => (
              <Row
                key={a.id}
                title={a.name}
                subtitle={`${a.email} · ${a.program.name}`}
                badge={status[a.status] || a.status}
              >
                <button
                  onClick={() =>
                    copy(
                      `${location.origin}/afiliado/convite/${a.referralCode}`,
                    )
                  }
                  aria-label="Copiar link"
                >
                  <Link2 size={17} />
                </button>
                <button
                  onClick={() =>
                    void resendInvite(a.id).then((r) => {
                      setInviteUrl(r.inviteUrl);
                      return load();
                    })
                  }
                  aria-label="Reenviar"
                >
                  <RotateCw size={17} />
                </button>
                <button
                  onClick={() => {
                    if (!confirm("Deseja cancelar este convite?")) return;
                    void cancelInvite(a.id).then(load);
                  }}
                  className="text-red-600"
                >
                  Cancelar
                </button>
              </Row>
            ))}
          </List>
        </div>
      )}
      {tab === "Afiliados" && (
        <List>
          {affiliateList
            .filter((a) => !["INVITED", "INACTIVE"].includes(a.status))
            .map((a) => (
              <Row
                key={a.id}
                title={a.name}
                subtitle={`${a.email} · ${a.program.name} · ${a._count.conversions} vendas`}
                badge={status[a.status] || a.status}
              >
                {a.status === "ACTIVE" ? (
                  <button
                    onClick={() => void suspendAffiliate(a.id).then(load)}
                  >
                    Pausar
                  </button>
                ) : (
                  <button
                    onClick={() => void approveAffiliate(a.id).then(load)}
                  >
                    Ativar
                  </button>
                )}
              </Row>
            ))}
        </List>
      )}
      {tab === "Vendas atribuídas" && (
        <List>
          {conversions.map((c) => (
            <Row
              key={c.id}
              title={c.affiliate.name}
              subtitle={`${c.campaign.title} · ${money(Number(c.grossAmount))}`}
              badge={status[c.status] || c.status}
            />
          ))}
        </List>
      )}
      {tab === "Comissões" && (
        <List>
          {commissions.map((c) => (
            <Row
              key={c.id}
              title={c.affiliate.name}
              subtitle={`${c.conversion.campaign.title} · ${money(Number(c.amount))}`}
              badge={status[c.status] || c.status}
            >
              {c.status === "APPROVED" && (
                <button
                  onClick={() =>
                    confirm("Confirmar liberação manual?") &&
                    void commissionAction(c.id, "release").then(load)
                  }
                >
                  <Check size={16} /> Liberar
                </button>
              )}
              {c.status === "AVAILABLE" && (
                <button
                  onClick={() =>
                    confirm("Confirmar pagamento realizado fora da SorteX?") &&
                    void commissionAction(c.id, "pay").then(load)
                  }
                >
                  <Check size={16} /> Marcar paga
                </button>
              )}
            </Row>
          ))}
        </List>
      )}
      {tab === "Configurações" && (
        <article className="rounded-3xl border bg-white p-6">
          <Users className="text-violet-700" />
          <h2 className="mt-4 text-xl font-black">Regras de atribuição</h2>
          <p className="mt-2 max-w-2xl text-sm text-zinc-600">
            Atribuição por último clique válido, respeitando a janela definida
            em cada programa. Comissões são calculadas após pagamento aprovado e
            nunca pagas automaticamente pela SorteX.
          </p>
        </article>
      )}
    </div>
  );
}
const input =
  "mt-2 h-11 w-full rounded-xl border border-zinc-200 px-3 outline-none focus:border-violet-500";
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="mt-3 block text-sm font-bold text-zinc-700">
      {label}
      {children}
    </label>
  );
}
function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded-full bg-violet-50 px-3 py-1 text-xs font-bold text-violet-700">
      {children}
    </span>
  );
}
function List({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-3">
      {children || (
        <p className="rounded-2xl border bg-white p-8 text-center text-zinc-500">
          Nenhum registro.
        </p>
      )}
    </div>
  );
}
function Row({
  title,
  subtitle,
  badge,
  children,
}: {
  title: string;
  subtitle: string;
  badge: string;
  children?: React.ReactNode;
}) {
  return (
    <article className="flex flex-col gap-3 rounded-2xl border bg-white p-5 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-black">{title}</h3>
          <Badge>{badge}</Badge>
        </div>
        <p className="mt-1 text-sm text-zinc-500">{subtitle}</p>
      </div>
      {children && (
        <div className="flex items-center gap-3 text-sm font-bold text-violet-700">
          {children}
        </div>
      )}
    </article>
  );
}
