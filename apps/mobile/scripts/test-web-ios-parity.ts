import assert from "node:assert/strict";
import { randomBytes, randomInt } from "node:crypto";
import { ApiError, SortexClient, type Vault } from "../src/api/client";
import { QA_API, validateApiUrl } from "../src/api/config";
import { verifyHostedReadiness } from "./hosted-smoke-preflight";
import { draftFields, emptyOrganizerDraft, saveOrganizerDraft, type OrganizerDraftRecord } from "../src/domain/organizer-draft";

type Identity = { id: string; role: string; adminPermissions?: string[] };
type Profile = { id: string; userId: string };
type Campaign = { id: string; title: string };
type Refresh = { accessToken: string; refreshToken: string };

function loopback(name: string): string {
  const url = new URL(process.env[name] ?? "");
  assert.ok(
    url.protocol === "http:" && url.hostname === "127.0.0.1" &&
      url.pathname === "/" && !url.username && !url.password && !url.search && !url.hash,
    `${name} deve apontar para um servidor local isolado.`,
  );
  return url.origin;
}

const web = loopback("SORTEX_PARITY_WEB");
const hostedQa = process.env.SORTEX_PARITY_MODE === "hosted-qa-synthetic";
const hostedRevision = process.env.SORTEX_PARITY_EXPECTED_API_SHA ?? "";
const checkDraftCover = process.env.SORTEX_PARITY_CHECK_DRAFT_COVER === "yes";
assert.ok(!checkDraftCover || hostedQa, "O teste de mídia usa apenas a QA hospedada isolada.");
if (hostedQa) {
  assert.equal(process.env.GITHUB_REPOSITORY, "blackwolfoficiall-glitch/SorteX");
  assert.equal(process.env.GITHUB_REF, "refs/heads/homologacao/web-ios-integrada");
  assert.equal(process.env.SORTEX_PARITY_API, QA_API);
  assert.match(hostedRevision, /^[a-f0-9]{40}$/);
}
const api = hostedQa ? validateApiUrl(QA_API) : validateApiUrl(loopback("SORTEX_PARITY_API"), true);
const run = randomBytes(5).toString("hex");
const password = randomBytes(20).toString("hex") + "Aa!0";

function cpf(): string {
  let digits = String(randomInt(100000000, 999999999));
  for (const size of [9, 10]) {
    const sum = [...digits].reduce((acc, digit, index) => acc + Number(digit) * (size + 1 - index), 0);
    const rest = sum % 11;
    digits += rest < 2 ? "0" : String(11 - rest);
  }
  return digits;
}

function registration(name: string, role: "BUYER" | "ORGANIZER") {
  return {
    name: `Teste SorteX ${name}`, email: `sortex-${run}-${name}@example.test`,
    password, passwordConfirmation: password, cpf: cpf(), phone: "71999990001",
    termsAccepted: true, privacyAccepted: true, dataProcessingAccepted: true,
    role, ...(role === "ORGANIZER" ? { personType: "PF" } : {}),
    city: "Feira de Santana", state: "BA", municipalityCode: "2910800",
    postalCode: "44000000", neighborhood: "Centro", address: "Rua Sintética", addressNumber: "10",
  };
}

function mobileClient() {
  let tokens: Awaited<ReturnType<Vault["read"]>> = null;
  // Replace only native token storage; actual transports and API logic are used.
  const vault: Vault = {
    read: async () => tokens,
    write: async (value) => { tokens = value; },
    clear: async () => { tokens = null; },
  };
  return new SortexClient(api, vault);
}

function browserSession() {
  const cookies = new Map<string, string>();
  async function raw(path: string, expected: number | number[], method = "GET", data?: unknown): Promise<Response> {
    const response = await fetch(`${web}/api${path}`, {
      method, redirect: "error", signal: AbortSignal.timeout(30_000),
      headers: {
        ...(cookies.size ? { Cookie: [...cookies].map(([k, v]) => `${k}=${v}`).join("; ") } : {}),
        ...(data === undefined || data instanceof FormData ? {} : { "Content-Type": "application/json" }),
      },
      ...(data === undefined ? {} : { body: data instanceof FormData ? data : JSON.stringify(data) }),
    });
    assert.ok([expected].flat().includes(response.status), `${method} ${path} HTTP ${response.status}`);
    for (const raw of response.headers.getSetCookie()) {
      const pair = raw.split(";", 1)[0] ?? "";
      const equals = pair.indexOf("=");
      if (equals < 0) continue;
      const key = pair.slice(0, equals);
      const val = pair.slice(equals + 1);
      if (val) cookies.set(key, val);
      else cookies.delete(key);
    }
    return response;
  }
  const request = async <T>(path: string, expected: number | number[], method = "GET", data?: unknown) =>
    (await (await raw(path, expected, method, data)).json()) as T;
  return Object.assign(request, { raw });
}

async function main() {
  const reqA = browserSession(), reqB = browserSession();
  const mA = mobileClient(), mB = mobileClient();
  const sample = () => Promise.all([
    reqA<{ version: string; environment: string }>("/health", 200),
    mA.publicRequest<{ version: string; environment: string }>("/health"),
    reqA<{ database: string; storage: string }>("/health/ready", 200),
  ] as const);
  const [webHealth, appHealth, ready] = hostedQa
    ? await verifyHostedReadiness(hostedRevision, sample)
    : await sample();
  assert.equal(webHealth.version, appHealth.version);
  if (hostedQa) {
    assert.equal(webHealth.version, hostedRevision, "A API QA não está na revisão esperada.");
    assert.equal(appHealth.environment, "production");
  } else {
    assert.equal(webHealth.environment, "development", "O teste só escreve em uma API local de desenvolvimento.");
    assert.equal(appHealth.environment, "development");
  }
  assert.equal(ready.database, "up");
  if (checkDraftCover) assert.equal(ready.storage, "up", "Storage privado da QA não confirmou prontidão.");
  const organizerA = registration("orga", "ORGANIZER");
  const organizerB = registration("orgb", "ORGANIZER");
  const webRegistration = await reqA<Identity>("/auth/register", 201, "POST", organizerA);
  const appRegistration = await mB.publicRequest<Identity>("/auth/register", "POST", organizerB);
  await reqA("/auth/login", 200, "POST", { email: organizerA.email, password });
  await reqB("/auth/login", 200, "POST", { email: organizerB.email, password });
  await mA.login(organizerA.email, password);
  await mB.login(organizerB.email, password);

  async function compare(req: ReturnType<typeof browserSession>, mobile: SortexClient, registrationResponse: Identity) {
    const [w, p, mp] = await Promise.all([
      req<Identity>("/auth/me", 200),
      req<Profile>("/organizer/profile", 200),
      mobile.request<Profile>("/organizers/me/profile"),
    ]);
    const n = mobile.snapshot().user as Identity;
    assert.equal(w.id, registrationResponse.id);
    assert.equal(w.id, n.id);
    assert.equal(w.role, "ORGANIZER");
    assert.equal(w.role, n.role);
    assert.deepEqual(w.adminPermissions, n.adminPermissions);
    assert.ok(p.id && p.userId === w.id);
    assert.equal(mp.id, p.id);
    assert.equal(mp.userId, p.userId);
    return { userId: w.id, organizerProfileId: p.id };
  }

  const issued = await mA.publicRequest<Refresh>("/auth/login", "POST", { email: organizerA.email, password });
  const renewed = await mA.publicRequest<Refresh>("/auth/refresh", "POST", { refreshToken: issued.refreshToken });
  assert.ok(renewed.refreshToken && renewed.accessToken);
  assert.notEqual(renewed.refreshToken, issued.refreshToken);

  const a = await compare(reqA, mA, webRegistration);
  const b = await compare(reqB, mB, appRegistration);
  assert.notEqual(a.userId, b.userId);
  const draft = await reqA<Campaign>("/campaigns", 201, "POST", { title: `Rascunho sintético ${run}` });
  assert.ok(draft.id);
  const fromMobile = await mA.request<OrganizerDraftRecord>(`/campaigns/${draft.id}`);
  assert.deepEqual([fromMobile.id, fromMobile.title], [draft.id, draft.title]);
  assert.ok((await mA.request<Campaign[]>("/campaigns/my")).some((item) => item.id === draft.id));
  const nextTitle = `Rascunho alterado ${run}`;
  await saveOrganizerDraft(mA, { ...draftFields(fromMobile), title: nextTitle }, fromMobile);
  assert.equal((await reqA<Campaign>(`/campaigns/${draft.id}`, 200)).title, nextTitle);
  assert.ok(!(await reqB<Campaign[]>("/campaigns/my", 200)).some((item) => item.id === draft.id));
  await assert.rejects(mB.request(`/campaigns/${draft.id}`, "PATCH", { title: "Negado" }),
    (error) => error instanceof ApiError && [403, 404].includes(error.status));
  assert.equal((await reqA<Campaign>(`/campaigns/${draft.id}`, 200)).title, nextTitle);
  const nativeDraft = await saveOrganizerDraft(mB, {
    ...emptyOrganizerDraft,
    title: `Rascunho criado no cliente móvel ${run}`, description: "Sintético",
    mainPrizeName: "Prêmio sintético", numberPrice: "0,12", totalNumbers: "500",
  });
  assert.equal((await reqB<Campaign>(`/campaigns/${nativeDraft.id}`, 200)).id, nativeDraft.id);
  if (checkDraftCover) {
    const bytes = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jVssAAAAASUVORK5CYII=", "base64",
    );
    const upload = new FormData();
    upload.set("target", "COVER");
    upload.set("files", new Blob([bytes], { type: "image/png" }), "qa-capa-sintetica.png");
    const owned = `/campaigns/${draft.id}/media/cover`;
    const publicPath = `/public/campaigns/media/${draft.id}/cover`;
    await (await reqA.raw(`/campaigns/${draft.id}/images`, 201, "POST", upload)).body?.cancel();
    const direct = (path: string, accessToken?: string) => fetch(api + path, {
      redirect: "error", cache: "no-store", signal: AbortSignal.timeout(20_000),
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined,
    });
    const outsider = await mB.publicRequest<Refresh>("/auth/login", "POST", {
      email: organizerB.email, password,
    });
    const [webCover, directCover, webOther, directOther, directPublic, webPublic] = await Promise.all([
      reqA.raw(owned, 200), direct(owned, renewed.accessToken),
      reqB.raw(owned, [403, 404]), direct(owned, outsider.accessToken),
      direct(publicPath), browserSession().raw(`/public/campaign-media/${draft.id}/cover`, [403, 404]),
    ]);
    for (const response of [webCover, directCover]) {
      assert.equal(response.status, 200);
      assert.equal(response.headers.get("content-type"), "image/png");
      assert.match(response.headers.get("cache-control") ?? "", /no-store/);
      assert.ok(Buffer.from(await response.arrayBuffer()).equals(bytes), "Os bytes da capa privada divergiram.");
    }
    for (const response of [webOther, directOther, directPublic, webPublic]) {
      assert.ok([403, 404].includes(response.status), "A capa do rascunho não foi protegida.");
      await response.body?.cancel();
    }
  }
  await mA.logout();
  assert.notEqual(mA.snapshot().status, "signedIn");
  await mB.logout();
  console.log(JSON.stringify({
    type: hostedQa ? "hosted-neon-with-local-next-not-ios-acceptance" : "local-real-http-protocol-not-ios-acceptance",
    timestamp: new Date().toISOString(), apiVersion: appHealth.version,
    database: ready.database, storage: ready.storage,
    webToMobile: a, mobileToWeb: b, draftCampaignId: draft.id, nativeDraftCampaignId: nativeDraft.id,
    sameRoles: true, draftSyncedInBothDirections: true, organizerIsolation: true,
    refreshTokenRotated: true,
    ...(checkDraftCover ? { draftCoverSameBytesAndPrivate: true } : {}),
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Falha no teste de paridade.");
  process.exitCode = 1;
});
