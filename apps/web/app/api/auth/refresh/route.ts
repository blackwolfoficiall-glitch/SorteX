import { cookies } from "next/headers";
import type { AuthTokens } from "@/lib/auth/types";
import {
  REFRESH_COOKIE,
  apiFetch,
  clearAuthCookies,
  jsonFromUpstream,
  readJson,
  setAuthCookies,
} from "@/lib/auth/server";

export async function POST() {
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get(REFRESH_COOKIE)?.value;

  if (!refreshToken) {
    return Response.json(
      { message: "Sessão não encontrada." },
      { status: 401 },
    );
  }

  const response = await apiFetch("/auth/refresh", {
    method: "POST",
    body: JSON.stringify({ refreshToken }),
  });
  const payload = (await readJson(response)) as AuthTokens;

  if (!response.ok) {
    clearAuthCookies(cookieStore);
    return jsonFromUpstream(payload, response.status);
  }

  setAuthCookies(cookieStore, payload);
  return Response.json({ refreshed: true });
}
