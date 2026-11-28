"use client";
import { Children, type FormEvent, useCallback, useEffect, useState } from "react";
import PremiumScope from "@/components/premium/PremiumScope";
import styles from "./affiliates-premium.module.css";
import {
  Check,
  Clipboard,
  Link2,
  LoaderCircle,
  Pause,
  Ticket,
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
type ConversionRow = { id: string; status: string; affiliate: { name: string }; campaign: { title: string }; grossAmount: string | number };
type CommissionRow = { id: string; status: string; affiliate: { name: string }; conversion: { campaign: { title: string } }; amount: string | number };
type CampaignOption = { id: string; title: string };

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
  const [conversions, setConversions] = useState<ConversionRow[]>([]);
  const [commissions, setCommissions] = useState<CommissionRow[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignOption[]>([]);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
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
    setLoading(true);
    setLoadError(false);
    try {
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
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    const initial = window.setTimeout(() => { void load(); }, 0);
    return () => window.clearTimeout(initial);
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
    try {
      await navigator.clipboard.writeText(value);
      setMessage("Link copiado com sucesso.");
    } catch {
      setMessage("Não foi possível copiar. Confira a permissão da área de transferência.");
    }
  }
  return (
    <PremiumScope className={styles.page}>
      <header className={styles.hero}>
        <div>
          <p className={styles.eyebrow}>Crescimento orgânico</p>
          <h1 className={styles.title}>Afiliados</h1>
          <p className={styles.copy}>Organize seus programas e acompanhe as vendas atribuídas e as comissões registradas nesta conta.</p>
        </div>
        <button type="button" onClick={() => setTab("Programas")} className={styles.primary}>
          <Plus size={18} aria-hidden="true" /> Criar programa
        </button>
      </header>
      {message && <p role="status" className={styles.notice}>{message}</p>}
      <div className={styles.notice}>
        <strong>Repasses automáticos indisponíveis.</strong>{" "}
        A SorteX registra o controle das comissões. Marcar uma comissão como paga não transfere dinheiro.
      </div>

      <div className={styles.sectionPicker}>
        <label htmlFor="affiliate-section" className={styles.mobileLabel}>Seção de afiliados</label>
        <select id="affiliate-section" value={tab} onChange={(e) => setTab(e.target.value)} className={styles.field}>
          {tabs.map((section) => <option key={section}>{section}</option>)}
        </select>
      </div>
      <nav aria-label="Seções de afiliados" className={styles.sectionNav}>
        {tabs.map((section) => (
          <button type="button" key={section} onClick={() => setTab(section)} aria-pressed={tab === section}>
            {section}
          </button>
        ))}
      </nav>

      <section className={styles.content} aria-label={`Afiliados: ${tab}`}>
      {loading ? (
        <div className={styles.empty} role="status">
          <LoaderCircle size={18} aria-hidden="true" className={styles.spinner} /> Carregando dados de afiliados…
        </div>
      ) : loadError ? (
        <div className={styles.empty}>
          <p role="alert">Não foi possível carregar os dados de afiliados.</p>
          <button type="button" className={styles.control} onClick={() => void load()}>Tentar novamente</button>
        </div>
      ) : (<>
      {tab === "Visão geral" && summary && <SummaryView summary={summary} />}
      {tab === "Programas" && (
        <div className={styles.workGrid}>
          <form
            onSubmit={submitProgram}
            className={styles.card}
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
              className={`${styles.primary} mt-4 w-full`}
            >
              {editingProgramId ? "Salvar alterações" : "Salvar rascunho"}
            </button>
          </form>
          <div className={styles.list}>
            {!programList.length && <p className={styles.empty}>Nenhum programa cadastrado.</p>}
            {programList.map((p) => (
              <article key={p.id} className={styles.card}>
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
        <div className={styles.workGrid}>
          <form
            onSubmit={submitInvite}
            className={styles.card}
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
            <button disabled={busy} className={`${styles.primary} mt-4 w-full`}>
              <Send size={17} aria-hidden="true" />
              Gerar convite
            </button>
            <p className={styles.muted}>Gerar o link não envia e-mail nem mensagem.</p>
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
          <List empty="Nenhum convite registrado.">
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
        <List empty="Nenhum afiliado registrado.">
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
        <List empty="Nenhuma venda ou reserva atribuída disponível.">
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
        <List empty="Nenhuma comissão registrada.">
          {commissions.map((c) => (
            <Row
              key={c.id}
              title={c.affiliate.name}
              subtitle={`${c.conversion.campaign.title} · ${money(Number(c.amount))}`}
              badge={c.status === "PAID" ? "Pagamento manual registrado" : (status[c.status] || c.status)}
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
                  <Check size={16} aria-hidden="true" /> Registrar pagamento externo
                </button>
              )}
            </Row>
          ))}
        </List>
      )}
      {tab === "Configurações" && (
        <article className={styles.card}>
          <Users className="text-violet-700" />
          <h2 className="mt-4 text-xl font-black">Regras de atribuição</h2>
          <p className="mt-2 max-w-2xl text-sm text-zinc-600">
            Atribuição por último clique válido, respeitando a janela definida
            em cada programa. Comissões são calculadas após pagamento aprovado e
            nunca pagas automaticamente pela SorteX.
          </p>
        </article>
      )}
      </>)}
      </section>
    </PremiumScope>
  );
}

function SummaryView({ summary }: { summary: AffiliateSummary }) {
  const cards = [
    ["Programas ativos", summary.activePrograms],
    ["Afiliados ativos", summary.activeAffiliates],
    ["Convites pendentes", summary.pendingInvites],
    ["Cliques registrados", summary.clicks],
    ["Reservas atribuídas pendentes", summary.attributedReservations],
    ["Vendas aprovadas", summary.approvedSales],
    ["Comissões estimadas", money(summary.estimatedCommissions)],
    ["Comissões liberadas", money(summary.availableCommissions)],
    ["Pagamentos manuais registrados", money(summary.paidCommissions)],
  ];
  return (
    <section aria-labelledby="affiliate-summary" className={styles.summary}>
      <header>
        <p className={styles.eyebrow}>Registros desta conta</p>
        <h2 id="affiliate-summary" className={styles.heading}>Visão geral</h2>
      </header>
      <div className={styles.ticket}>
        <div>
          <p><Ticket size={18} aria-hidden="true" /> Valor bruto das atribuições</p>
          <strong>{money(summary.generatedRevenue)}</strong>
        </div>
        <p>Inclui atribuições de todos os status. Não é receita líquida nem saldo disponível.</p>
      </div>
      <dl className={styles.stats}>
        {cards.map(([label, value]) => (
          <div key={String(label)} className={styles.stat}>
            <dt>{label}</dt><dd>{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

const input = styles.field;
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
function Badge({ children }: { children: React.ReactNode }) {
  return (
    <span className={styles.badge}>
      {children}
    </span>
  );
}
function List({ children, empty }: { children: React.ReactNode; empty: string }) {
  return <div className={styles.list}>{Children.count(children) ? children : <p className={styles.empty}>{empty}</p>}</div>;
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
    <article className={styles.row}>
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-black">{title}</h3>
          <Badge>{badge}</Badge>
        </div>
        <p className="mt-1 text-sm text-zinc-500">{subtitle}</p>
      </div>
      {children && (
        <div className={styles.rowActions}>
          {children}
        </div>
      )}
    </article>
  );
}
