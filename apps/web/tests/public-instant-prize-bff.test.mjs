import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { runInNewContext } from "node:vm";
import ts from "typescript";

// Run the real BFF handler with injected synthetic upstream responses. The
// Request objects below are never sent to a host or used to mutate state.
const moduleCode = ts.transpileModule(
  readFileSync(
    new URL("../app/api/draws/[...path]/route.ts", import.meta.url),
    "utf8",
  ),
  { compilerOptions: { module: ts.ModuleKind.CommonJS } },
).outputText;
const safeRow = {
  winningNumber: "0***7",
  status: "IDENTIFIED",
  identifiedAt: "2026-11-27T17:00:00.000Z",
  buyer: { name: "Identidade preservada", city: null, state: null },
  instantPrize: {
    description: "Prêmio sintético",
    type: "PRODUCT",
    value: 12.34,
  },
};

function handler(upstreamStatus, upstreamBody) {
  const calls = [];
  const fetch = (access) => async (target) => {
    calls.push({ access, target });
    return Response.json(upstreamBody, { status: upstreamStatus });
  };
  const exports = {};
  runInNewContext(
    moduleCode,
    {
      exports,
      URL,
      require: (path) => {
        assert.equal(path, "@/lib/auth/server");
        return {
          apiFetch: fetch("public"),
          authenticatedApiFetch: fetch("authenticated"),
          readJson: (response) => response.json(),
          jsonFromUpstream: (body, status, headers) =>
            Response.json(body, { status, headers }),
        };
      },
    },
    { timeout: 1_000 },
  );
  return { GET: exports.GET, calls };
}

function read(GET, path) {
  const request = new Request(`http://127.0.0.1/api/draws/${path.join("/")}`);
  return GET(request, { params: Promise.resolve({ path }) });
}

test("keeps the safe public display shape and no-store when results are allowed", async () => {
  const { GET, calls } = handler(200, [safeRow]);
  const response = await read(GET, [
    "public",
    "campaigns",
    "synthetic",
    "instant-prizes",
  ]);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(await response.json(), [safeRow]);
  assert.deepEqual(calls, [
    { access: "public", target: "/public/campaigns/synthetic/instant-prizes" },
  ]);
  // Existing table displays buyer.name and the null-location fallback.
  assert.equal(safeRow.buyer.name, "Identidade preservada");
  assert.equal(
    [safeRow.buyer.city, safeRow.buyer.state].filter(Boolean).join(" - ") ||
      "Não informado",
    "Não informado",
  );
});

test("preserves a no-store 404 with no result rows for a nonpublic campaign", async () => {
  const { GET } = handler(404, { message: "Campanha não encontrada." });
  const response = await read(GET, [
    "public",
    "campaigns",
    "synthetic",
    "instant-prizes",
  ]);
  assert.equal(response.status, 404);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(await response.json(), {
    message: "Campanha não encontrada.",
  });
});

test("does not change the authenticated buyer endpoint or other public proof routing", async () => {
  const privateView = handler(401, { message: "Não autenticado." });
  const own = await read(privateView.GET, ["winners", "my-instant-prizes"]);
  assert.equal(own.status, 401);
  assert.deepEqual(privateView.calls, [
    { access: "authenticated", target: "/winners/my-instant-prizes" },
  ]);
  const publicProof = handler(404, { message: "Sem apuração." });
  await read(publicProof.GET, ["public", "winners", "verify", "synthetic"]);
  assert.deepEqual(publicProof.calls, [
    { access: "public", target: "/public/winners/verify/synthetic" },
  ]);
});

test("projects legacy success rows without buyer fields, unknown keys or raw tickets", async () => {
  const legacy = {
    ...safeRow,
    buyer: {
      name: "PessoaSintética",
      city: "Cidade Fictícia",
      state: "XX",
      email: "synthetic@example.invalid",
      id: "synthetic-buyer",
    },
    instantPrize: { ...safeRow.instantPrize, privateNotes: "synthetic-only" },
    purchaseId: "synthetic-purchase",
    ticketId: "synthetic-ticket",
  };
  const { GET } = handler(200, [
    legacy,
    { ...legacy, winningNumber: "*" },
    { ...legacy, winningNumber: "**" },
    { ...legacy, winningNumber: "00127" },
    { ...legacy, identifiedAt: "não é data" },
    { ...legacy, status: "valor desconhecido" },
    { ...legacy, instantPrize: { ...legacy.instantPrize, value: "12.34" } },
  ]);
  const response = await read(GET, [
    "public",
    "campaigns",
    "synthetic",
    "instant-prizes",
  ]);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(await response.json(), [
    safeRow,
    { ...safeRow, winningNumber: "*" },
    { ...safeRow, winningNumber: "**" },
  ]);
});

test("does not invent a visibility status for empty legacy responses", async () => {
  for (const payload of [[], { items: [safeRow] }]) {
    const { GET } = handler(200, payload);
    const response = await read(GET, [
      "public",
      "campaigns",
      "synthetic",
      "instant-prizes",
    ]);
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("cache-control"), "no-store");
    assert.deepEqual(await response.json(), []);
  }
});

test("does not project or change upstream non-success body/status", async () => {
  const payload = {
    code: "TEMPORARILY_UNAVAILABLE",
    message: "Serviço indisponível.",
  };
  const { GET } = handler(503, payload);
  const response = await read(GET, [
    "public",
    "campaigns",
    "synthetic",
    "instant-prizes",
  ]);
  assert.equal(response.status, 503);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(await response.json(), payload);
});
