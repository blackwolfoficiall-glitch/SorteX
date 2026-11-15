import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { apiFetch, readJson } from "@/lib/auth/server";
import {
  SOCIAL_BROWSER_COOKIE,
  socialCookieOptions,
} from "@/lib/auth/social-server";
export async function GET(
  _request: Request,
  context: { params: Promise<{ provider: string }> },
) {
  const { provider } = await context.params;
  if (!["google", "apple"].includes(provider))
    return Response.json({ message: "Provedor inválido." }, { status: 400 });
  const jar = await cookies();
  const browserProof =
    jar.get(SOCIAL_BROWSER_COOKIE)?.value ||
    randomBytes(32).toString("base64url");
  const response = await apiFetch(`/auth/social/${provider}/start`, {
    method: "POST",
    body: JSON.stringify({ browserProof }),
  });
  const payload = await readJson(response);
  if (!response.ok)
    return new Response(null, {
      status: 303,
      headers: {
        Location: "/login?social_error=unavailable",
        "Cache-Control": "no-store",
      },
    });
  const destination = new URL(payload.authorizationUrl);
  if (
    destination.origin !==
    (provider === "google"
      ? "https://accounts.google.com"
      : "https://appleid.apple.com")
  )
    return Response.json({ message: "Provedor inválido." }, { status: 502 });
  jar.set(SOCIAL_BROWSER_COOKIE, browserProof, socialCookieOptions);
  return new Response(null, {
    status: 303,
    headers: {
      Location: destination.toString(),
      "Cache-Control": "no-store",
      "Referrer-Policy": "no-referrer",
    },
  });
}
