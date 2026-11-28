import { AuthApiError } from "@/lib/auth/client";
import type { Campaign } from "./types";

export function campaignPublicationNotice(campaign: Pick<Campaign, "status" | "publicationBlocked" | "adminReviewStatus">): string | undefined {
  if (campaign.status === "PENDING_REVIEW")
    return "Esta campanha aguarda revisão administrativa antes de publicar.";
  if (campaign.publicationBlocked !== false)
    return "A publicação está bloqueada ou não foi possível confirmar a liberação. Confira a situação da campanha.";
  if (["REJECTED", "CHANGES_REQUESTED"].includes(campaign.adminReviewStatus ?? ""))
    return "A campanha tem uma pendência na revisão administrativa. Confira a situação antes de publicar.";
}

export function publicationError(cause: unknown): string {
  if (cause instanceof AuthApiError && cause.status === 403)
    return "Publicação não autorizada. Confira a aprovação do cadastro e se há restrições nesta campanha.";
  return cause instanceof Error ? cause.message : "Não foi possível publicar a campanha.";
}
