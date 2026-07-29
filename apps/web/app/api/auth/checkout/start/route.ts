import { cookies } from "next/headers";
import type { LoginResponse } from "@/lib/auth/types";
import { apiFetch, jsonFromUpstream, readJson, setAuthCookies } from "@/lib/auth/server";

type CheckoutStart = Partial<LoginResponse> & { existing: boolean; temporary?: boolean; canContinue?: boolean; maskedEmail?: string };

export async function POST(request: Request) {
  const response = await apiFetch("/auth/checkout/start", { method: "POST", body: JSON.stringify(await request.json()) });
  const payload = await readJson(response) as CheckoutStart;
  if (!response.ok) return jsonFromUpstream(payload, response.status);
  if (!payload.existing && payload.accessToken && payload.refreshToken) setAuthCookies(await cookies(), payload as LoginResponse);
  const { accessToken, refreshToken, ...safe } = payload;
  void accessToken; void refreshToken;
  return Response.json(safe);
}
