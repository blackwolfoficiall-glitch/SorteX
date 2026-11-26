import assert from "node:assert/strict";
import { test } from "node:test";
import { parseBuyerInbox } from "../../../packages/contracts/src/buyer-inbox";
import { SortexClient, type AuthState } from "../src/api/client";
import { buyerInboxSession, readBuyerInbox } from "../src/buyer/inbox";

const owner = {
  id: "buyer-1",
  role: "BUYER" as const,
  name: "Buyer",
  email: "owner@example.test",
};
const first = {
  id: "row-1",
  type: "ORDER",
  title: "Pedido atualizado",
  message: "Esse aviso pertence à sua conta.",
  createdAt: "2026-11-26T10:11:12.000Z",
  readAt: null,
};
const read = { ...first, readAt: "2026-11-26T10:15:00.000Z" };

test("inbox payload keeps only display fields and rejects malformed lists", () => {
  assert.deepEqual(
    parseBuyerInbox([
      {
        ...first,
        userId: owner.id,
        data: { unsafeUrl: "https://example.test" },
      },
    ]),
    [first],
  );
  assert.deepEqual(parseBuyerInbox([]), []);
  for (const payload of [
    {},
    [null],
    [{ ...first, id: "../settings" }],
    [first, first],
    [{ ...first, readAt: "1" }],
    [{ ...first, createdAt: "not-a-date" }],
  ])
    assert.throws(
      () => parseBuyerInbox(payload),
      /caixa de notificações inválida/,
    );
});

function stub() {
  const auth: AuthState = { status: "signedIn", user: owner };
  const calls: [string, string][] = [];
  return {
    auth,
    calls,
    client: {
      snapshot: () => auth,
      activeSessionRevision: () => 1,
      request: async <T>(path: string, method = "GET"): Promise<T> => {
        calls.push([method, path]);
        return (
          method === "GET" ? [read] : { message: "Notificação lida." }
        ) as T;
      },
    },
  };
}

test("single and bulk read actions use protected routes then fetch persisted state", async () => {
  const { client, calls } = stub();
  const session = buyerInboxSession(client)!;
  assert.deepEqual(
    await readBuyerInbox(client, session, { kind: "one", id: first.id }),
    [read],
  );
  assert.deepEqual(await readBuyerInbox(client, session, { kind: "all" }), [
    read,
  ]);
  assert.deepEqual(calls, [
    ["POST", "/buyer/notifications/row-1/read"],
    ["GET", "/buyer/notifications"],
    ["POST", "/buyer/notifications/read-all"],
    ["GET", "/buyer/notifications"],
  ]);
  await assert.rejects(
    readBuyerInbox(client, session, { kind: "one", id: "../../admin" }),
    /Notificação inválida/,
  );
  assert.equal(calls.length, 4);
});

test("organizer or expired session cannot read or mark any inbox", async () => {
  const { auth, client, calls } = stub();
  const session = buyerInboxSession(client)!;
  auth.user = { ...owner, role: "ORGANIZER" };
  assert.equal(buyerInboxSession(client), null);
  assert.equal(await readBuyerInbox(client, session, { kind: "all" }), null);
  auth.status = "signedOut";
  assert.equal(await readBuyerInbox(client, session), null);
  assert.deepEqual(calls, []);
});

test("dropping a session mid-mark never reloads the new account or shows stale content", async () => {
  const nextAccount = { ...owner, id: "buyer-2", email: "next@example.test" };
  let signed = owner;
  let resolveRead: ((response: Response) => void) | undefined;
  const inboxCalls: string[] = [];
  const client = new SortexClient(
    "https://synthetic.example.test",
    {
      read: async () => null,
      write: async () => {},
      clear: async () => {},
    },
    async (input) => {
      const route = new URL(String(input)).pathname;
      if (route === "/auth/login")
        return Response.json({
          user: signed,
          accessToken: "access",
          refreshToken: "refresh",
        });
      if (route === "/auth/me") return Response.json(signed);
      if (route === "/auth/logout") return Response.json({});
      inboxCalls.push(route);
      if (route.endsWith("/read"))
        return new Promise((resolve) => {
          resolveRead = resolve;
        });
      return Response.json([first]);
    },
  );
  await client.login(owner.email, "synthetic");
  const session = buyerInboxSession(client)!;
  const marking = readBuyerInbox(client, session, {
    kind: "one",
    id: first.id,
  });
  assert.ok(resolveRead);
  await client.logout();
  signed = nextAccount;
  await client.login(nextAccount.email, "synthetic");
  resolveRead(Response.json({ message: "Notificação lida." }));
  assert.equal(await marking, null);
  assert.deepEqual(inboxCalls, ["/buyer/notifications/row-1/read"]);
  assert.equal(buyerInboxSession(client)?.buyerId, nextAccount.id);
});
