import { authenticatedApiFetch, jsonFromUpstream, readJson } from '@/lib/auth/server';

async function proxy(request: Request, context: { params: Promise<{ path: string[] }> }) {
  const { path } = await context.params;
  const query = new URL(request.url).search;
  const body = ['GET', 'HEAD'].includes(request.method) ? undefined : await request.text();
  const response = await authenticatedApiFetch(`/buyer/${path.join('/')}${query}`, {
    method: request.method,
    body: body || undefined,
    headers: body ? { 'Content-Type': request.headers.get('content-type') ?? 'application/json' } : undefined,
  });
  return jsonFromUpstream(
    await readJson(response),
    response.status,
    path[0] === 'notifications' || path[0] === 'favorites'
      ? { 'Cache-Control': 'private, no-store' } : undefined,
  );
}
export const GET = proxy;
export const POST = proxy;
export const PATCH = proxy;
export const DELETE = proxy;
