import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { ApiError, SortexClient, type Vault } from "../src/api/client";
import { BuyerPurchases, isActiveReservation } from "../src/buyer/purchases";

async function main() {
  const port = process.env.SORTEX_SALES_WINDOW_API_PORT;
  const mode = process.env.SORTEX_SALES_WINDOW_PAIR;
  const email = process.env.SORTEX_SALES_WINDOW_BUYER;
  const password = process.env.SORTEX_SALES_WINDOW_PASSWORD;
  if (process.env.SORTEX_NATIVE_LOCAL_CONFIRM !== "synthetic-loopback-only" ||
      !["46431", "46432"].includes(port ?? "") || !["legacy", "matched"].includes(mode ?? "") ||
      !email?.endsWith("@example.test") || !password)
    throw new Error("Informe apenas API e credenciais sintéticas locais.");
  const base = `http://127.0.0.1:${port}`;
  const vault: Vault = { read: async () => null, write: async () => {}, clear: async () => {} };
  const client = new SortexClient(base, vault);
  await client.login(email, password);
  const user = client.snapshot().user;
  assert.equal(user?.role, "BUYER");
  assert.ok(user?.id);
  const purchases = new BuyerPurchases(client, user.id);
  const existing = await purchases.current();
  if (process.env.SORTEX_SALES_WINDOW_POST_CLOSE === "1") {
    const closed = await purchases.availability("synthetic-window-open");
    assert.equal(closed.salesWindow?.status, "SALES_ENDED");
    assert.ok(existing?.idempotencyKey);
    assert.equal(isActiveReservation(existing), true);
    assert.equal(existing.campaign.id, closed.campaignId);
    const recovered = await purchases.reserve(
      closed, { mode: "RANDOM", quantity: 1 }, existing.idempotencyKey, true,
    );
    assert.equal(recovered.id, existing.id);
    console.log(JSON.stringify({ pair: mode, existingReservationAfterClose: true }));
    return;
  }

  for (const [name, status, error] of [
    ["future", "NOT_STARTED", "As vendas ainda não começaram."],
    ["ended", "SALES_ENDED", "As vendas foram encerradas."],
    ["drawn", "DRAW_TIME_REACHED", "O sort"],
    ["open", "OPEN", null],
  ] as const) {
    const slug = `synthetic-window-${name}`;
    const raw = await client.publicRequest<{salesWindow?: {status: string}}>(`/public/campaigns/${slug}/availability`);
    assert.equal(raw.salesWindow?.status, mode === "matched" ? status : undefined);
    const inventory = await purchases.availability(slug);
    assert.equal(inventory.salesWindow?.status, status);
    const request = { mode: "RANDOM", quantity: 1 } as const;
    const key = randomUUID();
    if (error) {
      // This is a deliberate synthetic test of the authoritative server gate,
      // not a button made available in either buyer UI.
      await assert.rejects(() => purchases.reserve(inventory, request, key),
        (cause: unknown) => cause instanceof ApiError && cause.status === 400 && cause.message.includes(error));
    } else {
      const active = await purchases.reserve(inventory, request, key);
      assert.equal(isActiveReservation(active), true);
      assert.equal((await purchases.current())?.id, active.id);
      assert.equal((await purchases.reserve(inventory, request, key, true)).id, active.id);
    }
  }
  console.log(JSON.stringify({ pair: mode, states: "future,ended,drawn,open", existingReservationReplay: true }));
}

void main().catch((cause) => {
  console.error(cause instanceof Error ? cause.message : "Falha no teste sintético.");
  process.exitCode = 1;
});
