import { authenticatedApiFetch } from "@/lib/auth/server";

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function teamMember(value: unknown) {
  const row = record(value);
  if (
    !row ||
    typeof row.id !== "string" ||
    typeof row.name !== "string" ||
    typeof row.email !== "string" ||
    (row.adminTeamRole !== null && typeof row.adminTeamRole !== "string") ||
    !Array.isArray(row.adminPermissions) ||
    !row.adminPermissions.every(
      (permission: unknown) => typeof permission === "string",
    ) ||
    typeof row.status !== "string" ||
    typeof row.isActive !== "boolean" ||
    (row.lastAccessAt !== null && typeof row.lastAccessAt !== "string") ||
    typeof row.createdAt !== "string"
  )
    return null;

  return {
    id: row.id,
    name: row.name,
    email: row.email,
    adminTeamRole: row.adminTeamRole,
    adminPermissions: row.adminPermissions,
    status: row.status,
    isActive: row.isActive,
    lastAccessAt: row.lastAccessAt,
    createdAt: row.createdAt,
  };
}

function teamInvitation(value: unknown) {
  const row = record(value);
  const inviter = record(row?.invitedBy);
  if (
    !row ||
    typeof row.id !== "string" ||
    typeof row.name !== "string" ||
    typeof row.email !== "string" ||
    typeof row.role !== "string" ||
    (row.status !== "PENDING" && row.status !== "EXPIRED") ||
    typeof row.expiresAt !== "string" ||
    typeof inviter?.name !== "string"
  )
    return null;

  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    status: row.status,
    expiresAt: row.expiresAt,
    invitedBy: { name: inviter.name },
  };
}

function count(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function teamListing(value: unknown) {
  const body = record(value);
  const summary = record(body?.summary);
  if (
    !body ||
    !Array.isArray(body.members) ||
    !Array.isArray(body.invitations) ||
    !summary ||
    !count(summary.total) ||
    !count(summary.active) ||
    !count(summary.pending) ||
    !count(summary.inactive)
  )
    return null;

  const members = body.members.map(teamMember);
  const invitations = body.invitations.map(teamInvitation);
  if (members.includes(null) || invitations.includes(null)) return null;
  return {
    members,
    invitations,
    summary: {
      total: summary.total,
      active: summary.active,
      pending: summary.pending,
      inactive: summary.inactive,
    },
  };
}

async function proxy(
  request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const { path } = await params;
  const body = ["GET", "HEAD"].includes(request.method)
    ? undefined
    : await request.text();
  const response = await authenticatedApiFetch(
    `/admin/${path.join("/")}${new URL(request.url).search}`,
    {
      method: request.method,
      body: body || undefined,
      headers: body ? { "Content-Type": "application/json" } : undefined,
    },
  );
  const teamRead =
    request.method === "GET" && path.length === 1 && path[0] === "team";
  const headers = new Headers({
    "Content-Type": response.headers.get("content-type") ?? "application/json",
  });
  if (teamRead) {
    headers.set("Cache-Control", "private, no-store");
    if (response.ok) {
      // A newer Web app may still be connected to the old API. Do not stream
      // the legacy directory result or make a broken response look empty.
      const projected = teamListing(await response.json().catch(() => null));
      return projected
        ? Response.json(projected, { status: response.status, headers })
        : Response.json(
            { message: "Não foi possível confirmar a lista da equipe." },
            { status: 502, headers },
          );
    }
  }
  return new Response(await response.text(), {
    status: response.status,
    headers,
  });
}

export const GET = proxy;
export const POST = proxy;
export const PATCH = proxy;
