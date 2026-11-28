"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AuthApiError } from "@/lib/auth/client";
import type { BuyerFavorite } from "../../../../packages/contracts/src/buyer-favorites";
import { addFavorite, getFavorites, removeFavorite } from "./client";

export function useFavorites(buyerId: string | null) {
  const [state, setState] = useState<{
    owner: string;
    items: BuyerFavorite[] | null;
    error: string;
  }>();
  const [busy, setBusy] = useState(true);
  const work = useRef<symbol | null>(null);
  const update = useCallback(
    async (change?: { campaignId: string; saved: boolean }) => {
      if (!buyerId || work.current) return;
      const ticket = Symbol();
      work.current = ticket;
      setBusy(true);
      try {
        if (change)
          await (change.saved
            ? addFavorite(change.campaignId)
            : removeFavorite(change.campaignId));
        if (work.current !== ticket) return;
        const items = await getFavorites();
        if (work.current === ticket)
          setState({ owner: buyerId, items, error: "" });
      } catch (error) {
        if (work.current === ticket)
          setState({
            owner: buyerId,
            items: null,
            error:
              !change && error instanceof AuthApiError && error.status === 404
                ? "Favoritos indisponíveis nesta versão da API. Tente novamente após a atualização."
                : change
                  ? "Não foi possível confirmar a alteração. Atualize para conferir; a campanha pode ter saído do ar."
                  : "Não foi possível carregar seus favoritos.",
          });
      } finally {
        if (work.current === ticket) {
          work.current = null;
          setBusy(false);
        }
      }
    },
    [buyerId],
  );

  useEffect(() => {
    void update();
    return () => {
      work.current = null;
    };
  }, [update]);
  const current = state && buyerId === state.owner ? state : undefined;
  return {
    items: current?.items,
    error: current?.error ?? "",
    busy: !!buyerId && (busy || !current),
    update,
  };
}
