import { useEffect, useRef, useState } from "react";
import { Text, View } from "react-native";
import { ApiError } from "../api/client";
import { client } from "../auth/runtime";
import { activeCoverSession } from "../domain/organizer-draft-cover";
import {
  changeDraftPrize,
  loadDraftPrizes,
  prizeTypes,
  type DraftPrize,
  type PrizeFields,
  type PrizeType,
} from "../domain/organizer-draft-prizes";
import { Button, Field, Notice, Page, s } from "./ui";

const labels: Record<PrizeType, string> = {
  PIX: "Pix",
  PRODUCT: "Produto",
  GIFT_CARD: "Vale-presente",
  OTHER: "Outro",
};
const empty: PrizeFields = {
  exactNumber: "",
  description: "",
  value: "",
  type: "PRODUCT",
};

export function NativeOrganizerDraftPrizes({
  accountId,
  revision,
  campaignId,
}: {
  accountId: string;
  revision: number;
  campaignId: string;
}) {
  const ctx = { accountId, revision, campaignId };
  const mounted = useRef(false);
  const locked = useRef(false);
  const [data, setData] =
    useState<Awaited<ReturnType<typeof loadDraftPrizes>>>();
  const [page, setPage] = useState(1);
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [needsRefresh, setNeedsRefresh] = useState(false);
  const [fields, setFields] = useState<PrizeFields>();
  const [target, setTarget] = useState<DraftPrize>();
  const [remove, setRemove] = useState(false);
  const active = () =>
    mounted.current && activeCoverSession(client, accountId, revision);
  const change = <K extends keyof PrizeFields>(key: K, value: PrizeFields[K]) =>
    setFields((prev) => prev && { ...prev, [key]: value });

  function cancel() {
    setFields(undefined);
    setTarget(undefined);
    setRemove(false);
  }
  async function read(next: number) {
    let result = await loadDraftPrizes(client, ctx, next, active);
    if (next > result.pages) {
      next = result.pages;
      result = await loadDraftPrizes(client, ctx, next, active);
    }
    if (!active()) return;
    setPage(next);
    setData(result);
  }
  async function action(work: () => Promise<void>) {
    if (locked.current || !active()) return;
    locked.current = true;
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await work();
    } catch (cause) {
      if (!active()) return;
      if (
        cause instanceof ApiError &&
        (cause.status === 0 ||
          (cause.status >= 200 && cause.status < 300) ||
          cause.status >= 500 ||
          [401, 403, 404, 409].includes(cause.status))
      ) {
        setNeedsRefresh(true);
        cancel();
      }
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível alterar a cota.",
      );
    } finally {
      locked.current = false;
      if (active()) setBusy(false);
    }
  }
  useEffect(() => {
    mounted.current = true;
    void action(() => read(1));
    return () => {
      mounted.current = false;
    };
  }, [campaignId, accountId, revision]);
  async function save() {
    if (!fields && !remove) return;
    const command =
      remove && target
        ? { kind: "remove" as const, prize: target }
        : fields && target
          ? { kind: "edit" as const, prize: target, fields }
          : fields
            ? { kind: "create" as const, fields }
            : null;
    if (!command) return;
    await action(async () => {
      await changeDraftPrize(client, ctx, command, active);
      if (!active()) return;
      cancel();
      setNeedsRefresh(true);
      await read(page);
      if (!active()) return;
      setNeedsRefresh(false);
      setMessage(
        command.kind === "create"
          ? "Cota incluída."
          : command.kind === "edit"
            ? "Prêmio atualizado."
            : "Cota removida.",
      );
    });
  }

  return (
    <Page title="Cotas premiadas do rascunho">
      <Notice message="Os números ficam privados. Estas alterações não apuram, entregam ou pagam prêmios." />
      {message ? <Notice message={message} /> : null}
      {error ? <Notice error message={error} /> : null}
      {(needsRefresh || (!data && !busy)) && (
        <Button
          title="Atualizar cotas"
          busy={busy}
          onPress={() =>
            void action(async () => {
              await read(page);
              if (active()) setNeedsRefresh(false);
            })
          }
        />
      )}
      {!data && busy ? <Notice message="Carregando cotas…" /> : null}
      {data &&
        !needsRefresh &&
        (remove && target ? (
          <View style={s.card}>
            <Notice
              message={`Remover a cota privada ${target.exactNumber} deste rascunho?`}
            />
            <Button
              title="Confirmar remoção"
              busy={busy}
              onPress={() => void save()}
            />
            <Button
              secondary
              title="Voltar sem remover"
              disabled={busy}
              onPress={cancel}
            />
          </View>
        ) : fields ? (
          <View style={s.card}>
            {target ? (
              <Text style={s.label}>Cota privada {target.exactNumber}</Text>
            ) : (
              <Field
                label="Número exato da cota"
                value={fields.exactNumber}
                onChangeText={(v) => change("exactNumber", v)}
                keyboardType="number-pad"
                maxLength={String(data.campaign.totalNumbers! - 1).length}
                editable={!busy}
              />
            )}
            <Field
              label="Nome do prêmio"
              value={fields.description}
              onChangeText={(v) => change("description", v)}
              maxLength={120}
              editable={!busy}
            />
            <Field
              label="Valor do prêmio"
              value={fields.value}
              onChangeText={(v) => change("value", v)}
              keyboardType="decimal-pad"
              editable={!busy}
            />
            <Text style={s.label}>Tipo escolhido: {labels[fields.type]}</Text>
            <View style={s.row}>
              {prizeTypes.map((type) => (
                <Button
                  key={type}
                  secondary
                  disabled={busy || fields.type === type}
                  title={labels[type]}
                  onPress={() => change("type", type)}
                />
              ))}
            </View>
            <Button
              title={target ? "Salvar prêmio" : "Incluir cota"}
              busy={busy}
              onPress={() => void save()}
            />
            <Button
              secondary
              title="Cancelar alteração"
              disabled={busy}
              onPress={cancel}
            />
          </View>
        ) : (
          <>
            <Button
              title="Adicionar cota premiada"
              disabled={busy}
              onPress={() => setFields(empty)}
            />
            {data.prizes.length === 0 ? (
              <Notice message="Nenhuma cota premiada cadastrada." />
            ) : null}
            {data.prizes.map((prize) => (
              <View key={prize.id} style={s.card}>
                <Text style={s.label}>
                  Cota privada {prize.exactNumber || "não informada"}
                </Text>
                <Text style={s.text}>
                  {prize.description} · {labels[prize.type]} ·{" "}
                  {prize.value.toLocaleString("pt-BR", {
                    style: "currency",
                    currency: "BRL",
                  })}
                </Text>
                <Notice
                  message={
                    prize.status === "CANCELLED"
                      ? "Pausada"
                      : prize.status === "AVAILABLE"
                        ? "Configurada para o rascunho"
                        : "Bloqueada para edição"
                  }
                />
                {prize.editable && (
                  <>
                    <Button
                      secondary
                      title="Editar prêmio"
                      disabled={busy}
                      onPress={() => {
                        setTarget(prize);
                        setFields({
                          ...prize,
                          value: String(prize.value).replace(".", ","),
                        });
                      }}
                    />
                    <Button
                      secondary
                      title="Remover cota"
                      disabled={busy}
                      onPress={() => {
                        setTarget(prize);
                        setRemove(true);
                      }}
                    />
                  </>
                )}
              </View>
            ))}
            {data.pages > 1 && (
              <Notice message={`Página ${page} de ${data.pages}`} />
            )}
            {page > 1 && (
              <Button
                secondary
                title="Página anterior"
                disabled={busy}
                onPress={() => void action(() => read(page - 1))}
              />
            )}
            {page < data.pages && (
              <Button
                secondary
                title="Próxima página"
                disabled={busy}
                onPress={() => void action(() => read(page + 1))}
              />
            )}
          </>
        ))}
    </Page>
  );
}
