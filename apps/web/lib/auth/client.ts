import type { AuthUser } from "./types";

type ApiErrorPayload = { message?: string | string[] };

export class AuthApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = "AuthApiError";
  }
}

export async function authRequest<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 15_000);
  const abortFromCaller = () => controller.abort();
  init.signal?.addEventListener("abort", abortFromCaller, { once: true });
  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      signal: controller.signal,
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        ...init.headers,
      },
    });
  } catch (cause) {
    if (process.env.NODE_ENV !== "production") {
      console.error("[SorteX requisição falhou]", {
        endpoint: path,
        method: init.method || "GET",
        error: cause instanceof Error ? cause.message : "Erro de rede",
      });
    }
    const timedOut =
      cause instanceof DOMException && cause.name === "AbortError";
    throw new AuthApiError(
      timedOut
        ? "O servidor demorou para responder. Tente novamente."
        : "Não foi possível conectar ao servidor.",
      0,
    );
  } finally {
    window.clearTimeout(timeout);
    init.signal?.removeEventListener("abort", abortFromCaller);
  }

  const payload = (await response.json().catch(() => ({}))) as T &
    ApiErrorPayload;

  if (process.env.NODE_ENV !== "production") {
    console.info("[SorteX resposta da API]", {
      endpoint: path,
      method: init.method || "GET",
      status: response.status,
      ok: response.ok,
    });
  }

  if (!response.ok) {
    const apiMessage = Array.isArray(payload.message)
      ? payload.message.join(" ")
      : payload.message;
    const isLoginRequest =
      path === "/api/auth/login" || path === "/api/auth/admin-login";
    const message =
      response.status === 401 && !isLoginRequest
        ? "Sua sessão expirou. Entre novamente para continuar."
        : response.status === 401
          ? apiMessage || "E-mail ou senha inválidos."
          : response.status === 403 && !isLoginRequest
          ? "Você não possui permissão para realizar esta ação."
          : apiMessage || "Não foi possível concluir a solicitação.";
    if (process.env.NODE_ENV !== "production") {
      const log = response.status >= 500 ? console.error : console.warn;
      log("[SorteX API respondeu com erro]", {
        endpoint: path,
        method: init.method || "GET",
        status: response.status,
        message,
      });
    }
    throw new AuthApiError(message, response.status);
  }

  return payload;
}

let currentUserInFlight: Promise<AuthUser> | null = null;

export function getCurrentUser() {
  if (currentUserInFlight) return currentUserInFlight;
  currentUserInFlight = authRequest<AuthUser>("/api/auth/me", {
    cache: "no-store",
  }).finally(() => {
    currentUserInFlight = null;
  });
  return currentUserInFlight;
}
