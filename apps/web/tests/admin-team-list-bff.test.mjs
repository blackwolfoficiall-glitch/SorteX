import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

const code = ts.transpileModule(
  readFileSync(
    new URL("../app/api/admin/platform/[...path]/route.ts", import.meta.url),
    "utf8",
  ),
  { compilerOptions: { module: ts.ModuleKind.CommonJS } },
).outputText;

const createdAt = "2026-11-20T15:10:00.000Z";
const directory = {
  members: [
    {
      id: "synthetic-member",
      name: "Pessoa fictícia",
      email: "member@example.test",
      adminTeamRole: null,
      adminPermissions: ["USERS_READ"],
      status: "ACTIVE",
      isActive: true,
      lastAccessAt: null,
      createdAt,
    },
  ],
  invitations: [
    {
      id: "synthetic-invite",
      name: "Convidado fictício",
      email: "invite@example.test",
      role: "SUPPORT",
      status: "PENDING",
      expiresAt: "2026-12-04T15:10:00.000Z",
      invitedBy: { name: "Responsável fictício" },
    },
  ],
  summary: { total: 1, active: 1, pending: 1, inactive: 0 },
};

async function fixture(payload, status = 200, path = ["team"]) {
  const calls = [];
  const exports = {};
  runInNewContext(
    code,
    {
      exports,
      Headers,
      Response,
      URL,
      require: (specifier) => {
        assert.equal(specifier, "@/lib/auth/server");
        return {
          authenticatedApiFetch: async (target, options) => {
            calls.push({ target, method: options.method });
            return Response.json(payload, { status });
          },
        };
      },
    },
    { timeout: 1_000 },
  );
  const response = await exports.GET(
    new Request(`http://127.0.0.1/api/admin/platform/${path.join("/")}`),
    { params: Promise.resolve({ path }) },
  );
  return { response, calls };
}

test("normal team view keeps accepted fields while omitting legacy excess", async () => {
  const legacy = {
    members: directory.members.map((row) => ({
      ...row,
      password: "synthetic-only",
    })),
    invitations: directory.invitations.map((row) => ({
      ...row,
      tokenHash: "synthetic-not-a-real-hash",
      privateNote: "synthetic-only",
      invitedBy: { ...row.invitedBy, id: "synthetic-owner" },
    })),
    summary: { ...directory.summary, privateCount: 5 },
    extra: "synthetic-only",
  };
  const { response, calls } = await fixture(legacy);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.deepEqual(await response.json(), directory);
  assert.deepEqual(calls, [{ target: "/admin/team", method: "GET" }]);
});

test("forwards an authorization failure without converting it to a directory", async () => {
  const denied = { message: "Acesso não autorizado." };
  const { response } = await fixture(denied, 403);
  assert.equal(response.status, 403);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.deepEqual(await response.json(), denied);
});

test("does not present a malformed successful response as an empty directory", async () => {
  const { response } = await fixture({ members: [], invitations: [] });
  assert.equal(response.status, 502);
  assert.equal(response.headers.get("cache-control"), "private, no-store");
  assert.deepEqual(await response.json(), {
    message: "Não foi possível confirmar a lista da equipe.",
  });
});

test("leaves nearby admin routes outside team-specific projection", async () => {
  const gateway = { providers: ["PIX"] };
  const { response, calls } = await fixture(gateway, 200, ["gateways"]);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), gateway);
  assert.deepEqual(calls, [{ target: "/admin/gateways", method: "GET" }]);
});
