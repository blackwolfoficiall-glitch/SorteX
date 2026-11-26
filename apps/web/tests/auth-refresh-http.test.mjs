import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer } from "node:http";
import { after, before, test } from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

const hostname = "127.0.0.1";
const cwd = fileURLToPath(new URL("../", import.meta.url));
const oldCookies =
  "sortex_access_token=expired-fixture; sortex_refresh_token=refresh-fixture";
const newTokens = {
  accessToken: "new-access-fixture",
  refreshToken: "new-refresh-fixture",
  tokenType: "Bearer",
  expiresIn: 120,
};
const account = { id: "synthetic-organizer", role: "ORGANIZER" };
let next;
let output = "";
let web;
let upstream;
let refresh = { status: 201, body: newTokens };

function listen(server) {
  return new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, hostname, () => {
      server.off("error", reject);
      resolve(server.address().port);
    });
  });
}
function close(server) {
  return new Promise((resolve) => server.close(resolve));
}
function json(response, status, body, headers = {}) {
  response.writeHead(status, { "Content-Type": "application/json", ...headers });
  response.end(JSON.stringify(body));
}
async function startNext() {
  const reservingServer = createServer();
  const webPort = await listen(reservingServer);
  await close(reservingServer);
  web = `http://${hostname}:${webPort}`;
  const api = `http://${hostname}:${await listen(upstream)}`;
  next = spawn(process.execPath, [
    "node_modules/next/dist/bin/next",
    "start",
    "--hostname",
    hostname,
    "--port",
    String(webPort),
  ], {
    cwd,
    env: {
      ...process.env,
      NODE_ENV: "production",
      NEXT_TELEMETRY_DISABLED: "1",
      API_INTERNAL_URL: api,
      API_URL: api,
      PLAYWRIGHT_API_URL: api,
      SORTEX_HOMOLOGATION_API_URL: api,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  for (const stream of [next.stdout, next.stderr])
    stream.on("data", (chunk) => {
      output = (output + chunk.toString()).slice(-3000);
    });
  for (let attempt = 0; attempt < 50; attempt++) {
    if (next.exitCode !== null) break;
    const response = await fetch(`${web}/api/auth/me`, {
      signal: AbortSignal.timeout(400),
      redirect: "error",
    }).catch(() => null);
    if (response?.status === 401 &&
        (await response.json()).message === "Não autenticado.") return;
    await delay(100);
  }
  throw new Error(`O site de teste não iniciou. Execute npm run build primeiro.\n${output}`);
}
before(async () => {
  upstream = createServer(async (request, response) => {
    if (request.url === "/admin/invitations/synthetic-invitation" && request.method === "GET")
      return json(response, 200, { adminTeamRole: "REGISTRATION_ANALYST" });
    if (request.url === "/admin/invitations/synthetic-invitation/accept" && request.method === "POST") {
      request.resume();
      return json(response, 400, { message: "Apenas uma resposta de teste." });
    }
    if (request.method === "POST" && request.url === "/auth/refresh") {
      let body = "";
      for await (const chunk of request) body += chunk.toString();
      if (JSON.parse(body).refreshToken !== "refresh-fixture")
        return json(response, 400, { message: "Fixture inválida." });
      return json(response, refresh.status, refresh.body, refresh.headers);
    }
    if (request.method === "GET") {
      if (request.headers.authorization !== "Bearer new-access-fixture")
        return json(response, 401, { message: "Credencial expirada." });
      if (request.url === "/auth/me") return json(response, 200, account);
      if (request.url === "/campaigns/my")
        return json(response, 200, [{ id: "synthetic-campaign" }]);
    }
    return json(response, 404, { message: "Caminho desconhecido na fixture." });
  });
  await startNext();
});
after(async () => {
  if (next && next.exitCode === null && next.signalCode === null) {
    next.kill();
    await once(next, "exit");
  }
  if (upstream?.listening) await close(upstream);
});

for (const [method, path, expected] of [
  ["GET", "/api/auth/me", account],
  ["POST", "/api/auth/refresh", { refreshed: true }],
  ["GET", "/api/campaigns/my", [{ id: "synthetic-campaign" }]],
]) {
  const request = () => fetch(web + path, {
    method,
    headers: { Cookie: oldCookies },
    signal: AbortSignal.timeout(8_000),
    redirect: "error",
  });
  test(`${method} ${path} preserva a sessão durante falhas recuperáveis e permite retentar`, async () => {
    for (const status of [503, 429]) {
      refresh = {
        status,
        body: { message: "Tente novamente.", code: "RETRYABLE_FIXTURE" },
        headers: { "Retry-After": "15", "X-Request-Id": "fixture-request" },
      };
      const failed = await request();
      assert.equal(failed.status, status);
      assert.deepEqual(failed.headers.getSetCookie(), []);
      assert.equal(failed.headers.get("Retry-After"), "15");
      assert.equal(failed.headers.get("X-Request-Id"), "fixture-request");
      assert.equal((await failed.json()).code, "RETRYABLE_FIXTURE");
    }

    refresh = { status: 201, body: newTokens };
    const recovered = await request();
    assert.equal(recovered.status, 200);
    assert.deepEqual(await recovered.json(), expected);
    const cookies = recovered.headers.getSetCookie();
    assert.equal(cookies.length, 2);
    assert.ok(cookies.some((cookie) => cookie.startsWith("sortex_access_token=new-access-fixture;")));
    assert.ok(cookies.some((cookie) => cookie.startsWith("sortex_refresh_token=new-refresh-fixture;")));
    assert.ok(cookies.every((cookie) => /; HttpOnly/i.test(cookie) && /; Secure/i.test(cookie)));
  });
  test(`${method} ${path} encerra sessão revogada e rejeita resposta inválida`, async () => {
    refresh = { status: 201, body: { accessToken: "incomplete-fixture" } };
    const invalid = await request();
    assert.equal(invalid.status, 502);
    assert.equal((await invalid.json()).code, "INVALID_AUTH_RESPONSE");
    assert.deepEqual(invalid.headers.getSetCookie(), []);

    for (const status of [401, 403]) {
      refresh = { status, body: { message: "Sessão revogada." } };
      const revoked = await request();
      assert.equal(revoked.status, status);
      const cookies = revoked.headers.getSetCookie();
      assert.equal(cookies.length, 2);
      assert.ok(cookies.some((cookie) => cookie.startsWith("sortex_access_token=;")));
      assert.ok(cookies.some((cookie) => cookie.startsWith("sortex_refresh_token=;")));
      await revoked.json();
    }
  });
}


test("a página pública do convite e o BFF não guardam nem propagam a URL", async () => {
  for (const [path, status, init] of [
    ["/admin/convite/synthetic-invitation", 200, {}],
    ["/api/admin/invitations/synthetic-invitation", 200, {}],
    ["/api/admin/invitations/synthetic-invitation/accept", 400, {
      method: "POST",
      body: "{}",
      headers: { "Content-Type": "application/json" },
    }],
  ]) {
    const response = await fetch(web + path, {
      ...init,
      redirect: "error",
      signal: AbortSignal.timeout(8_000),
    });
    assert.equal(response.status, status);
    assert.equal(response.headers.get("referrer-policy"), "no-referrer");
    assert.match(response.headers.get("cache-control") ?? "", /(?:^|,\s*)no-store(?:,|$)/);
    await response.body?.cancel();
  }
  const ordinary = await fetch(web + "/api/auth/me");
  assert.equal(ordinary.headers.get("referrer-policy"), "strict-origin-when-cross-origin");
  await ordinary.body?.cancel();
});
