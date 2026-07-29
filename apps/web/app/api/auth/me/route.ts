import { cookies } from "next/headers";
import type { AuthTokens } from "@/lib/auth/types";
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  apiFetch,
  clearAuthCookies,
  jsonFromUpstream,
  readJson,
  setAuthCookies,
} from "@/lib/auth/server";

async function fetchMe(accessToken: string) {
  return apiFetch("/auth/me", {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

export async function GET() {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get(ACCESS_COOKIE)?.value;
  const refreshToken = cookieStore.get(REFRESH_COOKIE)?.value;

  if (!accessToken && !refreshToken) {
    return Response.json({ message: "Não autenticado." }, { status: 401 });
  }

  if (accessToken) {
    const response = await fetchMe(accessToken);
    if (response.ok || response.status !== 401) {
      return jsonFromUpstream(await readJson(response), response.status);
    }
  }

  if (!refreshToken) {
    clearAuthCookies(cookieStore);
    return Response.json({ message: "Sessão expirada." }, { status: 401 });
  }

  const refreshResponse = await apiFetch("/auth/refresh", {
    method: "POST",
    body: JSON.stringify({ refreshToken }),
  });
  const tokens = (await readJson(refreshResponse)) as AuthTokens;

  if (!refreshResponse.ok) {
    clearAuthCookies(cookieStore);
    return jsonFromUpstream(tokens, refreshResponse.status);
  }

  setAuthCookies(cookieStore, tokens);
  const response = await fetchMe(tokens.accessToken);
  return jsonFromUpstream(await readJson(response), response.status);
}
