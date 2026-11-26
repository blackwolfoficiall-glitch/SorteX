import React, {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { useIsFocused } from "@react-navigation/native";
import { ActivityIndicator, Text, View } from "react-native";
import { client } from "../auth/runtime";
import { Button, Notice, Page, colors, money, s } from "../components/ui";
import { buyerInboxSession, type BuyerInboxSession } from "./inbox";
import { readFavorites, type FavoriteChange } from "./favorites";
import type {
  BuyerFavorite,
  FavoriteCampaignCard,
} from "../../../../packages/contracts/src/buyer-favorites";

function useFavoriteSession() {
  useSyncExternalStore(client.subscribe, client.snapshot);
  useSyncExternalStore(client.subscribe, client.activeSessionRevision);
  return buyerInboxSession(client);
}

export function BuyerFavoritesScreen({
  navigation,
}: {
  navigation: {
    navigate: (name: "Campaign", route: { item: FavoriteCampaignCard }) => void;
  };
}) {
  const session = useFavoriteSession();
  const focused = useIsFocused();
  return session ? (
    <Page title="Favoritos">
      {focused && (
        <NativeBuyerFavorites
          key={`${session.buyerId}:${session.revision}`}
          session={session}
          onCampaign={(item) => navigation.navigate("Campaign", { item })}
        />
      )}
    </Page>
  ) : (
    <Page title="Favoritos">
      <Notice
        error
        message="Entre como comprador para consultar seus favoritos."
      />
    </Page>
  );
}

export function NativeBuyerFavoriteToggle({
  campaignId,
}: {
  campaignId: string;
}) {
  const session = useFavoriteSession();
  return (
    session && (
      <NativeBuyerFavorites
        key={`${session.buyerId}:${session.revision}:${campaignId}`}
        session={session}
        campaignId={campaignId}
      />
    )
  );
}

function NativeBuyerFavorites({
  session: { buyerId, revision },
  campaignId,
  onCampaign,
}: {
  session: BuyerInboxSession;
  campaignId?: string;
  onCampaign?: (campaign: FavoriteCampaignCard) => void;
}) {
  const [items, setItems] = useState<BuyerFavorite[] | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(true);
  const inFlight = useRef<symbol | null>(null);
  const update = useCallback(
    async (change?: FavoriteChange) => {
      if (inFlight.current) return;
      const ticket = Symbol();
      inFlight.current = ticket;
      setBusy(true);
      setError("");
      try {
        const result = await readFavorites(
          client,
          { buyerId, revision },
          change,
        );
        if (inFlight.current !== ticket) return;
        if (result.kind === "ok") setItems(result.items);
        else if (result.kind === "unavailable") {
          setItems(null);
          setError(
            "Favoritos indisponíveis nesta versão da API. Tente novamente após a atualização.",
          );
        }
      } catch {
        if (inFlight.current === ticket) {
          setItems(null);
          setError(
            change
              ? "Não foi possível confirmar a alteração. Atualize para conferir; a campanha pode ter saído do ar."
              : "Não foi possível carregar seus favoritos.",
          );
        }
      } finally {
        if (inFlight.current === ticket) {
          inFlight.current = null;
          setBusy(false);
        }
      }
    },
    [buyerId, revision],
  );

  useEffect(() => {
    void update();
    return () => {
      inFlight.current = null;
    };
  }, [update]);

  if (campaignId) {
    const saved = items?.some(({ campaign }) => campaign.id === campaignId);
    return (
      <View style={s.card}>
        <Text accessibilityRole="header" style={s.label}>
          Favoritos privados
        </Text>
        {busy && (
          <ActivityIndicator
            accessibilityLabel="Atualizando favorito"
            color={colors.purple}
          />
        )}
        {!!error && <Notice error message={error} />}
        {items && (
          <Button
            secondary
            title={saved ? "Remover dos favoritos" : "Salvar nos favoritos"}
            disabled={busy}
            onPress={() => void update({ campaignId, saved: !saved })}
          />
        )}
        {!!error && !busy && (
          <Button
            secondary
            title="Tentar novamente"
            onPress={() => void update()}
          />
        )}
      </View>
    );
  }
  return (
    <>
      <Notice message="Somente você vê esta lista. São exibidas apenas campanhas que continuam públicas." />
      {busy && (
        <ActivityIndicator
          accessibilityLabel="Atualizando favoritos"
          color={colors.purple}
        />
      )}
      {!!error && <Notice error message={error} />}
      {items?.length === 0 && !busy && (
        <Notice message="Nenhuma campanha pública salva." />
      )}
      {items?.map(({ id, campaign }) => (
        <View key={id} style={s.card}>
          <Text accessibilityRole="header" style={s.label}>
            {campaign.title}
          </Text>
          <Text style={s.text}>{money(campaign.numberPrice)} por título</Text>
          <Button
            secondary
            title="Ver campanha"
            onPress={() => onCampaign?.(campaign)}
          />
          <Button
            secondary
            title="Remover dos favoritos"
            disabled={busy}
            onPress={() =>
              void update({ campaignId: campaign.id, saved: false })
            }
          />
        </View>
      ))}
      {!busy && (
        <Button
          secondary
          title={error ? "Tentar novamente" : "Atualizar favoritos"}
          onPress={() => void update()}
        />
      )}
    </>
  );
}
