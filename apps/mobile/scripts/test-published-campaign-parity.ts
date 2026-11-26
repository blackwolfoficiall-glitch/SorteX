import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
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
  const client = new SortexClient(validateApiUrl(origin, true), {
    read: async () => tokens,
    write: async (next) => { tokens = next; },
    clear: async () => { tokens = null; },
  });
  return { client, token: () => tokens?.accessToken };
}

type Campaign = OrganizerDraftRecord & { slug: string; regulation?: string; coverImageUrl?: string | null };

async function main() {
  const api = loopback("SORTEX_PARITY_API"), web = loopback("SORTEX_PARITY_WEB");
  const mobileOwner = mobile(api), mobileOther = mobile(api);
  const app = mobileOwner.client, other = mobileOther.client;
  const owner = actor("SORTEX_PUBLISHED_OWNER_EMAIL", "SORTEX_PUBLISHED_OWNER_PASSWORD");
  const nonOwner = actor("SORTEX_PUBLISHED_OTHER_EMAIL", "SORTEX_PUBLISHED_OTHER_PASSWORD");
  assert.notEqual(nonOwner.email, owner.email);

  function webSession() {
    const cookies = new Map<string, string>();
    return async (path: string, method = "GET", data?: object) => {
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
      for (const cookie of response.headers.getSetCookie())
        cookies.set(cookie.slice(0, cookie.indexOf("=")), cookie.slice(cookie.indexOf("=") + 1).split(";")[0] ?? "");
      return response;
    };
  }

  const webOwner = webSession(), webOther = webSession(), webAnonymous = webSession();
  async function request<T>(path: string, expected: number, method = "GET", data?: object) {
    const response = await webOwner(path, method, data);
    assert.equal(response.status, expected, `${method} ${path}`);
    return await response.json() as T;
  }

  function direct(path: string, token?: string) {
    return fetch(api + path, {
      redirect: "error", signal: AbortSignal.timeout(20_000),
      headers: token ? { Authorization: `Bearer ${token}` } : undefined,
    });
  }

  const apiHealth = await app.publicRequest<{ version: string; environment: string }>("/health");
  assert.equal(apiHealth.environment, "development");
  const webHealth = await request<typeof apiHealth>("/health", 200);
  assert.equal(webHealth.version, apiHealth.version);
  assert.equal(webHealth.environment, apiHealth.environment);
  const ready = await request<{ database: string; storage: string }>("/health/ready", 200);
  assert.equal(ready.database, "up");
  assert.equal(ready.storage, "up");
  await request("/auth/login", 200, "POST", owner);
  assert.equal((await webOther("/auth/login", "POST", nonOwner)).status, 200);
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
  const coverBytes = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAusB9Y9Zt9sAAAAASUVORK5CYII=", "base64",
  );
  const cover = new FormData();
  cover.set("target", "COVER");
  cover.set("files", new Blob([coverBytes], { type: "image/png" }), "synthetic.png");
  await request(`${path}/images`, 201, "POST", cover);

  const ownedMedia = `${path}/media/cover`;
  const publicMedia = `/public/campaigns/media/${original.id}/cover`;
  const webPublicMedia = `/public/campaign-media/${original.id}/cover`;
  const ownerToken = mobileOwner.token(), otherToken = mobileOther.token();
  assert.ok(ownerToken && otherToken);
  assert.equal((await request<Campaign>(path, 200)).coverImageUrl, publicMedia);
  const failures: string[] = [];
  const noStore = (response: Response) =>
    /(^|,\s*)no-store(,|$)/i.test(response.headers.get("cache-control") ?? "");
  async function denied(check: string, response: Promise<Response>, expected: number, checkCache = false) {
    const result = await response;
    if (result.status !== expected || result.headers.get("content-type")?.startsWith("image/")) {
      failures.push(`${check}: esperava HTTP ${expected} sem imagem, recebeu HTTP ${result.status}`);
    }
    if (checkCache && !noStore(result)) failures.push(`${check}: recusa sem no-store`);
    await result.body?.cancel();
  }
  async function exactCover(check: string, response: Promise<Response>) {
    const result = await response;
    assert.equal(result.status, 200, check);
    assert.match(result.headers.get("content-type") ?? "", /^image\/png(?:;|$)/i, check);
    assert.deepEqual(Buffer.from(await result.arrayBuffer()), coverBytes, check);
    if (!noStore(result)) failures.push(`${check}: resposta cacheável (${result.headers.get("cache-control") ?? ""})`);
  }
  async function publicDenied(status: string) {
    await denied(`${status} público direto`, direct(publicMedia), 403, true);
    await denied(`${status} público com sessão do dono`, direct(publicMedia, ownerToken), 403, true);
    await denied(`${status} público Next`, webAnonymous(webPublicMedia), 403, true);
  }

  await publicDenied("DRAFT");
  await denied("DRAFT privado anônimo direto", direct(ownedMedia), 401);
  await denied("DRAFT privado anônimo Next", webAnonymous(ownedMedia), 401);
  await denied("DRAFT privado outro organizador direto", direct(ownedMedia, otherToken), 403);
  await denied("DRAFT privado outro organizador Next", webOther(ownedMedia), 403);
  await exactCover("DRAFT dono direto", direct(ownedMedia, ownerToken));
  await exactCover("DRAFT dono Next", webOwner(ownedMedia));

  const published = await request<Campaign>(`${path}/publish`, 201, "POST");
  assert.equal(published.status, "PUBLISHED");
  assert.equal((await app.request<Campaign>(path)).id, published.id);
  const mobilePublicCampaign = await app.publicRequest<Campaign>(publicPath);
  const webPublicCampaign = await request<Campaign>(publicPath, 200);
  assert.equal(mobilePublicCampaign.coverImageUrl, publicMedia);
  assert.equal(webPublicCampaign.coverImageUrl, publicMedia);
  await exactCover("PUBLISHED público direto (URL informada ao aplicativo)", direct(mobilePublicCampaign.coverImageUrl));
  await exactCover("PUBLISHED público Next", webAnonymous(webPublicMedia));
  await denied("PUBLISHED privado outro organizador direto", direct(ownedMedia, otherToken), 403);
  await denied("PUBLISHED privado outro organizador Next", webOther(ownedMedia), 403);

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
  await publicDenied("PAUSED");
  await exactCover("PAUSED dono Next", webOwner(ownedMedia));
  await saveOrganizerCampaign(app, { ...draftFields(paused), title: `Título revisto ${run}` }, paused);
  assert.equal((await request<Campaign>(path, 200)).title, `Título revisto ${run}`);
  await request(`${path}/finish`, 201, "POST");
  await publicDenied("FINISHED");
  await exactCover("FINISHED dono direto", direct(ownedMedia, ownerToken));
  await assert.rejects(saveOrganizerCampaign(app, { ...draftFields(paused), title: "Não reabrir" }, paused),
    (error) => error instanceof ApiError && error.status === 400);
  assert.deepEqual(failures, [], "Política de acesso/cache da capa");
  console.log(JSON.stringify({
    type: "local-http-published-campaign-parity-not-ios-acceptance", revision: apiHealth.version,
    campaignId: original.id, slug: original.slug, publishedDescriptionOnWebAndMobile: true,
    pausedTitleOnWeb: true, otherOrganizerDenied: true, finishedEditDenied: true,
    cover: {
      sha256: createHash("sha256").update(coverBytes).digest("hex"),
      bytes: coverBytes.length, contentType: "image/png", storage: ready.storage,
      draftPrivate: true, publishedPublic: true, publishedOwnerRouteIsolated: true,
      pausedAndFinishedPublicDenied: true, storedBytesRetainedForOwner: true,
      responsesNotCacheable: true,
    },
  }));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Falha na paridade de campanha publicada.");
  process.exitCode = 1;
});
