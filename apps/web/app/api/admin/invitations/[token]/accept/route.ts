import { apiFetch, jsonFromUpstream, readJson } from '@/lib/auth/server';

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const response = await apiFetch(`/admin/invitations/${encodeURIComponent(token)}/accept`, { method: 'POST', body: JSON.stringify(await request.json()) });
  return jsonFromUpstream(await readJson(response), response.status);
}
