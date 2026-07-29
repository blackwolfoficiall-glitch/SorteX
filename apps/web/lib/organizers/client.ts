import { AuthApiError, authRequest } from "@/lib/auth/client";
import type {
  OrganizerDocumentType,
  OrganizerProfile,
} from "./types";

export function getOrganizerProfile() {
  return authRequest<OrganizerProfile>("/api/organizer/profile", {
    cache: "no-store",
  });
}

export function updateOrganizerProfile(data: Record<string, unknown>) {
  return authRequest<OrganizerProfile>("/api/organizer/profile", {
    method: "PATCH",
    body: JSON.stringify(data),
  });
}
export function updateOrganizerAccount(data: Record<string, unknown>) { return authRequest<Record<string,unknown>>("/api/organizer/account", { method:"PATCH", body:JSON.stringify(data) }); }

export function submitOrganizerProfile() {
  return authRequest<OrganizerProfile>("/api/organizer/submit", {
    method: "POST",
  });
}

export async function uploadOrganizerFile(
  file: File,
  type: "LOGO" | OrganizerDocumentType,
) {
  const formData = new FormData();
  formData.set("file", file);
  const path = type === "LOGO" ? "/api/organizer/logo" : "/api/organizer/documents";
  if (type !== "LOGO") formData.set("type", type);

  const response = await fetch(path, {
    method: "POST",
    credentials: "same-origin",
    body: formData,
  });
  const payload = (await response.json().catch(() => ({}))) as OrganizerProfile & {
    message?: string | string[];
  };
  if (!response.ok) {
    const message = Array.isArray(payload.message)
      ? payload.message.join(" ")
      : payload.message || "Não foi possível enviar o arquivo.";
    throw new AuthApiError(message, response.status);
  }
  return payload;
}
