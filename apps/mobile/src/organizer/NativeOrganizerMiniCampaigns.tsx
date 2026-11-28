import React, { useEffect, useRef, useState, type ReactNode } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { ApiError } from "../api/client";
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
import type { OrderCampaign } from "./orders";
import {
  canEditMini,
  enabledMiniActions,
  loadMiniCampaigns,
  loadMiniDetail,
  loadMiniEntitlement,
  loadMiniParents,
  miniActions,
  miniFormFromCampaign,
  miniOrderStates,
  miniPayload,
  miniPrizes,
  miniStates,
  newMiniForm,
  runMiniAction,
  sameMiniSession,
  saveMiniCampaign,
  type MiniAction,
  type MiniCampaign,
  type MiniClient,
  type MiniDetail,
  type MiniForm,
  type MiniSession,
} from "./mini-campaigns";

type Props = { client: MiniClient; session: MiniSession };
type Result<T> =
  { kind: "ok"; data: T } | { kind: "loading" | "error" | "missing" };
type Selection =
  { kind: "details"; id: string } | { kind: "form"; item?: MiniCampaign };
const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});
const formatDate = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
  timeZone: "UTC",
});
const iso = (date: string) => formatDate.format(new Date(date)) + " UTC";
function useLoad<T>(
  key: string,
  read: () => Promise<{ kind: "ok"; data: T } | { kind: "stale" | "missing" }>,
  enabled = true,
): Result<T> {
  const [value, setValue] = useState<{ key: string; result: Result<T> }>();
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    void Promise.resolve()
      .then(read)
      .then((v) => {
        if (active && v.kind !== "stale")
          setValue({ key, result: v.kind === "ok" ? v : { kind: "missing" } });
      })
      .catch(() => {
        if (active) setValue({ key, result: { kind: "error" } });
      });
    return () => {
      active = false;
    };
    // The key includes identity, revision, query and retry inputs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, enabled]);
  return enabled && value?.key === key ? value.result : { kind: "loading" };
}
function Body({
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
function Remote({
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
            accessibilityLabel="Carregando"
          />
          <Body muted>Carregando…</Body>
        </>
      ) : (
        <>
          <PremiumMessage
            error
            message={
              state === "missing"
                ? "Registro não encontrado para esta conta."
                : "Não foi possível consultar os dados agora."
            }
          />
          <PremiumButton title="Tentar novamente" onPress={retry} />
        </>
      )}
    </PremiumPanel>
  );
}
const unknownResponse =
  "Não foi possível confirmar a operação. Consulte a lista atualizada antes de tentar novamente.";

export function NativeOrganizerMiniCampaigns({ client, session }: Props) {
  const theme = usePremiumTheme();
  const [selection, select] = useState<Selection | null>(null);
  const [retry, setRetry] = useState(0);
  const [name, setName] = useState("");
  const [status, setStatus] = useState<MiniCampaign["status"] | "">("");
  const [confirm, setConfirm] = useState<MiniAction | null>(null);
  const [busy, setBusy] = useState(false),
    lock = useRef(false);
  const [message, setMessage] = useState(""),
    [problem, setProblem] = useState("");
  const key = `${session.organizerId}:${session.revision}:${retry}`;
  const campaignId = selection?.kind === "details" ? selection.id : "";
  const list = useLoad<MiniCampaign[]>(key, () =>
    loadMiniCampaigns(client, session),
  );
  const parents = useLoad<OrderCampaign[]>(
    key,
    () => loadMiniParents(client, session),
    selection?.kind === "form",
  );
  const detail = useLoad<MiniDetail>(
    key + ":" + campaignId,
    () => loadMiniDetail(client, session, campaignId),
    !!campaignId,
  );
  const entitlement = useLoad<boolean>(
    key,
    () => loadMiniEntitlement(client, session),
    !!campaignId,
  );
  const reload = () => setRetry((v) => v + 1);
  const active = () => sameMiniSession(client, session);
  function open(next: Selection | null) {
    if (lock.current || !active()) return;
    if (next?.kind === "details") reload();
    select(next);
    setConfirm(null);
    setProblem("");
    setMessage("");
  }
  function start() {
    if (lock.current || !active()) return false;
    lock.current = true;
    setBusy(true);
    setProblem("");
    setMessage("");
    return true;
  }
  function done() {
    lock.current = false;
    setBusy(false);
  }
  function completed(text: string) {
    select(null);
    setConfirm(null);
    setStatus("");
    setName("");
    setMessage(text);
    reload();
  }
  async function save(form: MiniForm, edit?: MiniCampaign) {
    if (!start()) return;
    try {
      const r = await saveMiniCampaign(client, session, form, edit);
      if (!active() || r.kind === "stale") return;
      if (r.kind === "missing")
        setProblem("Campanha ou rascunho não encontrado para esta conta.");
      else
        completed(
          edit
            ? "Rascunho atualizado. Não foi publicado."
            : "Rascunho criado. Não foi publicado.",
        );
    } catch (e) {
      if (!active()) return;
      if (e instanceof ApiError && e.status === 403)
        setProblem("O plano atual não habilita a criação de mini campanhas.");
      else if (e instanceof ApiError && e.status === 400)
        setProblem(
          "A API não aceitou os dados. Reveja os títulos, o valor e as datas.",
        );
      else {
        select(null);
        setProblem(unknownResponse);
        reload();
      }
    } finally {
      done();
    }
  }
  async function execute(item: MiniCampaign) {
    if (!confirm || !start()) return;
    try {
      const r = await runMiniAction(client, session, item, confirm);
      if (!active() || r.kind === "stale") return;
      if (r.kind === "missing") {
        select(null);
        setConfirm(null);
        setProblem("Registro indisponível para esta conta.");
        reload();
      } else
        completed(
          confirm === "pause"
            ? "Mini campanha pausada. Nenhum pedido foi alterado."
            : confirm === "duplicate"
              ? "Cópia privada criada como rascunho."
              : "Rascunho excluído.",
        );
    } catch {
      if (active()) {
        select(null);
        setConfirm(null);
        setProblem(unknownResponse);
        reload();
      }
    } finally {
      done();
    }
  }
  if (!active())
    return (
      <PremiumPage title="Mini campanhas" top={false} bottom>
        <PremiumMessage
          error
          message="Entre como organizador para consultar suas mini campanhas."
        />
      </PremiumPage>
    );
  if (selection?.kind === "form")
    return (
      <MiniEditor
        key={selection.item?.id ?? "new"}
        item={selection.item}
        parents={parents}
        retry={reload}
        busy={busy}
        problem={problem}
        back={() => open(null)}
        save={save}
      />
    );
  if (selection?.kind === "details")
    return (
      <PremiumPage title="Mini campanha" top={false} bottom>
        <PremiumButton
          title="Voltar para mini campanhas"
          disabled={busy}
          onPress={() => open(null)}
        />
        {detail.kind !== "ok" ? (
          <Remote title="Detalhes" state={detail.kind} retry={reload} />
        ) : (
          <MiniDetailView
            detail={detail.data}
            confirm={confirm}
            allowDuplicate={entitlement.kind === "ok" && entitlement.data}
            busy={busy}
            onEdit={() => open({ kind: "form", item: detail.data })}
            ask={setConfirm}
            cancel={() => setConfirm(null)}
            execute={() => {
              void execute(detail.data);
            }}
          />
        )}
      </PremiumPage>
    );
  const needle = name.trim().toLocaleLowerCase("pt-BR");
  const visible =
    list.kind === "ok"
      ? list.data.filter(
          (v) =>
            (!status || v.status === status) &&
            (!needle ||
              (v.name + " " + v.parent.title)
                .toLocaleLowerCase("pt-BR")
                .includes(needle)),
        )
      : [];
  return (
    <PremiumPage title="Mini campanhas" top={false} bottom>
      <View style={[styles.hero, { backgroundColor: theme.purple }]}>
        <PremiumGradient />
        <Text style={[premiumTypography.label, { color: theme.white }]}>
          Gestão do organizador
        </Text>
        <Text style={[premiumTypography.body, { color: theme.white }]}>
          Consulte suas mini campanhas e prepare rascunhos privados.
        </Text>
      </View>
      {!!message && <PremiumMessage message={message} />}
      {!!problem && <PremiumMessage error message={problem} />}
      <PremiumButton
        filled
        title="Criar rascunho"
        onPress={() => open({ kind: "form" })}
      />
      <PremiumPanel title="Filtros">
        <PremiumField
          label="Nome ou campanha principal"
          value={name}
          onChangeText={setName}
          maxLength={120}
        />
        <View style={styles.choices}>
          <PremiumChoice
            label="Todos os status"
            selected={!status}
            onPress={() => setStatus("")}
          />
          {Object.entries(miniStates).map(([key, label]) => (
            <PremiumChoice
              key={key}
              label={label}
              selected={status === key}
              onPress={() => setStatus(key as MiniCampaign["status"])}
            />
          ))}
        </View>
      </PremiumPanel>
      {list.kind !== "ok" ? (
        <Remote title="Mini campanhas" state={list.kind} retry={reload} />
      ) : (
        <PremiumPanel title="Minhas mini campanhas">
          <Body>
            {visible.length} {visible.length === 1 ? "registro" : "registros"}
          </Body>
          {!visible.length && (
            <PremiumMessage
              message={
                list.data.length
                  ? "Nenhuma mini campanha corresponde aos filtros."
                  : "Você ainda não tem mini campanhas."
              }
            />
          )}
          {visible.map((item) => (
            <PremiumPanel key={item.id} title={item.name}>
              <Body muted>{item.parent.title}</Body>
              <Body>
                {miniStates[item.status]} · {miniPrizes[item.prizeType]}
              </Body>
              <Body muted>
                {item.allocated} de {item.maxTickets} títulos alocados ·{" "}
                {item.orderCount} pedido(s)
              </Body>
              <PremiumButton
                title="Ver detalhes e pedidos"
                onPress={() => open({ kind: "details", id: item.id })}
              />
            </PremiumPanel>
          ))}
        </PremiumPanel>
      )}
      <PremiumButton title="Atualizar mini campanhas" onPress={reload} />
    </PremiumPage>
  );
}

function MiniDetailView({
  detail,
  confirm,
  allowDuplicate,
  busy,
  onEdit,
  ask,
  cancel,
  execute,
}: {
  detail: MiniDetail;
  confirm: MiniAction | null;
  allowDuplicate: boolean;
  busy: boolean;
  onEdit: () => void;
  ask: (a: MiniAction) => void;
  cancel: () => void;
  execute: () => void;
}) {
  return (
    <>
      <PremiumPanel title={detail.name}>
        <Body>
          {miniStates[detail.status]} · {detail.parent.title}
        </Body>
        {!!detail.description && <Body muted>{detail.description}</Body>}
        <Body>Prêmio: {detail.prizeDescription}</Body>
        <Body muted>
          {miniPrizes[detail.prizeType]} · {money.format(detail.ticketPrice)}{" "}
          por título
        </Body>
        <Body>
          {detail.allocated} de {detail.maxTickets} títulos alocados
        </Body>
        <Body muted>A contagem inclui reservas e não indica pagamento.</Body>
        {detail.purchaseLimit !== null && (
          <Body muted>Limite por reserva: {detail.purchaseLimit}</Body>
        )}
        {detail.startsAt && <Body muted>Início: {iso(detail.startsAt)}</Body>}
        {detail.endsAt && <Body muted>Término: {iso(detail.endsAt)}</Body>}
        {detail.drawAt && (
          <Body muted>Data prevista de apuração: {iso(detail.drawAt)}</Body>
        )}
        <Body>Regulamento</Body>
        <Body muted>{detail.rules}</Body>
      </PremiumPanel>
      {confirm ? (
        <PremiumPanel title={`Confirmar: ${miniActions[confirm].label}`}>
          <Body muted>{miniActions[confirm].note}</Body>
          <PremiumButton
            filled
            title="Confirmar ação"
            busy={busy}
            disabled={busy}
            onPress={execute}
          />
          <PremiumButton title="Cancelar" disabled={busy} onPress={cancel} />
        </PremiumPanel>
      ) : (
        <PremiumPanel title="Gerenciamento">
          {canEditMini(detail) && (
            <PremiumButton title="Editar rascunho" onPress={onEdit} />
          )}
          {enabledMiniActions(detail, allowDuplicate).map((action) => (
            <PremiumButton
              key={action}
              title={miniActions[action].label}
              onPress={() => ask(action)}
            />
          ))}
          {!allowDuplicate && (
            <Body muted>
              Duplicação requer confirmação de um plano com acesso a mini
              campanhas.
            </Body>
          )}
          <Body muted>
            Publicação, link público e registro de resultado não estão
            disponíveis neste app.
          </Body>
        </PremiumPanel>
      )}
      <PremiumPanel title="Pedidos">
        {!detail.orders.length && (
          <PremiumMessage message="Nenhum pedido registrado." />
        )}
        {detail.orders.map((o) => (
          <PremiumPanel key={o.id} title={o.code}>
            <Body>
              {miniOrderStates[o.status]} · {o.quantity} título(s)
            </Body>
            <Body muted>Valor do pedido: {money.format(o.total)}</Body>
            <Body muted>{iso(o.createdAt)}</Body>
          </PremiumPanel>
        ))}
      </PremiumPanel>
      <PremiumPanel title="Resultado">
        {!detail.result ? (
          <PremiumMessage message="Nenhum resultado registrado." />
        ) : detail.result.confirmedAt === null ? (
          <PremiumMessage message="Há um registro de resultado, mas não consta confirmação." />
        ) : (
          <>
            <Body>Número confirmado: {detail.result.confirmedNumber}</Body>
            <Body muted>Confirmação: {iso(detail.result.confirmedAt)}</Body>
          </>
        )}
      </PremiumPanel>
    </>
  );
}

function MiniEditor({
  item,
  parents,
  retry,
  problem,
  busy,
  back,
  save,
}: {
  item?: MiniCampaign;
  parents: Result<OrderCampaign[]>;
  retry: () => void;
  problem: string;
  busy: boolean;
  back: () => void;
  save: (form: MiniForm, item?: MiniCampaign) => Promise<void>;
}) {
  const [draft, setDraft] = useState<MiniForm>(() =>
    item ? miniFormFromCampaign(item) : newMiniForm(),
  );
  const [error, setError] = useState("");
  function set(v: Partial<MiniForm>) {
    setDraft((f) => ({ ...f, ...v }));
    setError("");
  }
  function submit() {
    try {
      miniPayload(draft, item);
      void save(draft, item);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Revise os dados.");
    }
  }
  return (
    <PremiumPage
      title={item ? "Editar rascunho" : "Nova mini campanha"}
      top={false}
      bottom
    >
      <PremiumButton
        title="Voltar para mini campanhas"
        disabled={busy}
        onPress={back}
      />
      <PremiumPanel title="Campanha principal">
        {item ? (
          <Body>{item.parent.title} · não pode ser alterada</Body>
        ) : parents.kind !== "ok" ? (
          <Remote
            title="Campanhas próprias"
            state={parents.kind}
            retry={retry}
          />
        ) : !parents.data.length ? (
          <PremiumMessage message="Você precisa de uma campanha própria para criar este rascunho." />
        ) : (
          <View style={styles.choices}>
            {parents.data.map((item) => (
              <PremiumChoice
                key={item.id}
                label={item.title}
                selected={draft.parentId === item.id}
                onPress={() => set({ parentId: item.id })}
              />
            ))}
          </View>
        )}
      </PremiumPanel>
      <PremiumPanel title="Configuração">
        <PremiumField
          label="Nome"
          value={draft.name}
          onChangeText={(name) => set({ name })}
          maxLength={100}
          editable={!busy}
        />
        <PremiumField
          label="Descrição (opcional)"
          value={draft.description}
          onChangeText={(description) => set({ description })}
          maxLength={600}
          editable={!busy}
          multiline
        />
        <Body>Tipo de prêmio</Body>
        <View style={styles.choices}>
          {Object.entries(miniPrizes).map(([key, label]) => (
            <PremiumChoice
              key={key}
              label={label}
              selected={draft.prizeType === key}
              onPress={() => set({ prizeType: key as MiniForm["prizeType"] })}
            />
          ))}
        </View>
        <PremiumField
          label="Descrição do prêmio"
          value={draft.prizeDescription}
          onChangeText={(prizeDescription) => set({ prizeDescription })}
          maxLength={180}
          editable={!busy}
        />
        <PremiumField
          label="Quantidade de títulos"
          value={draft.maxTickets}
          onChangeText={(maxTickets) => set({ maxTickets })}
          keyboardType="number-pad"
          editable={!busy}
        />
        <PremiumField
          label="Preço por título (R$)"
          value={draft.ticketPrice}
          onChangeText={(ticketPrice) => set({ ticketPrice })}
          keyboardType="decimal-pad"
          editable={!busy}
        />
        <PremiumField
          label="Limite de títulos por reserva (opcional)"
          value={draft.purchaseLimit}
          onChangeText={(purchaseLimit) => set({ purchaseLimit })}
          keyboardType="number-pad"
          editable={!busy}
        />
        <PremiumField
          label="Regulamento"
          value={draft.rules}
          onChangeText={(rules) => set({ rules })}
          maxLength={12000}
          multiline
          editable={!busy}
        />
      </PremiumPanel>
      <PremiumPanel title="Datas (opcionais, em UTC)">
        <Body muted>
          Use DD/MM/AAAA HH:MM. Nenhuma data publica ou apura esta mini campanha
          automaticamente.
        </Body>
        <PremiumField
          label="Início"
          value={draft.startsAt}
          onChangeText={(startsAt) => set({ startsAt })}
          placeholder="DD/MM/AAAA HH:MM"
          editable={!busy}
        />
        <PremiumField
          label="Término"
          value={draft.endsAt}
          onChangeText={(endsAt) => set({ endsAt })}
          placeholder="DD/MM/AAAA HH:MM"
          editable={!busy}
        />
        <PremiumField
          label="Data prevista de apuração"
          value={draft.drawAt}
          onChangeText={(drawAt) => set({ drawAt })}
          placeholder="DD/MM/AAAA HH:MM"
          editable={!busy}
        />
      </PremiumPanel>
      {!!(error || problem) && (
        <PremiumMessage error message={error || problem} />
      )}
      <PremiumButton
        filled
        title={item ? "Salvar alterações" : "Salvar rascunho privado"}
        busy={busy}
        disabled={busy}
        onPress={submit}
      />
    </PremiumPage>
  );
}
const styles = StyleSheet.create({
  hero: { borderRadius: 20, overflow: "hidden", padding: 16, gap: 5 },
  choices: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
});
