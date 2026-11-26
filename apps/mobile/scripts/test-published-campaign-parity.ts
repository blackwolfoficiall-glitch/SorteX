import assert from "node:assert/strict";
import { createHash, randomBytes } from "node:crypto";
import { createRequire } from "node:module";
import { ApiError, SortexClient, type Vault } from "../src/api/client";
import { validateApiUrl } from "../src/api/config";
import { draftFields, emptyOrganizerDraft, listOrganizerDrawTemplates, saveOrganizerCampaign, type OrganizerDraftRecord } from "../src/domain/organizer-draft";
import { uploadOrganizerDraftCover } from "../src/domain/organizer-draft-cover";
import { runOrganizerLifecycle, type OrganizerCampaignState } from "../src/domain/organizer-campaign-lifecycle";

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

type Campaign = OrganizerDraftRecord & OrganizerCampaignState & {
  slug: string;
  coverImageUrl?: string | null;
  publishedRuleSnapshot?: unknown;
};

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
  const prize = `Prêmio de teste ${run}`, prizeDescription = `Descrição sintética do prêmio ${run}`;
  const draft = await saveOrganizerCampaign(app, { ...emptyOrganizerDraft, title });
  assert.equal(draft.status, "DRAFT");
  assert.equal(draft.organizerId, user.id);
  const rule = (await listOrganizerDrawTemplates(app)).find(({ id }) => id === "system-last-5-first");
  assert.ok(rule, "O catálogo autenticado precisa oferecer um modelo da Loteria Federal.");
  const expectedRule = (await app.request<Array<{ id: string; ruleDefinition: unknown }>>("/draw-rule-templates"))
    .find((item) => item.id === rule.id)?.ruleDefinition;
  assert.ok(expectedRule);
  await assert.rejects(runOrganizerLifecycle(app, user.id, draft, "publish"),
    (error) => error instanceof ApiError && error.status === 400);
  const schedule = draftFields({
    ...draft, drawDate: new Date(Date.now() + 604_800_000).toISOString(),
    drawTime: "18:00", salesStartAt: new Date(Date.now() - 60_000).toISOString(),
  });
  const original = await saveOrganizerCampaign(app, {
    ...schedule, regulation, mainPrizeName: prize,
    mainPrizeDescription: prizeDescription, estimatedPrizeValue: "10,50",
    totalNumbers: "100000", numberPrice: "0,12", minimumPurchase: "2",
    drawRuleTemplateId: rule.id,
  }, draft) as Campaign;
  assert.equal(original.id, draft.id);
  assert.equal(original.regulation, regulation);
  assert.equal(original.mainPrizeDescription, prizeDescription);
  assert.equal(original.estimatedPrizeValue, 10.50);
  assert.equal(original.minimumPurchase, 2);
  assert.equal(original.drawTime, "18:00");
  assert.equal(original.drawRuleTemplateId, rule.id);
  assert.equal(original.drawBasis, "LOTERIA_FEDERAL");
  const roundTrip = draftFields(original);
  assert.equal(roundTrip.drawDate, schedule.drawDate);
  assert.equal(roundTrip.salesStartDate, schedule.salesStartDate);
  assert.equal(roundTrip.salesStartTime, schedule.salesStartTime);
  const path = `/campaigns/${original.id}`, publicPath = `/public/campaigns/${original.slug}`;
  // Two locally generated RGB PNGs with valid PNG checksums (2×2 and 3×2).
  const coverBytes = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAEElEQVR4nGPgVbYBIgYIBQALIgGxC6q83wAAAABJRU5ErkJggg==", "base64",
  );
  const replacementBytes = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAMAAAACCAIAAAASFvFNAAAAEElEQVR4nGNI0bgDQQxwFgBRpAhx0roQKQAAAABJRU5ErkJggg==", "base64",
  );
  assert.notDeepEqual(coverBytes, replacementBytes);
  function uploadCover(bytes: Buffer, name: string) {
    const cover = new FormData();
    cover.set("target", "COVER");
    cover.set("files", new Blob([new Uint8Array(bytes)], { type: "image/png" }), name);
    return request<Campaign>(`${path}/images`, 201, "POST", cover);
  }
  const revision = app.activeSessionRevision();
  assert.notEqual(revision, null);
  const covered = await uploadOrganizerDraftCover(app, user.id, revision!, original, (expected) => {
    const form = new FormData();
    form.set("target", "COVER");
    form.set("expectedDraftCoverRevision", expected);
    // The Node runner substitutes a local Blob for React Native's file URI only.
    form.set("files", new Blob([new Uint8Array(coverBytes)], { type: "image/png" }), "capa.png");
    return form;
  });

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
  async function exactCover(check: string, response: Promise<Response>, expected = coverBytes) {
    const result = await response;
    assert.equal(result.status, 200, check);
    assert.match(result.headers.get("content-type") ?? "", /^image\/png(?:;|$)/i, check);
    assert.deepEqual(Buffer.from(await result.arrayBuffer()), expected, check);
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

  const pendingDraft = await saveOrganizerCampaign(other, { ...emptyOrganizerDraft, title: `Rascunho pendente ${run}` });
  await assert.rejects(runOrganizerLifecycle(other, pendingDraft.organizerId!, pendingDraft, "publish"),
    (error) => error instanceof ApiError && error.status === 403);
  await assert.rejects(runOrganizerLifecycle(other, pendingDraft.organizerId!, covered, "publish"),
    (error) => error instanceof ApiError && error.status === 403);
  await runOrganizerLifecycle(app, user.id, covered, "publish");
  const published = await app.request<Campaign>(path);
  assert.equal(published.status, "PUBLISHED");
  assert.equal(published.id, original.id);
  assert.deepEqual(published.publishedRuleSnapshot, expectedRule);
  await assert.rejects(app.request(path, "PATCH", { drawRuleTemplateId: "different-rule" }),
    (error) => error instanceof ApiError && [400, 409].includes(error.status));
  const mobilePublicCampaign = await app.publicRequest<Campaign>(publicPath);
  const webPublicCampaign = await request<Campaign>(publicPath, 200);
  assert.equal(mobilePublicCampaign.coverImageUrl, publicMedia);
  assert.equal(webPublicCampaign.coverImageUrl, publicMedia);
  for (const campaign of [mobilePublicCampaign, webPublicCampaign]) {
    assert.equal(campaign.id, original.id);
    assert.equal(campaign.title, title);
    assert.equal(campaign.mainPrizeName, prize);
    assert.equal(campaign.mainPrizeDescription, prizeDescription);
  }
  const webBrowserRender = process.env.SORTEX_PARITY_WEB_RENDER === "yes";
  if (webBrowserRender) {
    const requireWeb = createRequire(new URL("../../web/package.json", import.meta.url));
    const { chromium, devices, webkit } = requireWeb("@playwright/test");
    for (const [name, engine] of [["chromium", chromium], ["webkit", webkit]] as const) {
      const chromiumPath = process.env.SORTEX_PARITY_CHROMIUM_EXECUTABLE;
      const browser = await engine.launch(name === "chromium" && chromiumPath ? { executablePath: chromiumPath } : {});
      try {
        const context = await browser.newContext({
          ...devices[name === "webkit" ? "iPhone 13" : "Desktop Chrome"], serviceWorkers: "block",
        });
        await context.route("**/*", (route: { request(): { url(): string }; continue(): Promise<void>; abort(): Promise<void> }) =>
          new URL(route.request().url()).origin === web ? route.continue() : route.abort());
        const page = await context.newPage();
        const [received] = await Promise.all([
          page.waitForResponse((response: { url(): string }) => new URL(response.url()).pathname === `/api${publicPath}`, { timeout: 20_000 }),
          page.goto(`${web}/campanha/${original.slug}`),
        ]);
        await page.getByRole("heading", { name: title, exact: true }).waitFor({ timeout: 20_000 });
        const payload = await received.json();
        assert.equal(payload.id, original.id);
        await page.locator("summary").filter({ hasText: "Descrição e regulamento" }).click();
        await page.getByText(prizeDescription, { exact: true }).waitFor({ timeout: 20_000 });
        await page.getByText(regulation, { exact: true }).waitFor({ timeout: 20_000 });
      } finally {
        await browser.close();
      }
    }
  }
  await exactCover("PUBLISHED público direto (URL informada ao aplicativo)", direct(mobilePublicCampaign.coverImageUrl));
  await exactCover("PUBLISHED público Next", webAnonymous(webPublicMedia));
  await denied("PUBLISHED privado outro organizador direto", direct(ownedMedia, otherToken), 403);
  await denied("PUBLISHED privado outro organizador Next", webOther(ownedMedia), 403);

  // Upload via the authenticated web BFF without changing status, ID, or URL.
  const replaced = await uploadCover(replacementBytes, "nova-capa-sintetica.png");
  assert.equal(replaced.id, original.id);
  assert.equal(replaced.status, "PUBLISHED");
  assert.equal(replaced.coverImageUrl, publicMedia);
  for (const campaign of await Promise.all([
    app.publicRequest<Campaign>(publicPath),
    request<Campaign>(publicPath, 200),
  ])) {
    assert.equal(campaign.id, original.id);
    assert.equal(campaign.status, "PUBLISHED");
    assert.equal(campaign.coverImageUrl, publicMedia);
  }
  // Re-read the warmed URLs as-is: don't bypass stale caches with a query string.
  await exactCover("PUBLISHED substituída direto (URL informada ao aplicativo)", direct(publicMedia), replacementBytes);
  await exactCover("PUBLISHED substituída público Next", webAnonymous(webPublicMedia), replacementBytes);
  await exactCover("PUBLISHED substituída dono Next", webOwner(ownedMedia), replacementBytes);

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
  await exactCover("PAUSED dono Next mantém a nova capa", webOwner(ownedMedia), replacementBytes);
  await exactCover("PAUSED dono direto mantém a nova capa", direct(ownedMedia, ownerToken), replacementBytes);
  await saveOrganizerCampaign(app, { ...draftFields(paused), title: `Título revisto ${run}` }, paused);
  assert.equal((await request<Campaign>(path, 200)).title, `Título revisto ${run}`);
  await request(`${path}/finish`, 201, "POST");
  await publicDenied("FINISHED");
  await exactCover("FINISHED dono direto mantém a nova capa", direct(ownedMedia, ownerToken), replacementBytes);
  await assert.rejects(saveOrganizerCampaign(app, { ...draftFields(paused), title: "Não reabrir" }, paused),
    (error) => error instanceof ApiError && error.status === 400);
  assert.deepEqual(failures, [], "Política de acesso/cache da capa");
  console.log(JSON.stringify({
    type: "local-http-published-campaign-parity-not-ios-acceptance", revision: apiHealth.version,
    campaignId: original.id, slug: original.slug, publishedDescriptionOnWebAndMobile: true,
    nativePayloadDraftThenPublish: true, nativeCoverAccepted: true, federalRuleSnapshotMatches: true,
    publishedRuleChangeDenied: true, pendingPublisherDenied: true, webBrowserRender,
    pausedTitleOnWeb: true, otherOrganizerDenied: true, finishedEditDenied: true,
    cover: {
      sha256: createHash("sha256").update(coverBytes).digest("hex"),
      bytes: coverBytes.length, contentType: "image/png", storage: ready.storage,
      draftPrivate: true, publishedPublic: true, publishedOwnerRouteIsolated: true,
      pausedAndFinishedPublicDenied: true, storedBytesRetainedForOwner: true,
      responsesNotCacheable: true,
      replacement: {
        sha256: createHash("sha256").update(replacementBytes).digest("hex"),
        bytes: replacementBytes.length, sameCampaignStillPublished: true,
        samePublicUrlsReturnOnlyReplacement: true,
        replacementRemainsPrivateAfterPauseAndFinish: true,
      },
    },
  }));
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : "Falha na paridade de campanha publicada.");
  process.exitCode = 1;
});
