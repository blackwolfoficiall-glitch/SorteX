import { ApiError, type SortexClient } from "../api/client";

export type OrganizerLifecycleAction =
  "publish" | "pause" | "reactivate" | "finish";
export type OrganizerCampaignState = {
  id: string;
  title: string;
  status: string;
  organizerId?: string;
  publicationBlocked?: boolean;
  adminReviewStatus?: string | null;
};

const transitions = {
  publish: { endpoint: "publish", status: "PUBLISHED" },
  pause: { endpoint: "pause", status: "PAUSED" },
  reactivate: { endpoint: "publish", status: "PUBLISHED" },
  finish: { endpoint: "finish", status: "FINISHED" },
} as const;

export function organizerLifecycleOptions(campaign: OrganizerCampaignState): {
  actions: OrganizerLifecycleAction[];
  notice?: string;
} {
  const releaseBlock =
    campaign.publicationBlocked !== false
      ? "A publicação está bloqueada ou não foi possível confirmar a liberação."
      : ["REJECTED", "CHANGES_REQUESTED"].includes(
            campaign.adminReviewStatus ?? "",
          )
        ? "A campanha tem uma pendência de revisão. Consulte o painel web antes de publicar."
        : undefined;
  switch (campaign.status) {
    case "DRAFT":
      return releaseBlock
        ? { actions: [], notice: releaseBlock }
        : { actions: ["publish"] };
    case "PENDING_REVIEW":
      return {
        actions: [],
        notice:
          "A campanha aguarda revisão administrativa. Não é possível publicá-la pelo app.",
      };
    case "PUBLISHED":
      return { actions: ["pause", "finish"] };
    case "PAUSED":
      return releaseBlock
        ? { actions: ["finish"], notice: releaseBlock }
        : { actions: ["reactivate", "finish"] };
    default:
      return {
        actions: [],
        notice:
          "Não há ações de publicação, pausa ou encerramento disponíveis para esta situação.",
      };
  }
}

type LifecycleClient = Pick<SortexClient, "snapshot" | "request">;
function assertOrganizer(client: LifecycleClient, accountId: string) {
  const session = client.snapshot();
  if (
    session.status !== "signedIn" ||
    session.user?.role !== "ORGANIZER" ||
    session.user.id !== accountId
  )
    throw new ApiError(
      "Entre com a conta de organizador que possui esta campanha.",
      401,
    );
}
export async function runOrganizerLifecycle(
  client: LifecycleClient,
  accountId: string,
  campaign: OrganizerCampaignState,
  action: OrganizerLifecycleAction,
): Promise<OrganizerCampaignState> {
  assertOrganizer(client, accountId);
  if (!campaign.id || campaign.organizerId !== accountId)
    throw new ApiError("A campanha não pertence a esta conta.", 403);
  if (!organizerLifecycleOptions(campaign).actions.includes(action))
    throw new ApiError("Esta ação não está disponível para a campanha.", 400);
  const path = `/campaigns/${encodeURIComponent(campaign.id)}`;
  const fresh = await client.request<OrganizerCampaignState>(path);
  assertOrganizer(client, accountId);
  if (fresh?.id !== campaign.id || fresh.organizerId !== accountId)
    throw new ApiError("A campanha não pertence a esta conta.", 403);
  const options = organizerLifecycleOptions(fresh);
  if (fresh.status !== campaign.status || !options.actions.includes(action))
    throw new ApiError(
      options.notice ??
        "A situação mudou. Atualize a campanha antes de tentar novamente.",
      409,
    );

  const transition = transitions[action];
  const changed = await client.request<OrganizerCampaignState>(
    `${path}/${transition.endpoint}`,
    "POST",
  );
  assertOrganizer(client, accountId);
  if (
    changed?.id !== campaign.id ||
    changed.organizerId !== accountId ||
    changed.status !== transition.status
  )
    throw new ApiError(
      "Não foi possível confirmar a nova situação. Atualize antes de tentar novamente.",
      409,
    );
  return changed;
}
