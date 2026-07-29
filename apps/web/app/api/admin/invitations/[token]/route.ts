import { apiFetch, jsonFromUpstream, readJson } from '@/lib/auth/server';

export async function GET(_request: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const response = await apiFetch(`/admin/invitations/${encodeURIComponent(token)}`);
  return jsonFromUpstream(await readJson(response), response.status);
}
