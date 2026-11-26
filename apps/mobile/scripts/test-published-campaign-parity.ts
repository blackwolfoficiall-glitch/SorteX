import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { ApiError, SortexClient, type Vault } from "../src/api/client";
import { validateApiUrl } from "../src/api/config";
import { draftFields, saveOrganizerCampaign, type OrganizerDraftRecord } from "../src/domain/organizer-draft";

// Run only with a fresh local PostgreSQL/Next/Nest stack. The fixture accounts
// must already exist: a verified organizer and a different organizer.
function loopback(name: string) {
  const url = new URL(process.env[name] ?? "");
  assert.ok(url.protocol === "http:" && url.hostname === "127.0.0.1" && url.pathname === "/"
    && !url.username && !url.password && !url.search && !url.hash, `${name} must be local`);
  return url.origin;
}
function actor(emailVariable: string, passwordVariable: string) {
  const email = process.env[emailVariable] ?? "", password = process.env[passwordVariable] ?? "";
  assert.match(email, /^sortex-published-[a-z0-9-]+@example\.test$/);
  assert.ok(password.length >= 12);
  return { email, password };
}
function mobile(origin: string) {
  let tokens: Awaited<ReturnType<Vault["read"]>> = null;
  return new SortexClient(validateApiUrl(origin, true), {
    read: async () => tokens,
    write: async (next) => { tokens = next; },
    clear: async () => { tokens = null; },
  });
}

type Campaign = OrganizerDraftRecord & { slug: string; regulation?: string };

async function main() {
  const app = mobile(loopback("SORTEX_PARITY_API")), other = mobile(loopback("SORTEX_PARITY_API"));
  const web = loopback("SORTEX_PARITY_WEB"), cookies = new Map<string, string>();
  const owner = actor("SORTEX_PUBLISHED_OWNER_EMAIL", "SORTEX_PUBLISHED_OWNER_PASSWORD");
  const nonOwner = actor("SORTEX_PUBLISHED_OTHER_EMAIL", "SORTEX_PUBLISHED_OTHER_PASSWORD");
  assert.notEqual(nonOwner.email, owner.email);

  async function request<T>(path: string, expected: number, method = "GET", data?: object) {
    const headers = new Headers();
    let body: FormData | string | undefined;
    if (data instanceof FormData) body = data;
    else if (data) {
      headers.set("Content-Type", "application/json");
      body = JSON.stringify(data);
    }
    if (cookies.size)
      headers.set("Cookie", [...cookies.entries()].map(([k, v]) => `${k}=${v}`).join("; "));
    const response = await fetch(`${web}/api${path}`, {
      method, headers, body, redirect: "error", signal: AbortSignal.timeout(20_000),
    });
    assert.equal(response.status, expected, `${method} ${path}`);
    for (const cookie of response.headers.getSetCookie())
      cookies.set(cookie.slice(0, cookie.indexOf("=")), cookie.slice(cookie.indexOf("=") + 1).split(";")[0] ?? "");
    return await response.json() as T;
  }

  const apiHealth = await app.publicRequest<{ version: string; environment: string }>("/health");
  assert.equal(apiHealth.environment, "development");
  const webHealth = await request<typeof apiHealth>("/health", 200);
  assert.equal(webHealth.version, apiHealth.version);
  assert.equal(webHealth.environment, apiHealth.environment);
  assert.equal((await request<{ database: string }>("/health/ready", 200)).database, "up");
  await request("/auth/login", 200, "POST", owner);
  await app.login(owner.email, owner.password);
  await other.login(nonOwner.email, nonOwner.password);
  const user = await request<{ id: string }>("/auth/me", 200);
  assert.equal(app.snapshot().user?.id, user.id);
  assert.notEqual(other.snapshot().user?.id, user.id);

  const run = randomBytes(6).toString("hex");
  const title = `Campanha sintética ${run}`, regulation = "Regulamento original. Apenas teste, sem dinheiro real.";
  const original = await request<Campaign>("/campaigns", 201, "POST", {
    title, regulation, mainPrizeName: "Prêmio sintético",
    mainPrizeDescription: "Descrição do prêmio de teste", estimatedPrizeValue: 10,
    totalNumbers: 100, numberPrice: 0.12, minimumPurchase: 1,
    drawBasis: "MANUAL_RESULT", drawTime: "18:00",
    drawDate: new Date(Date.now() + 604_800_000).toISOString(),
    salesStartAt: new Date(Date.now() - 60_000).toISOString(),
  });
  const path = `/campaigns/${original.id}`, publicPath = `/public/campaigns/${original.slug}`;
  const cover = new FormData();
  cover.set("target", "COVER");
  cover.set("files", new Blob([Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jVssAAAAASUVORK5CYII=", "base64",
  )], { type: "image/png" }), "synthetic.png");
  await request(`${path}/images`, 201, "POST", cover);
  const published = await request<Campaign>(`${path}/publish`, 201, "POST");
  assert.equal(published.status, "PUBLISHED");
  assert.equal((await app.request<Campaign>(path)).id, published.id);

  const initial = await app.request<Campaign>(path);
  const description = `Descrição sintética atualizada ${run}`;
  const shortDescription = `Resumo sintético atualizado ${run}`;
  const fields = { ...draftFields(initial), description, shortDescription, totalNumbers: "950",
    numberPrice: "75,00", mainPrizeName: "Não sobrescrever" };
  await assert.rejects(saveOrganizerCampaign(other, fields, initial),
    (error) => error instanceof ApiError && [403, 404].includes(error.status));
  await saveOrganizerCampaign(app, fields, initial);
  const [webOwned, webPublic, appPublic] = await Promise.all([
    request<Campaign>(path, 200), request<Campaign>(publicPath, 200), app.publicRequest<Campaign>(publicPath),
  ]);
  for (const record of [webOwned, webPublic, appPublic]) {
    assert.equal(record.id, original.id);
    assert.equal(record.description, description);
    assert.equal(record.shortDescription, shortDescription);
    assert.equal(record.title, title);
    assert.equal(record.totalNumbers, published.totalNumbers);
    assert.equal(record.numberPrice, published.numberPrice);
    assert.equal(record.mainPrizeName, published.mainPrizeName);
    assert.equal(record.regulation, regulation);
  }

  await request(`${path}/pause`, 201, "POST");
  const paused = await app.request<Campaign>(path);
  assert.equal(paused.status, "PAUSED");
  await saveOrganizerCampaign(app, { ...draftFields(paused), title: `Título revisto ${run}` }, paused);
  assert.equal((await request<Campaign>(path, 200)).title, `Título revisto ${run}`);
  await request(`${path}/finish`, 201, "POST");
  await assert.rejects(saveOrganizerCampaign(app, { ...draftFields(paused), title: "Não reabrir" }, paused),
    (error) => error instanceof ApiError && error.status === 400);
  console.log(JSON.stringify({
    type: "local-http-published-campaign-parity-not-ios-acceptance", revision: apiHealth.version,
    campaignId: original.id, slug: original.slug, publishedDescriptionOnWebAndMobile: true,
    pausedTitleOnWeb: true, otherOrganizerDenied: true, finishedEditDenied: true,
  }));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Falha na paridade de campanha publicada.");
  process.exitCode = 1;
});
