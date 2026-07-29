import { cookies } from "next/headers";
import {
  ACCESS_COOKIE,
  REFRESH_COOKIE,
  apiFetch,
  clearAuthCookies,
  readJson,
} from "@/lib/auth/server";
import type { AuthTokens } from "@/lib/auth/types";

export async function POST() {
  const cookieStore = await cookies();
  let accessToken = cookieStore.get(ACCESS_COOKIE)?.value;
  const refreshToken = cookieStore.get(REFRESH_COOKIE)?.value;
  let payload: unknown = { message: "Logout realizado com sucesso." };

  if (accessToken) {
    let response = await apiFetch("/auth/logout", {
      method: "POST",
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (response.status === 401 && refreshToken) {
      const refreshResponse = await apiFetch("/auth/refresh", {
        method: "POST",
        body: JSON.stringify({ refreshToken }),
      });

      if (refreshResponse.ok) {
        const tokens = (await readJson(refreshResponse)) as AuthTokens;
        accessToken = tokens.accessToken;
        response = await apiFetch("/auth/logout", {
          method: "POST",
          headers: { Authorization: `Bearer ${accessToken}` },
        });
      }
    }

    payload = await readJson(response);
  } else if (refreshToken) {
    const refreshResponse = await apiFetch("/auth/refresh", {
      method: "POST",
      body: JSON.stringify({ refreshToken }),
    });
    if (refreshResponse.ok) {
      const tokens = (await readJson(refreshResponse)) as AuthTokens;
      const response = await apiFetch("/auth/logout", {
        method: "POST",
        headers: { Authorization: `Bearer ${tokens.accessToken}` },
      });
      payload = await readJson(response);
    }
  }

  clearAuthCookies(cookieStore);
  return Response.json(payload);
}
