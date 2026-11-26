import assert from "node:assert/strict";
import { ApiError, SortexClient, type Vault } from "../src/api/client";
import { validateApiUrl } from "../src/api/config";
import { loadBuyerPrizeList, type BuyerPrizeKind } from "../src/buyer/prizes";

// Read-only check for a loopback Nest/Next stack and disposable seeded accounts.
function loopback(name: string) {
  const url = new URL(process.env[name] ?? "");
  assert.ok(url.hostname === "127.0.0.1" && url.protocol === "http:" && url.pathname === "/" &&
    !!url.port && !url.username && !url.password && !url.search && !url.hash, `${name} must be local`);
  return url.origin;
}
function actor(label: string) {
  const email = process.env[`SORTEX_PRIZE_TEST_${label}_EMAIL`] ?? "";
  const password = process.env[`SORTEX_PRIZE_TEST_${label}_PASSWORD`] ?? "";
  if (!/^sortex-prize-[a-f0-9]+@example\.test$/.test(email) || password.length < 12)
    throw new Error("Conta sintética de teste obrigatória.");
  return { email, password };
}
function mobile(origin: string) {
  let tokens: Awaited<ReturnType<Vault["read"]>> = null;
  return new SortexClient(validateApiUrl(origin, true), {
    read: async () => tokens,
    write: async (value) => { tokens = value; },
    clear: async () => { tokens = null; },
  });
}
async function main() {
  const api = loopback("SORTEX_PRIZE_TEST_API"), web = loopback("SORTEX_PRIZE_TEST_WEB");
  const buyer = mobile(api), other = mobile(api), organizer = mobile(api);
  const credentials = actor("OWNER"), otherCredentials = actor("OTHER"), organizerCredentials = actor("ORGANIZER");
  const health = await buyer.publicRequest<{ version: string; environment: string }>("/health");
  assert.equal(health.environment, "development");
  const webHealth = await fetch(web + "/api/health", { redirect: "error" }).then((response) => response.json()) as typeof health;
  assert.equal(webHealth.version, health.version);
  assert.equal(webHealth.environment, health.environment);
  await buyer.login(credentials.email, credentials.password);
  await other.login(otherCredentials.email, otherCredentials.password);
  await organizer.login(organizerCredentials.email, organizerCredentials.password);
  const ownerId = buyer.snapshot().user?.id, otherId = other.snapshot().user?.id;
  assert.ok(ownerId && otherId && ownerId !== otherId);
  assert.equal(buyer.snapshot().user?.role, "BUYER");
  assert.equal(organizer.snapshot().user?.role, "ORGANIZER");

  const login = await fetch(web + "/api/auth/login", {
    method: "POST", redirect: "error", headers: { "Content-Type": "application/json" },
    body: JSON.stringify(credentials),
  });
  assert.equal(login.status, 200);
  const cookie = login.headers.getSetCookie().map((header) => header.split(";")[0]).join("; ");
  assert.ok(cookie.length > 0);
  for (const [kind, path, ticket, prizeName] of [
    ["draw", "/winners/my", "00091", "Sorteio sintético"],
    ["instant", "/winners/my-instant-prizes", "00032", "Cota sintética"],
  ] satisfies [BuyerPrizeKind, string, string, string][]) {
    const actual = await loadBuyerPrizeList(buyer, ownerId, kind);
    assert.ok(actual.ok);
    assert.equal(actual.items.length, 1);
    assert.deepEqual(
      [actual.items[0]?.ticketNumber, actual.items[0]?.prizeName],
      [ticket, prizeName],
    );
    const website = await fetch(web + "/api/draws" + path, { redirect: "error", headers: { Cookie: cookie } });
    assert.equal(website.status, 200);
    const webRows = await website.json() as { id: string; winningNumber: string }[];
    assert.deepEqual(webRows.map((row) => [row.id, row.winningNumber]), [[actual.items[0]?.id, ticket]]);
    assert.deepEqual(await loadBuyerPrizeList(other, otherId, kind), { ok: true, items: [] });
    await assert.rejects(other.publicRequest(path), (error) => error instanceof ApiError && error.status === 401);
    await assert.rejects(organizer.request(path), (error) => error instanceof ApiError && error.status === 403);
  }
  console.log(JSON.stringify({
    evidence: "local-node-mobile-client-and-next-not-ios", revision: health.version,
    syntheticMainAndInstant: true, leadingZeros: true, sameWebBffIds: true,
    unrelatedBuyerEmpty: true, anonymousDenied: 401, organizerDenied: 403,
  }));
}
main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Falha nos prêmios locais.");
  process.exitCode = 1;
});
