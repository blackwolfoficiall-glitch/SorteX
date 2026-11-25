import React, { useEffect, useMemo, useRef, useState } from "react";
import { Pressable, Text, View } from "react-native";
import type { SortexClient } from "../api/client";
import { Button, Notice, money, s } from "../components/ui";
import {
  BuyerSandboxPix,
  sandboxPixStatuses,
  type SandboxPix,
} from "./sandbox-pix";
import { isActiveReservation, type BuyerOrder } from "./purchases";

export function SandboxPixCard({
  client,
  buyerId,
  order,
  onOrderChanged,
}: {
  client: SortexClient;
  buyerId: string;
  order: BuyerOrder;
  onOrderChanged: () => void;
}) {
  const api = useMemo(
    () => new BuyerSandboxPix(client, buyerId, true),
    [client, buyerId],
  );
  const [enabled, setEnabled] = useState<boolean | null>(null);
  const [payment, setPayment] = useState<SandboxPix | null>(null);
  const [accepted, setAccepted] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [uncertain, setUncertain] = useState(false);
  const lock = useRef(false);

  useEffect(() => {
    let mounted = true;
    void api
      .enabled()
      .then(async (value) => {
        if (!mounted) return;
        if (!value) {
          setEnabled(false);
          return;
        }
        const current = await api.get(order.id);
        if (!mounted) return;
        setPayment(current);
        setEnabled(true);
      })
      .catch(() => {
        if (mounted) setEnabled(false);
      });
    return () => {
      mounted = false;
    };
  }, [api, order.id]);

  async function action(create: boolean) {
    if (lock.current) return;
    if (create && (!accepted || !isActiveReservation(order))) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      if (!create && !(await api.enabled())) {
        setEnabled(false);
        return;
      }
      const value = create
        ? await api.create(order.id, accepted)
        : await api.get(order.id);
      setPayment(value);
      setUncertain(false);
      if (value?.status === "APPROVED" && order.status !== "PAID")
        onOrderChanged();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível consultar o Pix de teste.",
      );
      if (create) setUncertain(true);
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }

  if (enabled !== true) {
    return (
      <Notice
        message={
          enabled === null
            ? "Conferindo se o Pix de teste está disponível..."
            : "Pix de teste indisponível neste ambiente."
        }
      />
    );
  }

  const canCreate =
    isActiveReservation(order) && (!payment || payment.awaitingProvider);
  return (
    <View style={s.card}>
      <Text accessibilityRole="header" style={s.label}>
        Pix de teste
      </Text>
      <Notice message="Somente homologação. Não pague pelo seu banco. Nenhuma instrução de Pix real será exibida." />
      {payment && (
        <>
          <Text selectable style={s.text}>
            Referência SorteX: {payment.id}
          </Text>
          <Text style={s.text}>
            {money(payment.amount)} · {sandboxPixStatuses[payment.status]}
          </Text>
          {payment.awaitingProvider && (
            <Notice message="Aguardando retorno do provedor de teste." />
          )}
        </>
      )}
      {error ? <Notice error message={error} /> : null}
      {uncertain && (
        <Notice message="Confirme o status antes de repetir. A mesma reserva reaproveita a tentativa ativa." />
      )}
      {canCreate && (
        <>
          <Pressable
            accessibilityRole="checkbox"
            accessibilityLabel="Entendo que este Pix é apenas para teste"
            accessibilityState={{ checked: accepted, disabled: busy }}
            disabled={busy}
            onPress={() => setAccepted((value) => !value)}
            style={[s.pill, accepted && s.selected]}
          >
            <Text style={s.text}>
              {accepted ? "✓ " : ""}Entendo que este Pix é apenas para teste
            </Text>
          </Pressable>
          <Button
            title={
              payment ? "Retomar tentativa de teste" : "Gerar Pix de teste"
            }
            disabled={!accepted || uncertain}
            busy={busy}
            onPress={() => void action(true)}
          />
        </>
      )}
      <Button
        secondary
        disabled={busy}
        title="Consultar Pix de teste"
        onPress={() => void action(false)}
      />
    </View>
  );
}
