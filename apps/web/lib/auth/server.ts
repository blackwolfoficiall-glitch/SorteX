import type { AuthTokens } from "./types";
import { cookies, headers } from "next/headers";

type CookieStore = {
  set: (name: string, value: string, options: Record<string, unknown>) => void;
  delete: (name: string) => void;
};

export const ACCESS_COOKIE = "sortex_access_token";
export const REFRESH_COOKIE = "sortex_refresh_token";

const API_URL = (
  process.env.API_INTERNAL_URL ||
  process.env.API_URL ||
  "http://localhost:3333"
).replace(/\/$/, "");

const cookieBase = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
};

async function upstreamFetch(path: string, init: RequestInit = {}) {
  const endpoint = `${API_URL}${path}`;
  const timeoutSignal = AbortSignal.timeout(15_000);
  const signal = init.signal
    ? AbortSignal.any([init.signal, timeoutSignal])
    : timeoutSignal;
  try {
    const requestHeaders = await headers();
    const forwardedFor = requestHeaders.get("x-forwarded-for");
    return await fetch(endpoint, {
      ...init,
      signal,
      cache: "no-store",
      headers: {
        ...(forwardedFor ? { "X-Forwarded-For": forwardedFor } : {}),
        ...init.headers,
      },
    });
  } catch (cause) {
    if (process.env.NODE_ENV !== "production") {
      console.error("[SorteX API indisponível]", {
        endpoint,
        method: init.method || "GET",
        error: cause instanceof Error ? cause.message : "Erro de rede",
      });
    }
    return Response.json(
      {
        statusCode: 503,
        code: "API_UNAVAILABLE",
        message:
          cause instanceof DOMException && cause.name === "TimeoutError"
            ? "A API da SorteX demorou para responder. Tente novamente."
            : "A API da SorteX está indisponível. Tente novamente.",
        path,
      },
      { status: 503 },
    );
  }
}

export function apiFetch(path: string, init: RequestInit = {}) {
  return upstreamFetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
}

export async function authenticatedApiFetch(
  path: string,
  init: RequestInit = {},
) {
  const cookieStore = await cookies();
  let accessToken = cookieStore.get(ACCESS_COOKIE)?.value;
  const refreshToken = cookieStore.get(REFRESH_COOKIE)?.value;

  if (!accessToken && !refreshToken) {
    return new Response(JSON.stringify({ message: "Não autenticado." }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const request = (token: string) =>
    upstreamFetch(path, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        ...init.headers,
      },
    });

  if (accessToken) {
    const response = await request(accessToken);
    if (response.status !== 401) return response;
  }

  if (!refreshToken) {
    clearAuthCookies(cookieStore);
    return new Response(JSON.stringify({ message: "Sessão expirada." }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const refreshResponse = await apiFetch("/auth/refresh", {
    method: "POST",
    body: JSON.stringify({ refreshToken }),
  });
  const tokens = (await readJson(refreshResponse)) as AuthTokens;
  if (!refreshResponse.ok) {
    clearAuthCookies(cookieStore);
    return new Response(JSON.stringify(tokens), {
      status: refreshResponse.status,
      headers: { "Content-Type": "application/json" },
    });
  }

  setAuthCookies(cookieStore, tokens);
  accessToken = tokens.accessToken;
  return request(accessToken);
}

export async function readJson(response: Response) {
  return response.json().catch(() => ({}));
}

export function setAuthCookies(
  cookies: CookieStore,
  tokens: AuthTokens,
) {
  cookies.set(ACCESS_COOKIE, tokens.accessToken, {
    ...cookieBase,
    maxAge: tokens.expiresIn,
  });
  cookies.set(REFRESH_COOKIE, tokens.refreshToken, {
    ...cookieBase,
    maxAge: 60 * 60 * 24 * 30,
  });
}

export function clearAuthCookies(cookies: CookieStore) {
  cookies.delete(ACCESS_COOKIE);
  cookies.delete(REFRESH_COOKIE);
}

export function jsonFromUpstream(
  payload: unknown,
  status: number,
  headers?: HeadersInit,
) {
  return Response.json(payload, { status, headers });
}
