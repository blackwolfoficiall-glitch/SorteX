import { cookies } from "next/headers";
import {
  apiFetch,
  authenticatedApiFetch,
  readJson,
  setAuthCookies,
} from "./server";
import type { AuthTokens } from "./types";

export const SOCIAL_BROWSER_COOKIE =
  process.env.NODE_ENV === "production"
    ? "__Host-sortex_social_browser"
    : "sortex_social_browser";
export const SOCIAL_PENDING_COOKIE =
  process.env.NODE_ENV === "production"
    ? "__Host-sortex_social_pending"
    : "sortex_social_pending";
export const socialCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite:
    process.env.NODE_ENV === "production"
      ? ("none" as const)
      : ("lax" as const),
  path: "/",
  maxAge: 1800,
};
export function sameOrigin(request: Request) {
  const origin =
    process.env.OAUTH_WEB_ORIGIN ||
    process.env.WEB_URL ||
    new URL(request.url).origin;
  return request.headers.get("origin") === origin;
}
export async function socialPending(
  method: "pending" | "complete" | "link",
  request?: Request,
) {
  if (request && !sameOrigin(request))
    return Response.json({ message: "Origem inválida." }, { status: 403 });
  const jar = await cookies();
  const registrationToken = jar.get(SOCIAL_PENDING_COOKIE)?.value;
  const browserProof = jar.get(SOCIAL_BROWSER_COOKIE)?.value;
  if (!registrationToken || !browserProof)
    return Response.json(
      { message: "Inicie o acesso com Google ou Apple novamente." },
      { status: 401 },
    );
  const fields =
    method === "complete" && request ? await request.json() : undefined;
  const upstream = method === "link" ? authenticatedApiFetch : apiFetch;
  const response = await upstream(`/auth/social/${method}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      registrationToken,
      browserProof,
      ...(fields ? { fields } : {}),
    }),
  });
  const payload = await readJson(response);
  if (!response.ok)
    return Response.json(payload, {
      status: response.status,
      headers: { "Cache-Control": "no-store" },
    });
  if (method === "complete") setAuthCookies(jar, payload as AuthTokens);
  if (method !== "pending")
    jar.set(SOCIAL_PENDING_COOKIE, "", {
      ...socialCookieOptions,
      sameSite: "lax",
      maxAge: 0,
    });
  return Response.json(
    method === "complete" ? { user: payload.user } : payload,
    { headers: { "Cache-Control": "no-store" } },
  );
}
