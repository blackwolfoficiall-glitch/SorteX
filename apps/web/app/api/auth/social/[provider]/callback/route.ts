import { cookies } from "next/headers";
import { apiFetch, readJson, setAuthCookies } from "@/lib/auth/server";
import {
  SOCIAL_BROWSER_COOKIE,
  SOCIAL_PENDING_COOKIE,
  socialCookieOptions,
} from "@/lib/auth/social-server";
async function callback(
  request: Request,
  context: { params: Promise<{ provider: string }> },
) {
  const { provider } = await context.params;
  const redirect = (path: string) =>
    new Response(null, {
      status: 303,
      headers: {
        Location: path,
        "Cache-Control": "no-store",
        "Referrer-Policy": "no-referrer",
      },
    });
  if (
    !["google", "apple"].includes(provider) ||
    (provider === "google" && request.method !== "GET") ||
    (provider === "apple" && request.method !== "POST")
  )
    return redirect("/login?social_error=invalid");
  try {
    const values =
      request.method === "POST"
        ? await request.formData()
        : new URL(request.url).searchParams;
    if (values.get("error")) return redirect("/login?social_error=cancelled");
    const jar = await cookies();
    const browserProof = jar.get(SOCIAL_BROWSER_COOKIE)?.value;
    let nameHint: string | undefined;
    if (provider === "apple" && typeof values.get("user") === "string") {
      try {
        const user = JSON.parse(String(values.get("user")));
        nameHint = [user.name?.firstName, user.name?.lastName]
          .filter((value) => typeof value === "string")
          .join(" ")
          .slice(0, 120);
      } catch {
        /* name is an optional, untrusted display hint */
      }
    }
    const response = await apiFetch(`/auth/social/${provider}/callback`, {
      method: "POST",
      body: JSON.stringify({
        state: values.get("state"),
        code: values.get("code"),
        browserProof,
        nameHint,
      }),
    });
    const payload = await readJson(response);
    if (!response.ok) return redirect("/login?social_error=invalid");
    if (payload.kind === "registration") {
      jar.set(SOCIAL_PENDING_COOKIE, payload.registrationToken, {
        ...socialCookieOptions,
        sameSite: "lax",
        maxAge: 900,
      });
      return redirect("/cadastro/completar");
    }
    setAuthCookies(jar, payload);
    jar.set(SOCIAL_PENDING_COOKIE, "", {
      ...socialCookieOptions,
      sameSite: "lax",
      maxAge: 0,
    });
    return redirect(
      payload.user.role === "BUYER" ? "/comprador" : "/dashboard",
    );
  } catch {
    return redirect("/login?social_error=invalid");
  }
}
export const GET = callback;
export const POST = callback;
