import React, {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { Alert, Pressable, Text, View } from "react-native";
import { randomUUID } from "expo-crypto";
import type { Campaign } from "../../../../packages/contracts/src/mobile";
import { ApiError, type SortexClient } from "../api/client";
import { Button, Field, Notice, money, s, status } from "../components/ui";
import {
  BuyerPurchases,
  isActiveReservation,
  parseDigits,
  purchaseLimits,
  reservationAttempt,
  titleNumber,
  type Availability,
  type BuyerOrder,
  type NumbersPage,
  type ReservationAttempt,
  type ReservationInput,
} from "./purchases";

import { SandboxPixCard } from "./SandboxPixCard";

type CampaignRef = Pick<Campaign, "id" | "slug" | "totalNumbers">;
const errorText = (error: unknown) =>
  error instanceof Error
    ? error.message
    : "Não foi possível concluir. Tente novamente.";
const orderStatus = (value: string) =>
  ({
    AWAITING_PAYMENT: "Aguardando pagamento",
    RESERVED: "Reservado",
    CANCELLED: "Cancelado",
    REFUNDED: "Estornado",
  })[value] || status(value);

function ReservationSummary({ order }: { order: BuyerOrder }) {
  return (
    <>
      <Text style={s.text}>
        {order.quantity} título(s) · {money(order.total)}
      </Text>
      <Notice message={orderStatus(order.status)} />
      {order.expiresAt &&
        ["RESERVED", "AWAITING_PAYMENT"].includes(order.status) && (
          <Notice
            message={`Prazo informado pelo servidor: ${new Date(order.expiresAt).toLocaleString("pt-BR")}`}
          />
        )}
    </>
  );
}

export function NativeBuyerReservation({
  client,
  campaign,
  onOrder,
}: {
  client: SortexClient;
  campaign: CampaignRef;
  onOrder?: (order: BuyerOrder) => void;
}) {
  const { status: signed, user } = useSyncExternalStore(
    client.subscribe,
    client.snapshot,
  );
  if (signed !== "signedIn" || user?.role !== "BUYER") return null;
  return (
    <ReservationCard
      key={JSON.stringify([user.id, campaign.id, campaign.slug])}
      {...{ client, campaign, onOrder }}
      buyerId={user.id}
    />
  );
}

function ReservationCard({
  client,
  campaign,
  buyerId,
  onOrder,
}: {
  client: SortexClient;
  campaign: CampaignRef;
  buyerId: string;
  onOrder?: (order: BuyerOrder) => void;
}) {
  const api = useMemo(
    () => new BuyerPurchases(client, buyerId),
    [client, buyerId],
  );
  const [availability, setAvailability] = useState<Availability | null>(null);
  const [order, setOrder] = useState<BuyerOrder | null>(null);
  const [numbers, setNumbers] = useState<NumbersPage | null>(null);
  const [selection, setSelection] = useState<number[]>([]);
  const [quantity, setQuantity] = useState("");
  const [searchText, setSearchText] = useState("");
  const [search, setSearch] = useState<number | undefined>();
  const [page, setPage] = useState(1);
  const [reload, setReload] = useState(0);
  const [checking, setChecking] = useState(true);
  const [loadingNumbers, setLoadingNumbers] = useState(false);
  const [working, setWorking] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [error, setError] = useState("");
  const [numbersError, setNumbersError] = useState("");
  const [inputError, setInputError] = useState("");
  const [now, setNow] = useState(Date.now);
  const pendingAttempt = useRef<ReservationAttempt | null>(null);
  const busyRef = useRef(false);
  const lastOrder = useRef<string | null>(null);
  const active = order ? isActiveReservation(order, now) : false;
  const mode = availability?.selectionMode;
  const total = availability?.totalNumbers;
  const count = mode === "MANUAL" ? selection.length : parseDigits(quantity);
  const limits = availability ? purchaseLimits(availability) : null;

  useEffect(() => {
    let valid = true;
    setChecking(true);
    const attempt = pendingAttempt.current;
    const owned =
      lastOrder.current && !attempt
        ? api.order(lastOrder.current)
        : api.current();
    void Promise.all([api.availability(campaign.slug), owned])
      .then(([capacity, current]) => {
        if (!valid) return;
        if (capacity.campaignId !== campaign.id)
          throw new ApiError("As cotas não correspondem à campanha aberta.");
        setAvailability(capacity);
        if (
          current?.campaign?.id === campaign.id &&
          (!attempt || current.idempotencyKey === attempt.idempotencyKey)
        ) {
          lastOrder.current = current.id;
          setOrder(current);
          if (isActiveReservation(current)) {
            pendingAttempt.current = null;
            setUncertain(false);
            setSelection([]);
            setQuantity("");
          }
        }
      })
      .catch((cause: unknown) => {
        if (valid) setError(errorText(cause));
      })
      .finally(() => {
        if (valid) setChecking(false);
      });
    return () => {
      valid = false;
    };
  }, [api, campaign.id, campaign.slug, reload]);

  useEffect(() => {
    if (mode !== "MANUAL" || !total || active) return;
    let valid = true;
    setLoadingNumbers(true);
    setNumbers(null);
    setNumbersError("");
    void api
      .numbers(campaign.slug, total, page, search)
      .then((value) => {
        if (valid) setNumbers(value);
      })
      .catch((cause: unknown) => {
        if (valid) setNumbersError(errorText(cause));
      })
      .finally(() => {
        if (valid) setLoadingNumbers(false);
      });
    return () => {
      valid = false;
    };
  }, [active, api, campaign.slug, mode, total, page, search, reload]);

  useEffect(() => {
    if (!order || !isActiveReservation(order)) return;
    const timeout = setTimeout(
      () => {
        setNow(Date.now());
        setReload((value) => value + 1);
      },
      Math.max(10, Date.parse(order.expiresAt!) - Date.now() + 10),
    );
    return () => clearTimeout(timeout);
  }, [order]);

  const refresh = () => {
    setError("");
    setNow(Date.now());
    setReload((value) => value + 1);
  };
  const findNumber = () => {
    const value = parseDigits(searchText.trim());
    if (value === null || value >= (total || 0)) {
      setInputError("Informe um número dentro da faixa da campanha.");
      return;
    }
    setInputError("");
    setPage(1);
    if (value === search) refresh();
    else setSearch(value);
  };

  async function reserve() {
    if (
      !availability ||
      busyRef.current ||
      active ||
      checking ||
      count === null
    )
      return;
    const input: ReservationInput =
      availability.selectionMode === "MANUAL"
        ? { mode: "MANUAL", numbers: selection }
        : { mode: "RANDOM", quantity: count };
    busyRef.current = true;
    setWorking(true);
    setError("");
    try {
      const attempt = reservationAttempt(
        campaign.id,
        input,
        pendingAttempt.current,
        randomUUID,
      );
      pendingAttempt.current = attempt;
      const saved = await api.reserve(
        availability,
        input,
        attempt.idempotencyKey,
        uncertain,
      );
      lastOrder.current = saved.id;
      pendingAttempt.current = null;
      setUncertain(false);
      setOrder(saved);
      setNow(Date.now());
      setSelection([]);
      setQuantity("");
      setReload((value) => value + 1);
    } catch (cause) {
      const unknown =
        cause instanceof ApiError &&
        (cause.status === 0 || cause.status >= 500);
      setUncertain(unknown);
      setError(
        unknown
          ? `${errorText(cause)} Confira a reserva ou repita a mesma tentativa; não altere as cotas até confirmar.`
          : errorText(cause),
      );
      if (!unknown) pendingAttempt.current = null;
      if (!unknown && cause instanceof ApiError && cause.status === 409) {
        setSelection([]);
        setReload((value) => value + 1);
      }
    } finally {
      busyRef.current = false;
      setWorking(false);
    }
  }

  function cancel(current: BuyerOrder) {
    Alert.alert(
      "Cancelar reserva?",
      "As cotas reservadas poderão ser liberadas para outros compradores.",
      [
        { text: "Manter reserva", style: "cancel" },
        {
          text: "Cancelar reserva",
          style: "destructive",
          onPress: () =>
            void (async () => {
              if (busyRef.current) return;
              busyRef.current = true;
              setWorking(true);
              setError("");
              try {
                setOrder(await api.cancel(current.id));
                setNow(Date.now());
                setReload((value) => value + 1);
              } catch (cause) {
                setError(errorText(cause));
              } finally {
                busyRef.current = false;
                setWorking(false);
              }
            })(),
        },
      ],
    );
  }

  return (
    <View style={s.card}>
      <Text accessibilityRole="header" style={s.label}>
        Reservar títulos
      </Text>
      {error ? <Notice error message={error} /> : null}
      {checking ? (
        <Notice message="Consultando disponibilidade e reserva..." />
      ) : null}
      {order && (
        <View style={s.card}>
          <ReservationSummary order={order} />
          {active ? (
            <>
              <Notice message="A reserva não é pagamento. Nenhuma cobrança será iniciada neste módulo." />
              <Button
                secondary
                disabled={working || checking}
                title="Cancelar reserva"
                onPress={() => cancel(order)}
              />
            </>
          ) : null}
          {onOrder && (
            <Button
              secondary
              disabled={working}
              title="Ver pedido"
              onPress={() => onOrder(order)}
            />
          )}
        </View>
      )}
      {!active && availability && limits && (
        <>
          <Notice
            message={`${availability.availableNumbers} títulos disponíveis · Mínimo: ${limits.min}`}
          />
          {limits.max < limits.min && (
            <Notice message="Não há títulos suficientes para a reserva mínima." />
          )}
          {mode === "MANUAL" && total ? (
            <>
              <Field
                label="Buscar número"
                keyboardType="number-pad"
                editable={!working && !uncertain}
                value={searchText}
                onChangeText={setSearchText}
              />
              <View style={s.row}>
                <Button
                  secondary
                  disabled={working || loadingNumbers || uncertain}
                  title="Buscar"
                  onPress={findNumber}
                />
                {search !== undefined && (
                  <Button
                    secondary
                    disabled={working || loadingNumbers || uncertain}
                    title="Limpar busca"
                    onPress={() => {
                      setInputError("");
                      setSearchText("");
                      setPage(1);
                      setSearch(undefined);
                    }}
                  />
                )}
              </View>
              {inputError && <Notice error message={inputError} />}
              {numbersError && <Notice error message={numbersError} />}
              {loadingNumbers && <Notice message="Consultando cotas..." />}
              {numbers && numbers.items.length === 0 && (
                <Notice message="Nenhuma cota encontrada." />
              )}
              <View style={s.row}>
                {numbers?.items.map(({ number, status: state }) => {
                  const selected = selection.includes(number);
                  const disabled =
                    working ||
                    uncertain ||
                    state !== "AVAILABLE" ||
                    (!selected && selection.length >= limits.max);
                  const label = titleNumber(number, total);
                  return (
                    <Pressable
                      key={number}
                      accessibilityRole="checkbox"
                      accessibilityLabel={
                        state === "AVAILABLE"
                          ? `Cota ${label}`
                          : `Cota ${label} indisponível`
                      }
                      accessibilityState={{ checked: selected, disabled }}
                      disabled={disabled}
                      style={[
                        s.pill,
                        selected && s.selected,
                        disabled && { opacity: 0.5 },
                      ]}
                      onPress={() =>
                        setSelection((items) =>
                          selected
                            ? items.filter((item) => item !== number)
                            : [...items, number],
                        )
                      }
                    >
                      <Text style={s.text}>{label}</Text>
                    </Pressable>
                  );
                })}
              </View>
              {numbers && search === undefined && (
                <View style={s.row}>
                  <Button
                    secondary
                    disabled={page <= 1 || working || uncertain}
                    title="Página anterior de cotas"
                    onPress={() => setPage(page - 1)}
                  />
                  <Button
                    secondary
                    disabled={
                      page * numbers.limit >= numbers.total ||
                      working ||
                      uncertain
                    }
                    title="Próxima página de cotas"
                    onPress={() => setPage(page + 1)}
                  />
                </View>
              )}
              <Notice message={`Selecionadas: ${selection.length}`} />
              {selection.length > 0 && (
                <Button
                  secondary
                  disabled={working || uncertain}
                  title="Limpar seleção"
                  onPress={() => setSelection([])}
                />
              )}
            </>
          ) : mode === "RANDOM" ? (
            <Field
              label="Quantidade de títulos aleatórios"
              keyboardType="number-pad"
              editable={!working && !uncertain}
              value={quantity}
              onChangeText={setQuantity}
            />
          ) : null}
          <Button
            title={
              uncertain ? "Repetir a mesma tentativa" : "Reservar sem pagar"
            }
            busy={working}
            disabled={
              checking ||
              count === null ||
              (!uncertain && (count < limits.min || count > limits.max))
            }
            onPress={() => void reserve()}
          />
        </>
      )}
      <Button
        secondary
        disabled={working || checking}
        title="Atualizar reserva e cotas"
        onPress={refresh}
      />
    </View>
  );
}

export function NativeBuyerOrder({
  client,
  orderId,
  totalNumbers,
}: {
  client: SortexClient;
  orderId: string;
  totalNumbers?: number;
}) {
  const { status: signed, user } = useSyncExternalStore(
    client.subscribe,
    client.snapshot,
  );
  if (signed !== "signedIn" || user?.role !== "BUYER") return null;
  return (
    <OrderCard
      key={JSON.stringify([user.id, orderId])}
      client={client}
      buyerId={user.id}
      orderId={orderId}
      totalNumbers={totalNumbers}
    />
  );
}

function OrderCard({
  client,
  buyerId,
  orderId,
  totalNumbers,
}: {
  client: SortexClient;
  buyerId: string;
  orderId: string;
  totalNumbers?: number;
}) {
  const api = useMemo(
    () => new BuyerPurchases(client, buyerId),
    [client, buyerId],
  );
  const [data, setData] =
    useState<Awaited<ReturnType<BuyerPurchases["ticketOrder"]>>>();
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  useEffect(() => {
    let mounted = true;
    setError("");
    setData(undefined);
    void api
      .ticketOrder(orderId)
      .then((value) => {
        if (mounted) setData(value);
      })
      .catch((cause: unknown) => {
        if (mounted) setError(errorText(cause));
      });
    return () => {
      mounted = false;
    };
  }, [api, orderId, reload]);
  return (
    <View style={s.card}>
      {error ? (
        <Notice error message={error} />
      ) : !data ? (
        <Notice message="Consultando pedido e títulos..." />
      ) : (
        <>
          <Text style={s.label}>{data.order.campaign.title}</Text>
          <ReservationSummary order={data.order} />
          {process.env.EXPO_PUBLIC_ENABLE_NATIVE_SANDBOX_PIX === "1" && (
            <SandboxPixCard
              client={client}
              buyerId={buyerId}
              order={data.order}
              onOrderChanged={() => setReload((value) => value + 1)}
            />
          )}
          <Text style={s.label}>Títulos confirmados</Text>
          {data.tickets.length ? (
            <Text selectable style={s.text}>
              {data.tickets
                .map(({ number }) =>
                  totalNumbers === undefined
                    ? String(number)
                    : titleNumber(number, totalNumbers),
                )
                .join(" · ")}
            </Text>
          ) : (
            <Notice message="Nenhum título confirmado disponível." />
          )}
        </>
      )}
      <Button
        secondary
        title="Atualizar pedido"
        onPress={() => setReload((value) => value + 1)}
      />
    </View>
  );
}
