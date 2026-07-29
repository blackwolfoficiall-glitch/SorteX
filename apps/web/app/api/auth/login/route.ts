import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import type { LoginResponse } from "@/lib/auth/types";
import {
  apiFetch,
  jsonFromUpstream,
  readJson,
  setAuthCookies,
} from "@/lib/auth/server";

export function GET() {
  return new NextResponse(null, {
    status: 307,
    headers: { Location: "/login" },
  });
}

export async function POST(request: Request) {
  const response = await apiFetch("/auth/login", {
    method: "POST",
    body: JSON.stringify(await request.json()),
  });
  const payload = (await readJson(response)) as LoginResponse;

  if (process.env.NODE_ENV !== "production") {
    console.info("[SorteX login]", {
      endpoint: "/auth/login",
      status: response.status,
      ok: response.ok,
      error: response.ok
        ? undefined
        : (payload as LoginResponse & { message?: string | string[] }).message,
    });
  }

  if (!response.ok) {
    return jsonFromUpstream(payload, response.status);
  }

  const sessionResponse = await apiFetch("/auth/me", {
    headers: { Authorization: `Bearer ${payload.accessToken}` },
  });
  if (!sessionResponse.ok) {
    const sessionError = await readJson(sessionResponse);
    if (process.env.NODE_ENV !== "production") {
      console.error("[SorteX login] sessão não validada", {
        endpoint: "/auth/me",
        status: sessionResponse.status,
        error: sessionError,
      });
    }
    return jsonFromUpstream(sessionError, sessionResponse.status);
  }

  setAuthCookies(await cookies(), payload);
  if (process.env.NODE_ENV !== "production") {
    console.info("[SorteX login] sessão validada e cookies gravados", {
      userId: payload.user.id,
      role: payload.user.role,
    });
  }
  return Response.json({ user: payload.user });
}
