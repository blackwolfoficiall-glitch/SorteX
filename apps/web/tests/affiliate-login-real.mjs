// A real browser/Next/Nest proof. Run explicitly with disposable local data.
// Fixture accounts must be two buyers and one organizer at example.test.
import assert from "node:assert/strict";
import { chromium } from "playwright";

const loopback = (name) => {
  const url = new URL(process.env[name] ?? "");
  assert.ok(url.origin === url.href.slice(0, -1) && url.hostname === "127.0.0.1" && url.protocol === "http:");
  return url.origin;
};
const api = loopback("SORTEX_AFFILIATE_TEST_API");
const web = loopback("SORTEX_AFFILIATE_TEST_WEB");
const actor = (label) => {
  const email = process.env[`SORTEX_AFFILIATE_TEST_${label}_EMAIL`];
  const password = process.env[`SORTEX_AFFILIATE_TEST_${label}_PASSWORD`];
  assert.ok(/^sortex-affiliate-[a-z0-9-]+@example\.test$/.test(email ?? "") && password?.length >= 12);
  return { email, password };
};
const invited = actor("INVITED"), wrong = actor("WRONG"), owner = actor("ORGANIZER");
assert.equal(new Set([invited.email, wrong.email, owner.email]).size, 3);
const continuation = "/afiliado/convite/continuar";
const browserPost = "/api/affiliates/affiliates/invite/accept";

let phase = "ambiente";
async function post(path, body, token, status = 201) {
  const response = await fetch(api + path, {
    method: "POST", redirect: "error", signal: AbortSignal.timeout(15_000),
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: JSON.stringify(body),
  });
  assert.equal(response.status, status, phase);
  return response.json();
}

function monitor(page, code) {
  const requests = [];
  let accepts = 0;
  page.on("request", (request) => {
    const address = new URL(request.url());
    if (address.pathname === browserPost && request.method() === "POST") accepts++;
    requests.push(request.headerValue("referer").then((referer) => ({
      queryHasCode: address.search.toLowerCase().includes(code.toLowerCase()),
      queryHasEmail: decodeURIComponent(address.search).includes("@example.test"),
      referrerHasCode: Boolean(referer?.toLowerCase().includes(code.toLowerCase())),
    })));
  });
  return {
    writes: () => accepts,
    async verify() {
      for (const proof of await Promise.all(requests)) {
        assert.deepEqual(proof, { queryHasCode: false, queryHasEmail: false, referrerHasCode: false });
      }
    },
  };
}

async function signIn(page, account) {
  await page.getByLabel("E-mail").fill(account.email);
  await page.getByLabel("Senha", { exact: true }).fill(account.password);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
}

(async () => {
  const health = await fetch(api + "/health").then((r) => r.json());
  assert.equal(health.environment, "development");
  phase = "programa e convite de teste";
  const { accessToken: organizer } = await post("/auth/login", owner);
  const { accessToken: recipient } = await post("/auth/login", invited);
  const program = await post("/affiliate-programs", {
    name: "Programa sintético", commissionType: "PERCENTAGE", commissionPercentage: 1, allowSelfSignup: false,
  }, organizer);
  const invite = await post("/affiliates/invite", {
    programId: program.id, name: "Afiliado sintético", email: invited.email,
  }, organizer);
  const original = new URL(invite.inviteUrl);
  assert.equal(original.origin, web);
  const code = original.pathname.split("/").at(-1);
  assert.ok(/^[a-f0-9]{10}$/i.test(code ?? ""));

  const browser = await chromium.launch({
    executablePath: process.env.SORTEX_CHROMIUM || undefined,
    args: ["--no-sandbox", "--disable-dev-shm-usage"],
  });
  try {
    phase = "entrada pela área de afiliados";
    const dashboard = await browser.newPage();
    const dashboardWatch = monitor(dashboard, code);
    await dashboard.goto(web + "/afiliado");
    await dashboard.getByRole("link", { name: "Continuar", exact: true }).click();
    await dashboard.waitForURL(web + "/login?next=%2Fafiliado");
    await signIn(dashboard, invited);
    await dashboard.waitForURL(web + "/afiliado");
    await dashboard.getByRole("heading", { name: "Seu painel de crescimento" }).waitFor();
    await dashboardWatch.verify();
    assert.equal(dashboardWatch.writes(), 0);
    await dashboard.context().close();

    phase = "entrada pelo convite sem expor código";
    const page = await browser.newPage();
    const watch = monitor(page, code);
    const link = await page.goto(original.href);
    assert.equal(link.headers()["referrer-policy"], "no-referrer");
    assert.ok(link.headers()["cache-control"].includes("no-store"));
    await page.getByRole("button", { name: "Entrar com e-mail e voltar ao convite" }).click();
    await page.waitForURL(web + "/login?next=%2Fafiliado%2Fconvite%2Fcontinuar");
    await signIn(page, wrong);
    await page.waitForURL(web + continuation);
    const accept = page.getByRole("button", { name: "Aceitar convite", exact: true });
    await accept.waitFor();
    assert.equal(watch.writes(), 0);

    phase = "conta de e-mail diferente";
    const rejected = page.waitForResponse((r) => new URL(r.url()).pathname === browserPost);
    await accept.click();
    const denial = await rejected;
    assert.equal(denial.status(), 403);
    assert.equal((await denial.json()).message, "Este convite pertence a outro e-mail.");
    await page.getByText("Use a conta vinculada ao e-mail que recebeu o convite.").waitFor();

    phase = "troca de conta sem aceite automático";
    await page.getByRole("button", {name:"Trocar de conta"}).click();
    await page.waitForURL(web + "/login?next=%2Fafiliado%2Fconvite%2Fcontinuar");
    await signIn(page, invited);
    await page.waitForURL(web + continuation);
    await accept.waitFor();
    assert.equal(watch.writes(), 1);
    const accepted = page.waitForResponse((r) => new URL(r.url()).pathname === browserPost);
    await accept.click();
    const result = await accepted;
    assert.equal(result.status(), 201);
    assert.deepEqual(await result.json(), { status: "PENDING" });
    await page.getByText("Convite aceito e enviado para aprovação do organizador.").waitFor();
    assert.equal(watch.writes(), 2);
    await watch.verify();
    await page.reload();
    await page.getByText(/Não há convite disponível nesta aba/).waitFor();

    phase = "aprovação, repetição e suspensão";
    assert.deepEqual(await post("/affiliates/invite/accept", { code }, recipient), { status: "PENDING" });
    await post(`/affiliates/${invite.id}/approve`, {}, organizer);
    const repeated = await post("/affiliates/invite/accept", { code }, recipient);
    assert.deepEqual(repeated, { status: "ACTIVE" });
    await post(`/affiliates/${invite.id}/suspend`, {}, organizer);
    const suspended = await post("/affiliates/invite/accept", { code }, recipient, 400);
    assert.equal(suspended.message, "Este convite não está disponível.");
    const legacy = await post(`/affiliates/invite/${code}/accept`, {}, recipient, 400);
    assert.equal(legacy.path, "/affiliates/invite/[redacted]/accept");
    console.log(JSON.stringify({
      browser: "Chromium", revision: health.version,
      affiliateLoginReturn: true, inviteSignInReturn: true, inviteNoReferrer: true,
      noCodeOrEmailInQuery: true, explicitAcceptOnly: true, differentEmailHttp: 403,
      sameEmailAcceptHttp: 201, organizerApprovalRequired: true,
      replayPreservesPendingAndApproval: true, suspendedReplayHttp: 400, oldPathCredentialRedacted: true,
    }));
  } finally { await browser.close(); }
})().catch(() => {
  // Do not print browser exceptions: they can contain the original private URL.
  console.error(`Prova de afiliados falhou na etapa: ${phase}.`);
  process.exitCode = 1;
});
