import type { SortexClient } from "../api/client";

export const organizerSettingsSections = [
  { id: "profile", title: "Perfil", description: "Dados da conta e slogan opcional da sua marca." },
  { id: "plan", title: "Meu plano", description: "Plano atual, benefícios e consumo de campanhas." },
  { id: "legal", title: "Central Jurídica", description: "Documentos publicados, aceites e solicitações registradas." },
  { id: "brand", title: "Personalização", description: "Identidade, aparência, layout e templates: edição completa fora deste app." },
  { id: "domain", title: "Domínio próprio", description: "DNS, HTTPS e status do domínio: gestão não disponível no app." },
  { id: "social", title: "Redes sociais e comunidades", description: "Links, grupos, canais e ordem de exibição: gestão não disponível no app." },
] as const;
export const organizerSettingsPaths = {
  plan: "/plans/me", documents: "/legal/public", acceptances: "/legal/acceptances/me", requests: "/legal/data-requests/me",
} as const;

export type SettingsClient = Pick<SortexClient, "request" | "publicRequest" | "snapshot" | "activeSessionRevision">;
export type SettingsSession = { organizerId: string; revision: number };
const record = (value: unknown) => value && typeof value === "object" && !Array.isArray(value)
  ? value as Record<string, unknown> : null;
const text = (value: unknown): value is string => typeof value === "string" && value.trim().length > 0;
const count = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
const date = (value: unknown): value is string => typeof value === "string" && Number.isFinite(Date.parse(value));
const slug = (value: unknown): value is string => typeof value === "string" && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value) && value.length <= 128;
const invalid = () => new Error("Não foi possível verificar os dados de configurações.");
function rows<T>(value: unknown, parse: (row: unknown) => T): T[] {
  if (!Array.isArray(value)) throw invalid();
  return value.map(parse);
}

export function organizerSettingsSession(client: SettingsClient): SettingsSession | null {
  const auth = client.snapshot();
  const revision = client.activeSessionRevision();
  return auth.status === "signedIn" && auth.user?.role === "ORGANIZER" && revision !== null
    ? { organizerId: auth.user.id, revision } : null;
}
async function scoped<T>(client: SettingsClient, session: SettingsSession, read: () => Promise<T>): Promise<T | null> {
  const same = () => {
    const active = organizerSettingsSession(client);
    return active?.organizerId === session.organizerId && active.revision === session.revision;
  };
  if (!same()) return null;
  try {
    const result = await read();
    return same() ? result : null;
  } catch (error) {
    if (!same()) return null;
    throw error;
  }
}

export function parseSettingsPlan(raw: unknown, organizerId: string) {
  const root = record(raw), plan = record(root?.plan), usage = record(root?.consumption);
  const subscription = record(root?.subscription);
  if (!root || root.sandbox !== true || !usage || !count(usage.campaigns) ||
      (root.plan !== null && !plan) || (root.subscription !== null && !subscription))
    throw invalid();
  if (plan && (!text(plan.name) || typeof plan.monthlyPrice !== "number" ||
      !Number.isFinite(plan.monthlyPrice) || plan.monthlyPrice < 0)) throw invalid();
  if (subscription && (subscription.organizerId !== organizerId || !text(subscription.status) ||
      typeof subscription.autoRenew !== "boolean" ||
      (subscription.nextRenewalAt !== null && !date(subscription.nextRenewalAt)))) throw invalid();
  return {
    campaigns: usage.campaigns,
    plan: plan ? {
      name: plan.name as string,
      monthlyPrice: plan.monthlyPrice as number,
      description: text(plan.description) ? plan.description : null,
      features: rows(plan.features, (rawFeature) => {
        const f = record(rawFeature);
        if (!f || !text(f.id) || !text(f.name) ||
          !(text(f.value) || typeof f.value === "boolean" || typeof f.value === "number" && Number.isFinite(f.value))) throw invalid();
        return { id: f.id, name: f.name, value: f.value };
      }),
    } : null,
    subscription: subscription ? {
      status: subscription.status as string, autoRenew: subscription.autoRenew as boolean,
      nextRenewalAt: subscription.nextRenewalAt as string | null,
    } : null,
  };
}

export type LegalDocumentEntry = { slug: string; title: string; category: string; version: number };
function documentEntry(raw: unknown): LegalDocumentEntry {
  const row = record(raw);
  if (!row || !slug(row.slug) || !text(row.title) || !text(row.category) ||
    !count(row.version) || row.version === 0) throw invalid();
  return { slug: row.slug, title: row.title, category: row.category, version: row.version };
}
export function parseLegalSettings(documents: unknown, acceptances: unknown, requests: unknown, organizerId: string) {
  return {
    documents: rows(documents, documentEntry),
    acceptances: rows(acceptances, (raw) => {
      const row = record(raw), doc = record(row?.document);
      if (!row || row.userId !== organizerId || !text(row.id) || !date(row.acceptedAt) || !doc) throw invalid();
      return { ...documentEntry({ ...doc, version: row.version }), id: row.id, acceptedAt: row.acceptedAt };
    }),
    requests: rows(requests, (raw) => {
      const row = record(raw);
      if (!row || row.userId !== organizerId || !text(row.id) || !text(row.type) ||
          !text(row.status) || !date(row.requestedAt)) throw invalid();
      return { id: row.id, type: row.type, status: row.status, requestedAt: row.requestedAt };
    }),
  };
}
export function parseLegalDocument(raw: unknown, expected: LegalDocumentEntry) {
  const doc = documentEntry(raw);
  if (doc.slug !== expected.slug || doc.version !== expected.version) throw invalid();
  const content = record(record(raw)?.content);
  if (!content) throw invalid();
  // Web intentionally prioritizes its original HTML. Never strip or partially
  // render an authoritative legal document, execute markup, or open remote media.
  if (typeof content.html === "string" && content.html.length > 0)
    return { kind: "rich-on-web", document: doc } as const;
  const blocks = rows(content.blocks, (rawBlock) => {
    const block = record(rawBlock);
    if (!block || typeof block.text !== "string") throw invalid();
    return block.text;
  });
  if (!blocks.some((block) => block.trim())) throw invalid();
  return { kind: "text", document: doc, blocks } as const;
}
export const loadSettingsPlan = (client: SettingsClient, session: SettingsSession) =>
  scoped(client, session, async () => parseSettingsPlan(
    await client.request<unknown>(organizerSettingsPaths.plan), session.organizerId,
  ));
export const loadSettingsLegal = (client: SettingsClient, session: SettingsSession) =>
  scoped(client, session, async () => {
    const result = await Promise.all([
      client.publicRequest<unknown>(organizerSettingsPaths.documents),
      client.request<unknown>(organizerSettingsPaths.acceptances),
      client.request<unknown>(organizerSettingsPaths.requests),
    ]);
    return parseLegalSettings(...result, session.organizerId);
  });
export const loadSettingsDocument = (client: SettingsClient, session: SettingsSession, expected: LegalDocumentEntry) =>
  scoped(client, session, async () => {
    if (!slug(expected.slug)) throw invalid();
    return parseLegalDocument(await client.publicRequest<unknown>(organizerSettingsPaths.documents + "/" + expected.slug), expected);
  });
