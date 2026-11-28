import React, { useEffect, useRef, useState, type ReactNode } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import {
  PremiumButton,
  PremiumChoice,
  PremiumField,
  PremiumGradient,
  PremiumMessage,
  PremiumPage,
  PremiumPanel,
  premiumTypography,
  usePremiumTheme,
} from "../theme/premium";
import { ApiError } from "../api/client";
import type { OrderCampaign } from "./orders";
import {
  editablePromotion,
  enabledPromotionActions,
  initialPromotionFilters,
  isSupportedPromotion,
  loadPromotionCampaigns,
  loadPromotionHistory,
  loadPromotionList,
  loadPromotionReport,
  loadPromotionSummary,
  newPromotionForm,
  promotionActions,
  promotionFormFromItem,
  promotionPayload as promotionPayloadForUI,
  promotionListPath,
  promotionStatuses,
  promotionTypes,
  runPromotionAction,
  samePromotionsSession,
  savePromotion,
  type Promotion,
  type PromotionAction,
  type PromotionEvent,
  type PromotionFilters,
  type PromotionForm,
  type PromotionPageData,
  type PromotionReport,
  type PromotionSummary,
  type PromotionsClient,
  type PromotionsSession,
} from "./promotions";

type Props = { client: PromotionsClient; session: PromotionsSession; draftCampaignId?: string };
type Remote<T> =
  { kind: "ok"; data: T } | { kind: "loading" | "error" | "missing" };
type Selection =
  { kind: "detail"; item: Promotion } | { kind: "form"; item?: Promotion };
type Confirmation = { item: Promotion; action: PromotionAction };
const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});
const date = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "UTC",
});
function useRead<T>(
  key: string,
  read: () => Promise<{ kind: "ok"; data: T } | { kind: "missing" | "stale" }>,
): Remote<T> {
  const [state, setState] = useState<{ key: string; value: Remote<T> }>();
  useEffect(() => {
    let active = true;
    void Promise.resolve()
      .then(read)
      .then((v) => {
        if (active && v.kind !== "stale")
          setState({ key, value: v.kind === "ok" ? v : { kind: "missing" } });
      })
      .catch(() => {
        if (active) setState({ key, value: { kind: "error" } });
      });
    return () => {
      active = false;
    };
    // The key includes identity, revision and all query/retry inputs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  return state?.key === key ? state.value : { kind: "loading" };
}
function Copy({
  children,
  muted = false,
}: {
  children: ReactNode;
  muted?: boolean;
}) {
  const theme = usePremiumTheme();
  return (
    <Text
      style={[
        muted ? premiumTypography.body : premiumTypography.label,
        { color: muted ? theme.muted : theme.text },
      ]}
    >
      {children}
    </Text>
  );
}
function RemoteState({
  title,
  state,
  retry,
}: {
  title: string;
  state: "loading" | "error" | "missing";
  retry: () => void;
}) {
  const theme = usePremiumTheme();
  return (
    <PremiumPanel title={title}>
      {state === "loading" ? (
        <>
          <ActivityIndicator
            color={theme.accent}
            accessibilityLabel={`Carregando ${title.toLowerCase()}`}
          />
          <Copy muted>Carregando…</Copy>
        </>
      ) : (
        <>
          <PremiumMessage
            error
            message={
              state === "missing"
                ? "Esse registro não está disponível para esta conta."
                : "Não foi possível consultar os dados agora."
            }
          />
          <PremiumButton title="Tentar novamente" onPress={retry} />
        </>
      )}
    </PremiumPanel>
  );
}
function summaryCaption(summary: PromotionSummary) {
  return [
    ["Ativas", summary.active],
    ["Rascunhos", summary.draft],
    ["Pausadas", summary.paused],
    ["Agendadas", summary.scheduled],
    ["Encerradas", summary.ended],
    ["Expiradas", summary.expired],
    ["Usos registrados", summary.usages],
    ["Receita atribuída", money.format(summary.revenue)],
    ["Descontos concedidos", money.format(summary.discount)],
  ] as const;
}
const failure =
  "Não foi possível confirmar a operação. Atualize a lista antes de tentar novamente.";

export function NativeOrganizerPromotions({ client, session, draftCampaignId }: Props) {
  const theme = usePremiumTheme();
  const key = `${session.organizerId}:${session.revision}`;
  const initialFilters = { ...initialPromotionFilters, campaignId: draftCampaignId ?? "" };
  const [query, setQuery] = useState<PromotionFilters>(initialFilters);
  const [draftFilters, setDraftFilters] = useState<PromotionFilters>(
    initialFilters,
  );
  const [page, setPage] = useState(1);
  const [showFilters, setShowFilters] = useState(false);
  const [revision, setRevision] = useState(0);
  const [selection, setSelection] = useState<Selection | null>(null);
  const [confirm, setConfirm] = useState<Confirmation | null>(null);
  const [message, setMessage] = useState("");
  const [problem, setProblem] = useState("");
  const [busy, setBusy] = useState(false);
  const saving = useRef(false);
  const active = () => samePromotionsSession(client, session);
  const consult = `${key}:${revision}`;
  const summary = useRead<PromotionSummary>(consult, () =>
    draftCampaignId ? Promise.resolve({ kind: "missing" }) : loadPromotionSummary(client, session),
  );
  const campaigns = useRead<OrderCampaign[]>(consult, () =>
    draftCampaignId ? Promise.resolve({ kind: "missing" }) : loadPromotionCampaigns(client, session),
  );
  const list = useRead<PromotionPageData>(
    `${consult}:${page}:${JSON.stringify(query)}`,
    async () => {
      const result = await loadPromotionList(client, session, query, page);
      if (draftCampaignId && result.kind === "ok" && result.data.items.some((item) => item.campaign.id !== draftCampaignId))
        throw new Error("Não foi possível confirmar a campanha das promoções.");
      return result;
    },
  );
  const reload = () => setRevision((r) => r + 1);
  function show(next: Selection | null) {
    if (!active() || saving.current) return;
    setMessage("");
    setProblem("");
    setConfirm(null);
    setSelection(next);
  }
  function applyFilters() {
    try {
      promotionListPath(draftFilters, 1);
      setPage(1);
      setQuery(draftFilters);
      setShowFilters(false);
      setProblem("");
    } catch {
      setProblem("Os filtros informados são inválidos.");
    }
  }
  function resetFilters() {
    setDraftFilters(initialFilters);
    setQuery(initialFilters);
    setPage(1);
    setProblem("");
  }
  async function persist(form: PromotionForm, editing?: Promotion) {
    if (saving.current || !active()) return;
    saving.current = true;
    setBusy(true);
    setProblem("");
    setMessage("");
    try {
      if (draftCampaignId) {
        const current = await client.request<{ id?: string; organizerId?: string; status?: string }>(
          `/campaigns/${encodeURIComponent(draftCampaignId)}`,
        );
        if (!active()) return;
        if (
          form.campaignId !== draftCampaignId ||
          (editing && (editing.campaign.id !== draftCampaignId || editing.status !== "DRAFT")) ||
          current?.id !== draftCampaignId || current.organizerId !== session.organizerId || current.status !== "DRAFT"
        ) {
          setProblem("Somente promoções em rascunho desta campanha podem ser salvas aqui.");
          return;
        }
      }
      const result = await savePromotion(client, session, form, editing);
      if (result.kind === "stale" || !active()) return;
      if (result.kind === "missing")
        setProblem("Promoção ou campanha não encontrada para esta conta.");
      else {
        setSelection(null);
        resetFilters();
        reload();
        setMessage(
          editing
            ? "Alterações confirmadas."
            : "Promoção salva como rascunho. Nenhum preço mudou.",
        );
      }
    } catch (error) {
      if (active()) {
        if (
          error instanceof ApiError &&
          (error.status === 400 || error.status === 409)
        ) {
          setProblem(
            "A API rejeitou os dados. Confira o código, a oferta e os limites antes de tentar novamente.",
          );
        } else {
          // An absent response is not evidence that creation did not happen.
          // Close the form and refresh before a second mutation is possible.
          setSelection(null);
          resetFilters();
          setProblem(failure);
          reload();
        }
      }
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }
  async function execute() {
    if (draftCampaignId || !confirm || saving.current || !active()) return;
    const { item, action } = confirm;
    saving.current = true;
    setBusy(true);
    setProblem("");
    setMessage("");
    try {
      const result = await runPromotionAction(client, session, item, action);
      if (result.kind === "stale" || !active()) return;
      setConfirm(null);
      if (result.kind === "missing") {
        setSelection(null);
        setProblem("Promoção indisponível para esta conta.");
        reload();
      } else {
        setSelection(null);
        resetFilters();
        reload();
        setMessage(
          "Operação confirmada. Consulte o estado atualizado na lista.",
        );
      }
    } catch {
      if (active()) {
        setConfirm(null);
        setSelection(null);
        setProblem(failure);
        reload();
      }
    } finally {
      saving.current = false;
      setBusy(false);
    }
  }
  if (!active())
    return (
      <PremiumPage title="Promoções" top={false} bottom>
        <PremiumMessage
          error
          message="Entre como organizador para consultar promoções."
        />
      </PremiumPage>
    );
  if (selection?.kind === "form")
    return (
      <PromotionFormView
        key={selection.item?.id ?? "new"}
        item={selection.item}
        draftCampaignId={draftCampaignId}
        campaigns={campaigns}
        retry={reload}
        problem={problem}
        busy={busy}
        back={() => show(null)}
        save={persist}
      />
    );
  if (selection?.kind === "detail")
    return (
      <PromotionDetail
        key={selection.item.id}
        client={client}
        session={session}
        item={selection.item}
        draftCampaignId={draftCampaignId}
        confirm={confirm}
        busy={busy}
        back={() => show(null)}
        edit={() => show({ kind: "form", item: selection.item })}
        ask={(action) => setConfirm({ item: selection.item, action })}
        cancel={() => setConfirm(null)}
        execute={execute}
      />
    );
  return (
    <PremiumPage title={draftCampaignId ? "Promoções do rascunho" : "Promoções"} top={false} bottom>
      <View style={[styles.hero, { backgroundColor: theme.purple }]}>
        <PremiumGradient />
        <Text style={[premiumTypography.label, { color: theme.white }]}>
          Estratégias de conversão
        </Text>
        <Text style={[premiumTypography.body, { color: theme.white }]}>
          {draftCampaignId
            ? "Cupons e pacotes desta campanha. Este editor não ativa ofertas."
            : "Gerencie cupons e pacotes das suas campanhas. A ativação é manual, nunca automática."}
        </Text>
      </View>
      {!!message && <PremiumMessage message={message} />}
      {!!problem && <PremiumMessage error message={problem} />}
      <PremiumButton
        filled
        title="Criar promoção"
        onPress={() => show({ kind: "form" })}
      />
      {!draftCampaignId && (summary.kind === "ok" ? (
        <PremiumPanel title="Resumo da operação">
          <Copy muted>
            Indicadores de todas as suas campanhas, sem aplicar os filtros da
            lista.
          </Copy>
          <View style={styles.metrics}>
            {summaryCaption(summary.data).map(([label, value]) => (
              <View key={label} style={styles.metric}>
                <Copy>{value}</Copy>
                <Copy muted>{label}</Copy>
              </View>
            ))}
          </View>
        </PremiumPanel>
      ) : (
        <RemoteState title="Resumo" state={summary.kind} retry={reload} />
      ))}
      {!draftCampaignId && <PremiumButton
        title={showFilters ? "Fechar filtros" : "Filtrar promoções"}
        onPress={() => setShowFilters((v) => !v)}
      />}
      {!draftCampaignId && showFilters && (
        <PremiumPanel title="Filtros">
          <PremiumField
            label="Nome ou campanha"
            value={draftFilters.search}
            onChangeText={(search) =>
              setDraftFilters((v) => ({ ...v, search }))
            }
            maxLength={120}
          />
          <Copy>Campanhas</Copy>
          <View style={styles.choices}>
            <PremiumChoice
              label="Todas"
              selected={!draftFilters.campaignId}
              onPress={() => setDraftFilters((v) => ({ ...v, campaignId: "" }))}
            />
            {campaigns.kind === "ok" &&
              campaigns.data.map((c) => (
                <PremiumChoice
                  key={c.id}
                  label={c.title}
                  selected={draftFilters.campaignId === c.id}
                  onPress={() =>
                    setDraftFilters((v) => ({ ...v, campaignId: c.id }))
                  }
                />
              ))}
          </View>
          {campaigns.kind !== "ok" && (
            <RemoteState
              title="Campanhas"
              state={campaigns.kind}
              retry={reload}
            />
          )}
          <Copy>Tipo</Copy>
          <View style={styles.choices}>
            <PremiumChoice
              label="Todos os tipos"
              selected={!draftFilters.type}
              onPress={() => setDraftFilters((v) => ({ ...v, type: "" }))}
            />
            {Object.entries(promotionTypes).map(([k, label]) => (
              <PremiumChoice
                key={k}
                label={label}
                selected={draftFilters.type === k}
                onPress={() =>
                  setDraftFilters((v) => ({
                    ...v,
                    type: k as PromotionFilters["type"],
                  }))
                }
              />
            ))}
          </View>
          <Copy>Status</Copy>
          <View style={styles.choices}>
            <PremiumChoice
              label="Todos os status"
              selected={!draftFilters.status}
              onPress={() => setDraftFilters((v) => ({ ...v, status: "" }))}
            />
            {Object.entries(promotionStatuses).map(([k, label]) => (
              <PremiumChoice
                key={k}
                label={label}
                selected={draftFilters.status === k}
                onPress={() =>
                  setDraftFilters((v) => ({
                    ...v,
                    status: k as PromotionFilters["status"],
                  }))
                }
              />
            ))}
          </View>
          <PremiumButton
            filled
            title="Aplicar filtros"
            onPress={applyFilters}
          />
          <PremiumButton title="Limpar filtros" onPress={resetFilters} />
        </PremiumPanel>
      )}
      {list.kind === "ok" ? (
        <PremiumPanel title="Promoções encontradas">
          <Copy>
            {list.data.total} {list.data.total === 1 ? "registro" : "registros"}
          </Copy>
          {!list.data.items.length && (
            <PremiumMessage
              message={
                page <= 1
                  ? "Nenhuma promoção corresponde à consulta."
                  : "Esta página não existe mais."
              }
            />
          )}
          {list.data.items.map((item) => (
            <PremiumPanel key={item.id} title={item.name}>
              <Copy muted>{item.campaign.title}</Copy>
              <Copy>
                {promotionTypes[item.type]} · {promotionStatuses[item.status]}
              </Copy>
              <Copy muted>
                {item.usageCount} {item.usageCount === 1 ? "uso" : "usos"}
              </Copy>
              <PremiumButton
                title="Ver promoção"
                onPress={() => show({ kind: "detail", item })}
              />
            </PremiumPanel>
          ))}
          {list.data.pages > 1 && (
            <Copy muted>
              Página {page} de {list.data.pages}
            </Copy>
          )}
          {page > 1 && (
            <PremiumButton
              title="Página anterior"
              onPress={() =>
                setPage(Math.max(1, Math.min(page - 1, list.data.pages)))
              }
            />
          )}
          {page < list.data.pages && (
            <PremiumButton
              title="Próxima página"
              onPress={() => setPage((p) => p + 1)}
            />
          )}
        </PremiumPanel>
      ) : (
        <RemoteState title="Promoções" state={list.kind} retry={reload} />
      )}
      <PremiumButton title="Atualizar promoções" onPress={reload} />
    </PremiumPage>
  );
}

function PromotionFormView({
  item,
  draftCampaignId,
  campaigns,
  retry,
  problem,
  busy,
  back,
  save,
}: {
  item?: Promotion;
  draftCampaignId?: string;
  campaigns: Remote<OrderCampaign[]>;
  retry: () => void;
  problem: string;
  busy: boolean;
  back: () => void;
  save: (data: PromotionForm, item?: Promotion) => Promise<void>;
}) {
  const [form, setForm] = useState<PromotionForm>(() =>
    item ? promotionFormFromItem(item) : { ...newPromotionForm(), campaignId: draftCampaignId ?? "" },
  );
  const [error, setError] = useState("");
  const patch = (v: Partial<PromotionForm>) => {
    setForm((f) => ({ ...f, ...v }));
    setError("");
  };
  const submit = () => {
    try {
      promotionPayloadForUI(form, item);
      void save(form, item);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Revise os dados.");
    }
  };
  return (
    <PremiumPage
      title={item ? "Editar promoção" : "Nova promoção"}
      top={false}
      bottom
    >
      <PremiumButton
        title="Voltar para promoções"
        onPress={back}
        disabled={busy}
      />
      <PremiumPanel title={item ? item.campaign.title : "Campanha"}>
        {item ? (
          <Copy muted>
            A campanha e o tipo da promoção permanecem os mesmos.
          </Copy>
        ) : draftCampaignId ? (
          <Copy muted>Oferta vinculada ao rascunho atual.</Copy>
        ) : campaigns.kind === "ok" ? (
          campaigns.data.length ? (
            <View style={styles.choices}>
              {campaigns.data.map((c) => (
                <PremiumChoice
                  key={c.id}
                  label={c.title}
                  selected={form.campaignId === c.id}
                  onPress={() => patch({ campaignId: c.id })}
                />
              ))}
            </View>
          ) : (
            <PremiumMessage message="Nenhuma campanha própria disponível." />
          )
        ) : (
          <RemoteState title="Campanhas" state={campaigns.kind} retry={retry} />
        )}
      </PremiumPanel>
      <PremiumPanel title="Benefício">
        {!item && (
          <View style={styles.choices}>
            <PremiumChoice
              label="Cupom de desconto"
              selected={form.type === "COUPON"}
              onPress={() => patch({ type: "COUPON", value: "", quantity: "" })}
            />
            <PremiumChoice
              label="Pacote de cotas"
              selected={form.type === "PACKAGE"}
              onPress={() =>
                patch({ type: "PACKAGE", value: "", quantity: "" })
              }
            />
          </View>
        )}
        <PremiumField
          label="Nome"
          value={form.name}
          onChangeText={(name) => patch({ name })}
          editable={!busy}
          maxLength={100}
        />
        <PremiumField
          label="Descrição (opcional)"
          value={form.description}
          onChangeText={(description) => patch({ description })}
          editable={!busy}
          maxLength={240}
          multiline
        />
        {form.type === "COUPON" ? (
          <>
            <PremiumField
              label="Código do cupom"
              value={form.couponCode}
              onChangeText={(couponCode) => patch({ couponCode })}
              editable={!busy}
              maxLength={40}
              autoCapitalize="characters"
              autoCorrect={false}
            />
            <View style={styles.choices}>
              <PremiumChoice
                label="Percentual"
                selected={form.discountType === "PERCENTAGE"}
                onPress={() => patch({ discountType: "PERCENTAGE" })}
              />
              <PremiumChoice
                label="Valor fixo"
                selected={form.discountType === "FIXED"}
                onPress={() => patch({ discountType: "FIXED" })}
              />
            </View>
            <PremiumField
              label={
                form.discountType === "PERCENTAGE"
                  ? "Desconto (%)"
                  : "Desconto (R$)"
              }
              value={form.value}
              onChangeText={(value) => patch({ value })}
              editable={!busy}
              keyboardType="decimal-pad"
            />
            <PremiumField
              label="Valor mínimo da compra (R$, opcional)"
              value={form.minimumAmount}
              onChangeText={(minimumAmount) => patch({ minimumAmount })}
              editable={!busy}
              keyboardType="decimal-pad"
            />
            <Copy muted>O desconto precisa deixar um valor a pagar.</Copy>
          </>
        ) : item ? (
          <>
            <Copy>
              {item.quantity} cotas por {money.format(item.packagePrice)}
            </Copy>
            <Copy muted>
              O servidor não altera o preço nem a quantidade deste pacote. Crie
              outro pacote se precisar de novos valores.
            </Copy>
          </>
        ) : (
          <>
            <PremiumField
              label="Quantidade de cotas"
              value={form.quantity}
              onChangeText={(quantity) => patch({ quantity })}
              editable={!busy}
              keyboardType="number-pad"
            />
            <PremiumField
              label="Preço total do pacote (R$)"
              value={form.value}
              onChangeText={(value) => patch({ value })}
              editable={!busy}
              keyboardType="decimal-pad"
            />
          </>
        )}
      </PremiumPanel>
      <PremiumPanel title="Vigência e limites">
        <Copy muted>
          As datas são em UTC. Informe DD/MM/AAAA HH:MM. A vigência não ativa
          automaticamente um rascunho.
        </Copy>
        <PremiumField
          label="Início (opcional, UTC)"
          value={form.startsAt}
          onChangeText={(startsAt) => patch({ startsAt })}
          editable={!busy}
          placeholder="DD/MM/AAAA HH:MM"
          autoCorrect={false}
        />
        <PremiumField
          label="Término (opcional, UTC)"
          value={form.endsAt}
          onChangeText={(endsAt) => patch({ endsAt })}
          editable={!busy}
          placeholder="DD/MM/AAAA HH:MM"
          autoCorrect={false}
        />
        {form.type === "COUPON" && (
          <>
            <PremiumField
              label="Limite total de usos (opcional)"
              value={form.totalLimit}
              onChangeText={(totalLimit) => patch({ totalLimit })}
              editable={!busy}
              keyboardType="number-pad"
            />
            <PremiumField
              label="Limite por comprador (opcional)"
              value={form.perBuyerLimit}
              onChangeText={(perBuyerLimit) => patch({ perBuyerLimit })}
              editable={!busy}
              keyboardType="number-pad"
            />
          </>
        )}
      </PremiumPanel>
      {!!(error || problem) && (
        <PremiumMessage error message={error || problem} />
      )}
      <PremiumButton
        filled
        title={item ? "Salvar alterações" : "Salvar como rascunho"}
        busy={busy}
        disabled={busy}
        onPress={submit}
      />
    </PremiumPage>
  );
}

function PromotionDetail({
  client,
  session,
  item,
  draftCampaignId,
  confirm,
  busy,
  back,
  edit,
  ask,
  cancel,
  execute,
}: Props & {
  item: Promotion;
  confirm: Confirmation | null;
  busy: boolean;
  back: () => void;
  edit: () => void;
  ask: (action: PromotionAction) => void;
  cancel: () => void;
  execute: () => Promise<void>;
}) {
  const [retry, setRetry] = useState(0);
  const [reportsVisible, setReportsVisible] = useState(false);
  const [historyVisible, setHistoryVisible] = useState(false);
  const key = `${session.organizerId}:${session.revision}:${item.id}:${retry}`;
  return (
    <PremiumPage title="Detalhes da promoção" top={false} bottom>
      <PremiumButton
        title="Voltar para promoções"
        disabled={busy}
        onPress={back}
      />
      <PremiumPanel title={item.name}>
        <Copy muted>{item.campaign.title}</Copy>
        <Copy>
          {promotionTypes[item.type]} · {promotionStatuses[item.status]}
        </Copy>
        {!!item.description && <Copy muted>{item.description}</Copy>}
        {item.startsAt && (
          <Copy muted>Início: {date.format(new Date(item.startsAt))} UTC</Copy>
        )}
        {item.endsAt && (
          <Copy muted>Término: {date.format(new Date(item.endsAt))} UTC</Copy>
        )}
        {item.type === "PACKAGE" && (
          <Copy>
            {item.quantity} cotas por {money.format(item.packagePrice)}
          </Copy>
        )}
        {item.coupon && (
          <>
            <Copy>Cupom: {item.coupon.code}</Copy>
            <Copy muted>
              Desconto:{" "}
              {item.coupon.discountType === "FIXED"
                ? money.format(item.coupon.discountValue)
                : `${item.coupon.discountValue}%`}
            </Copy>
          </>
        )}
        {!isSupportedPromotion(item.type) && (
          <PremiumMessage message="Este tipo é apenas consultável no app e não é aplicado ao preço da compra pela API atual." />
        )}
      </PremiumPanel>
      {draftCampaignId ? (
        item.status === "DRAFT" && editablePromotion(item) && (
          <PremiumButton title="Editar promoção" disabled={busy} onPress={edit} />
        )
      ) : confirm ? (
        <PremiumPanel
          title={`Confirmar: ${promotionActions[confirm.action].label}`}
        >
          <Copy muted>{promotionActions[confirm.action].note}</Copy>
          <PremiumButton
            filled
            title="Confirmar ação"
            busy={busy}
            disabled={busy}
            onPress={() => {
              void execute();
            }}
          />
          <PremiumButton title="Cancelar" disabled={busy} onPress={cancel} />
        </PremiumPanel>
      ) : (
        <PremiumPanel title="Gerenciar promoção">
          {editablePromotion(item) && (
            <PremiumButton
              title="Editar promoção"
              disabled={busy}
              onPress={edit}
            />
          )}
          {item.status === "ACTIVE" && isSupportedPromotion(item.type) && (
            <Copy muted>
              Pause a promoção para editar; a reativação é manual.
            </Copy>
          )}
          {enabledPromotionActions(item).map((action) => (
            <PremiumButton
              key={action}
              title={promotionActions[action].label}
              disabled={busy}
              onPress={() => ask(action)}
            />
          ))}
        </PremiumPanel>
      )}
      <PremiumButton
        title={reportsVisible ? "Ocultar relatório" : "Ver relatório"}
        onPress={() => setReportsVisible((v) => !v)}
      />
      {reportsVisible && (
        <DetailReport
          key={key}
          client={client}
          session={session}
          id={item.id}
          retry={() => setRetry((v) => v + 1)}
        />
      )}
      <PremiumButton
        title={historyVisible ? "Ocultar histórico" : "Ver histórico"}
        onPress={() => setHistoryVisible((v) => !v)}
      />
      {historyVisible && (
        <DetailHistory
          key={key}
          client={client}
          session={session}
          id={item.id}
          retry={() => setRetry((v) => v + 1)}
        />
      )}
    </PremiumPage>
  );
}
function DetailReport({
  client,
  session,
  id,
  retry,
}: Props & { id: string; retry: () => void }) {
  const report = useRead<PromotionReport>(id, () =>
    loadPromotionReport(client, session, id),
  );
  return report.kind !== "ok" ? (
    <RemoteState title="Relatório" state={report.kind} retry={retry} />
  ) : (
    <PremiumPanel title="Relatório de usos aprovados">
      <Copy>
        {report.data.usages}{" "}
        {report.data.usages === 1 ? "uso aprovado" : "usos aprovados"} ·{" "}
        {report.data.uniqueBuyers} comprador(es)
      </Copy>
      <Copy>Receita: {money.format(report.data.revenue)}</Copy>
      <Copy muted>
        Ticket médio: {money.format(report.data.averageTicket)} · descontos:{" "}
        {money.format(report.data.grantedDiscount)}
      </Copy>
      {report.data.daily.map((d) => (
        <Copy key={d.date} muted>
          {d.date.split("-").reverse().join("/")} UTC · {d.usages} uso(s) ·{" "}
          {money.format(d.revenue)}
        </Copy>
      ))}
    </PremiumPanel>
  );
}
function DetailHistory({
  client,
  session,
  id,
  retry,
}: Props & { id: string; retry: () => void }) {
  const history = useRead<PromotionEvent[]>(id, () =>
    loadPromotionHistory(client, session, id),
  );
  return history.kind !== "ok" ? (
    <RemoteState title="Histórico" state={history.kind} retry={retry} />
  ) : (
    <PremiumPanel title="Histórico de alterações">
      {!history.data.length && (
        <PremiumMessage message="Nenhuma alteração registrada para esta promoção." />
      )}
      {history.data.map((e) => (
        <View key={e.id}>
          <Copy>{e.action}</Copy>
          <Copy muted>{date.format(new Date(e.createdAt))} UTC</Copy>
        </View>
      ))}
    </PremiumPanel>
  );
}
const styles = StyleSheet.create({
  hero: { borderRadius: 20, overflow: "hidden", padding: 16, gap: 5 },
  choices: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  metrics: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  metric: { minWidth: 105, flexBasis: "44%", flexGrow: 1 },
});
