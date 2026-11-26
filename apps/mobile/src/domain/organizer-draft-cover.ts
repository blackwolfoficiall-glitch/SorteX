import { ApiError, type SortexClient } from "../api/client";
import type { OrganizerDraftRecord } from "./organizer-draft";

export const draftCoverMimeTypes = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;
const extensions = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
} as const;
const maxCoverBytes = 20 * 1024 * 1024;
const coverRevision = /^[a-f0-9]{16}$/;
type CoverMimeType = (typeof draftCoverMimeTypes)[number];
type CoverClient = Pick<
  SortexClient,
  "snapshot" | "activeSessionRevision" | "request" | "requestMultipart"
>;

export function validateNativeDraftCover(asset: {
  uri: string;
  name: string;
  mimeType?: string;
  size?: number;
}) {
  if (!asset.uri.startsWith("file:///"))
    throw new Error(
      "Não foi possível ler o arquivo selecionado. Escolha uma imagem salva no aparelho.",
    );
  const mimeType = asset.mimeType?.toLowerCase();
  const ext = asset.name.split(".").at(-1)?.toLowerCase();
  const type =
    draftCoverMimeTypes.find((mime) => mime === mimeType) ??
    (!mimeType || mimeType === "application/octet-stream"
      ? draftCoverMimeTypes.find(
          (mime) =>
            ext === extensions[mime] ||
            (ext === "jpeg" && mime === "image/jpeg"),
        )
      : undefined);
  if (!type) throw new Error("Escolha uma imagem JPG, PNG ou WEBP.");
  if (
    !Number.isSafeInteger(asset.size) ||
    !asset.size ||
    asset.size < 1 ||
    asset.size > maxCoverBytes
  )
    throw new Error(
      "Escolha uma imagem com tamanho identificado entre 1 byte e 20 MB.",
    );
  // Do not send a personal filename/path as multipart metadata.
  return { uri: asset.uri, name: `capa.${extensions[type]}`, type };
}

export function nativeDraftCoverForm(
  expected: string,
  file: { uri: string; name: string; type: CoverMimeType },
) {
  const data = new FormData();
  data.append("target", "COVER");
  data.append("expectedDraftCoverRevision", expected);
  // React Native FormData supports local file references in addition to DOM Blobs.
  data.append("files", file as unknown as Blob);
  return data;
}

export function activeCoverSession(
  api: CoverClient,
  accountId: string,
  revision: number,
) {
  const auth = api.snapshot();
  return (
    api.activeSessionRevision() === revision &&
    auth.status === "signedIn" &&
    auth.user?.id === accountId &&
    auth.user.role === "ORGANIZER"
  );
}

export function draftCoverRevision(
  campaign: OrganizerDraftRecord,
  accountId: string,
) {
  if (
    campaign.status !== "DRAFT" ||
    campaign.organizerId !== accountId ||
    campaign.publishedAt !== null
  )
    return null;
  if (campaign.coverImageRevision === null) return "none";
  return campaign.coverImageRevision &&
    coverRevision.test(campaign.coverImageRevision)
    ? campaign.coverImageRevision
    : null;
}

export async function uploadOrganizerDraftCover(
  api: CoverClient,
  accountId: string,
  revision: number,
  campaign: OrganizerDraftRecord,
  form: (expected: string) => FormData,
  isActive: () => boolean = () => true,
) {
  const assertSession = () => {
    if (!isActive() || !activeCoverSession(api, accountId, revision))
      throw new ApiError("A sessão mudou. Entre novamente.", 401);
  };
  const assertCurrent = (record: OrganizerDraftRecord) => {
    const current =
      record?.id === campaign.id ? draftCoverRevision(record, accountId) : null;
    if (!current)
      throw new ApiError(
        "A campanha não está mais disponível para envio de capa.",
        409,
      );
    return current;
  };
  assertSession();
  const expected = assertCurrent(campaign);
  const path = `/campaigns/${encodeURIComponent(campaign.id)}`;
  const before = await api.request<OrganizerDraftRecord>(path);
  assertSession();
  if (assertCurrent(before) !== expected)
    throw new ApiError(
      "A capa mudou. Atualize a campanha antes de enviar.",
      409,
    );
  const response = await api.requestMultipart<OrganizerDraftRecord>(
    `${path}/images`,
    form(expected),
    revision,
  );
  assertSession();
  const uploaded = assertCurrent(response);
  if (uploaded === "none" || uploaded === expected)
    throw new ApiError(
      "Não foi possível confirmar a capa. Atualize antes de reenviar.",
      409,
    );
  const readback = await api.request<OrganizerDraftRecord>(path);
  assertSession();
  if (assertCurrent(readback) !== uploaded)
    throw new ApiError(
      "A capa mudou após o envio. Atualize a campanha para conferir.",
      409,
    );
  return readback;
}
