import { cookies } from 'next/headers';
import type { LoginResponse } from '@/lib/auth/types';
import { apiFetch, clearAuthCookies, jsonFromUpstream, readJson, setAuthCookies } from '@/lib/auth/server';

export async function GET() {
  clearAuthCookies(await cookies());
  return Response.json({ message: 'Sessão administrativa preparada.' });
}

export async function POST(request: Request) {
  const response = await apiFetch('/auth/admin-login', { method: 'POST', body: JSON.stringify(await request.json()) });
  const payload = (await readJson(response)) as LoginResponse;
  if (!response.ok) return jsonFromUpstream(payload, response.status);
  const sessionResponse = await apiFetch('/auth/me', {
    headers: { Authorization: `Bearer ${payload.accessToken}` },
  });
  if (!sessionResponse.ok)
    return jsonFromUpstream(
      await readJson(sessionResponse),
      sessionResponse.status,
    );
  if (payload.user.role !== 'ADMIN' || !payload.user.adminTeamRole)
    return Response.json(
      { message: 'Esta conta não possui acesso administrativo.' },
      { status: 403 },
    );
  setAuthCookies(await cookies(), payload);
  return Response.json({ user: payload.user });
}
