import assert from "node:assert/strict";
import test from "node:test";
import { draftWizardStages, changedDraftFields, checkedWizardFields, confirmedDraftWrite } from "../src/domain/organizer-draft-wizard";
import { draftFields, draftPayload, emptyOrganizerDraft, isEditableOrganizerCampaign,
  listOrganizerDrawTemplates, mayChooseOrganizerDrawTemplate, saveOrganizerCampaign, saveOrganizerDraft } from "../src/domain/organizer-draft";

test("organizer draft converts pt-BR monetary values and preserves editable fields", () => {
  const fields = draftFields({ id: "local-draft", status: "DRAFT", title: "Prêmio sintético", numberPrice: 0.12, totalNumbers: 100 });
  assert.equal(fields.numberPrice, "0,12");
  assert.deepEqual(draftPayload(fields), {
    title: "Prêmio sintético", numberPrice: 0.12, totalNumbers: 100, description: "", mainPrizeName: "",
  });
});

test("organizer draft refuses invalid inputs locally, while the API remains authoritative", () => {
  assert.throws(() => draftPayload(emptyOrganizerDraft), /título/);
  assert.throws(() => draftPayload({ ...emptyOrganizerDraft, title: "Teste", numberPrice: "2,001" }), /preço/);
  assert.throws(() => draftPayload({ ...emptyOrganizerDraft, title: "Teste", totalNumbers: "10000001" }), /cotas/);
});

test("only title is needed while saving initial partial drafts", async () => {
  const requestBodies: unknown[] = [];
  const api = { request: async <T>(_path: string, _method?: string, body?: unknown) => {
    requestBodies.push(body);
    return { id: "draft", title: "Campanha sintética", status: "DRAFT" } as T;
  } };
  const initial = await saveOrganizerDraft(api, { ...emptyOrganizerDraft, title: "Campanha sintética" });
  await saveOrganizerDraft(api, { ...draftFields(initial), regulation: " Regulamento sintético " }, initial);
  assert.deepEqual(requestBodies, [
    { title: "Campanha sintética", description: "", mainPrizeName: "" },
    { regulation: "Regulamento sintético" },
  ]);
});

test("native editor composes Federal publication fields with local sale time but a clock-independent draw date", () => {
  const oldTimeZone = process.env.TZ;
  try {
    process.env.TZ = "America/Bahia";
    const fields = {
      ...emptyOrganizerDraft, title: "Campanha de exemplo", regulation: " Regulamento de teste ",
      mainPrizeName: "Prêmio sintético", mainPrizeDescription: " Descrição do prêmio ",
      estimatedPrizeValue: "1234,55", numberPrice: "0,12", totalNumbers: "500",
      minimumPurchase: "2", drawDate: "29/02/2028", drawTime: "18:15",
      salesStartDate: "01/02/2028", salesStartTime: "23:50", drawRuleTemplateId: "template-federal",
    };
    const payload = draftPayload(fields);
    assert.deepEqual(payload, {
      title: "Campanha de exemplo", description: "", regulation: "Regulamento de teste",
      mainPrizeName: "Prêmio sintético", mainPrizeDescription: "Descrição do prêmio",
      estimatedPrizeValue: 1234.55, numberPrice: 0.12, totalNumbers: 500,
      minimumPurchase: 2, drawDate: "2028-02-29", drawTime: "18:15",
      salesStartAt: "2028-02-02T02:50:00.000Z", drawBasis: "LOTERIA_FEDERAL",
      drawRuleTemplateId: "template-federal",
    });
    const record = { ...payload, id: "draft", title: fields.title, status: "DRAFT", drawDate: "2028-02-29T00:00:00.000Z",
      salesStartAt: "2028-02-02T02:50:15.123Z" };
    const loaded = draftFields(record);
    assert.equal(loaded.drawDate, fields.drawDate);
    assert.equal(loaded.drawTime, fields.drawTime);
    assert.equal(loaded.salesStartDate, fields.salesStartDate);
    assert.equal(loaded.salesStartTime, fields.salesStartTime);
    assert.deepEqual(draftPayload({ ...loaded, title: "Revisão" }, record), { title: "Revisão" });
    assert.deepEqual(draftPayload({ ...loaded, regulation: "" }, record), { regulation: "" });
    assert.throws(() => draftPayload({ ...loaded, drawDate: "" }, record), /substituir a data/);

    // Sales time skipped by a daylight-saving transition does not silently move an hour.
    process.env.TZ = "America/New_York";
    assert.throws(() => draftPayload({ ...fields, salesStartDate: "10/03/2024", salesStartTime: "02:30" }), /não existe no fuso/);
  } finally {
    if (oldTimeZone === undefined) delete process.env.TZ;
    else process.env.TZ = oldTimeZone;
  }
});

test("optional publication fields reject invalid dates, times, amounts and quantities", () => {
  const draft = { ...emptyOrganizerDraft, title: "Teste sintético" };
  for (const invalid of ["29/02/2026", "31/04/2028", "2028-04-02", "01/13/2028", "00/01/2028"])
    assert.throws(() => draftPayload({ ...draft, drawDate: invalid }), /data de sorteio/);
  for (const invalid of ["7:30", "24:00", "12:60"])
    assert.throws(() => draftPayload({ ...draft, drawTime: invalid }), /horário de sorteio/);
  assert.throws(() => draftPayload({ ...draft, salesStartDate: "15/01/2028" }), /horário de início/);
  assert.throws(() => draftPayload({ ...draft, salesStartTime: "09:00" }), /data de início/);
  for (const invalid of ["0,015", "-1", "1e9", "1000000000000,00"])
    assert.throws(() => draftPayload({ ...draft, estimatedPrizeValue: invalid }), /valor estimado/);
  assert.throws(() => draftPayload({ ...draft, totalNumbers: "8", minimumPurchase: "9" }), /compra mínima não pode/);
});

test("drafts without new Federal selections do not send or replace an existing rule", () => {
  for (const protectedRule of [
    { drawBasis: "CUSTOM", customDrawRule: { digits: [] } },
    { drawBasis: "MANUAL_RESULT" },
    { drawBasis: "LOTERIA_FEDERAL", customDrawRule: { digits: [] } },
  ]) {
    const record = { id: "r", status: "DRAFT", title: "Campanha", ...protectedRule };
    const fields = draftFields(record);
    assert.equal(mayChooseOrganizerDrawTemplate(record), false);
    assert.deepEqual(draftPayload({ ...fields, mainPrizeName: "Outro prêmio" }, record), { mainPrizeName: "Outro prêmio" });
    assert.throws(() => draftPayload({ ...fields, drawRuleTemplateId: "federal" }, record), /regra existente/);
  }
});

test("published rule-picker choices use the authenticated API and validate the list body", async () => {
  const request = async <T>(path: string, method?: string) => {
    assert.equal(path, "/draw-rule-templates");
    assert.equal(method, undefined);
    return [null, { id: "", name: "Incompleto" }, { id: "a", name: "Modelo", description: "Descrição", ruleDefinition: {} }] as T;
  };
  assert.deepEqual(await listOrganizerDrawTemplates({ request }), [{ id: "a", name: "Modelo", description: "Descrição" }]);
  await assert.rejects(listOrganizerDrawTemplates({ request: async <T>() => ({ malformed: true }) as T }), /confirmar os modelos/);
});

test("published and paused organizer campaigns send only changed title and description", async () => {
  const calls: Array<{ path: string; method?: string; body: unknown }> = [];
  const api = {
    async request<T>(path: string, method?: string, body?: unknown): Promise<T> {
      calls.push({ path, method, body });
      return {} as T;
    },
  };
  const campaign = { id: "campaign/public-copy", status: "PUBLISHED", title: "Título inicial",
    description: "Descrição inicial", mainPrizeName: "Prêmio original", totalNumbers: 250, numberPrice: 0.12 };
  await saveOrganizerCampaign(api, { ...draftFields(campaign), description: " Descrição editada ",
    shortDescription: " Resumo editado ", numberPrice: "70,00", totalNumbers: "900", mainPrizeName: "Não sobrescrever",
    regulation: "Não alterar", drawDate: "Data inválida ignorada no modo texto", drawRuleTemplateId: "Não mudar" }, campaign);
  const paused = { ...campaign, status: "PAUSED" };
  await saveOrganizerCampaign(api, { ...draftFields(paused), title: " Título editado " }, paused);
  await saveOrganizerCampaign(api, draftFields(campaign), campaign);
  assert.deepEqual(calls, [
    { path: "/campaigns/campaign%2Fpublic-copy", method: "PATCH", body: { description: "Descrição editada", shortDescription: "Resumo editado" } },
    { path: "/campaigns/campaign%2Fpublic-copy", method: "PATCH", body: { title: "Título editado" } },
  ]);
});

test("finished and unknown campaigns are not editable and do not send requests", () => {
  const api = { request: async () => assert.fail("Campaign update unexpectedly sent") };
  assert.equal(isEditableOrganizerCampaign("PUBLISHED"), true);
  assert.equal(isEditableOrganizerCampaign("PAUSED"), true);
  assert.equal(isEditableOrganizerCampaign("DRAFT"), true);
  for (const status of ["FINISHED", "CANCELLED", "PENDING_REVIEW", "UNKNOWN"]) {
    assert.equal(isEditableOrganizerCampaign(status), false);
    const campaign = { id: "campaign", title: "Sintética", status };
    assert.throws(() => saveOrganizerCampaign(api, draftFields(campaign), campaign), /não pode mais ser editada/);
  }
});

import type { AuthState } from "../src/api/client";
import {
  campaignStateLabel,
  loadOrganizerWorkspace,
  parseOwnedCampaign,
  parseOwnedCampaignList,
} from "../src/organizer/campaign-workspace";

const ownedCampaign = {
  id: "owned-campaign", organizerId: "organizer-a", title: "Rascunho de teste",
  status: "DRAFT", numberPrice: 0.2, totalNumbers: 100, soldNumbers: 9,
  publishedAt: null, publicationBlocked: false, secretNotUsed: "never display",
};

test("organizer campaign workspace projects only owned values and never fabricates missing progress", () => {
  const record = parseOwnedCampaign(ownedCampaign, "organizer-a", "owned-campaign");
  assert.deepEqual(record.progress, { sold: 9, total: 100, percent: 9 });
  assert.equal(record.numberPrice, 0.2);
  assert.equal(record.publishedAt, null);
  assert.equal("secretNotUsed" in record, false);
  assert.equal(parseOwnedCampaign({ ...ownedCampaign, soldNumbers: 101 }, "organizer-a").progress, undefined);
  assert.equal(parseOwnedCampaign({ ...ownedCampaign, totalNumbers: 0 }, "organizer-a").progress, undefined);
  assert.equal(parseOwnedCampaign({ ...ownedCampaign, numberPrice: NaN }, "organizer-a").numberPrice, undefined);
  assert.equal(campaignStateLabel("DRAFT"), "Rascunho");
  assert.equal(campaignStateLabel("CANCELLED"), "Cancelada");
  assert.equal(campaignStateLabel("toString"), "Situação indisponível");
  assert.throws(() => parseOwnedCampaign(ownedCampaign, "organizer-b"));
  assert.throws(() => parseOwnedCampaign(ownedCampaign, "organizer-a", "different-id"));
  assert.throws(() => parseOwnedCampaignList([ownedCampaign, ownedCampaign], "organizer-a"));
  assert.throws(() => parseOwnedCampaignList([ownedCampaign, { ...ownedCampaign, id: "b", organizerId: "organizer-b" }], "organizer-a"));
  assert.deepEqual(parseOwnedCampaignList({ items: [] }, "organizer-a"), []);
});

test("organizer workspace rejects buyers before network and drops stale reads after a revision change", async () => {
  const owner = { id: "organizer-a", name: "Organizador", email: "organizer@example.test", role: "ORGANIZER" as const };
  let auth: AuthState = { status: "signedIn", user: { ...owner, role: "BUYER" } };
  let revision = 1;
  let calls = 0;
  const expected = { organizerId: owner.id, revision };
  const fixture = {
    snapshot: () => auth,
    activeSessionRevision: () => revision,
    request: async <T>(path: string): Promise<T> => {
      assert.equal(path, "/campaigns/my");
      calls++;
      revision++;
      return [ownedCampaign] as T;
    },
  };
  assert.equal(await loadOrganizerWorkspace(fixture, expected, "/campaigns/my", parseOwnedCampaignList), null);
  assert.equal(calls, 0);
  auth = { status: "signedIn", user: owner };
  assert.equal(await loadOrganizerWorkspace(fixture, expected, "/campaigns/my", parseOwnedCampaignList), null);
  assert.equal(calls, 1);
});

test("the ten native wizard phases validate only current input; unsaved fields survive switching and persisted drafts hydrate", () => {
  assert.deepEqual(draftWizardStages.map(({ key }) => key),
    ["info", "media", "prizes", "numbers", "instant", "promotions", "rule", "dates", "payment", "review"]);
  const form = { ...emptyOrganizerDraft, title: "Campanha sintética", regulation: "Regulamento",
    mainPrizeName: "Prêmio sintético", numberPrice: "1,001" };
  assert.throws(() => checkedWizardFields("info", emptyOrganizerDraft), /título/);
  assert.doesNotThrow(() => checkedWizardFields("info", form));
  assert.doesNotThrow(() => checkedWizardFields("prizes", form));
  assert.throws(() => checkedWizardFields("numbers", form), /preço/);
  assert.equal(form.regulation, "Regulamento");
  assert.equal(form.mainPrizeName, "Prêmio sintético");
  assert.equal(form.numberPrice, "1,001");
  assert.equal(changedDraftFields(form), true);
  const record = { id: "draft", status: "DRAFT", organizerId: "a", title: form.title,
    regulation: form.regulation, mainPrizeName: form.mainPrizeName, numberPrice: 1.12 };
  assert.equal(changedDraftFields(draftFields(record), record), false);
  assert.equal(changedDraftFields({ ...draftFields(record), mainPrizeName: "Outro prêmio" }, record), true);
  assert.equal(confirmedDraftWrite(record, "a"), true);
  assert.equal(confirmedDraftWrite(record, "b"), false);
  assert.equal(confirmedDraftWrite({ ...record, id: "wrong" }, "a", record), false);
  assert.equal(confirmedDraftWrite({ ...record, status: "PUBLISHED" }, "a", record), false);
});

test("sales closing persists with the existing local-time contract and never resends untouched timestamps", () => {
  const old = process.env.TZ;
  try {
    process.env.TZ = "America/Bahia";
    const form = { ...emptyOrganizerDraft, title: "Campanha sintética",
      salesStartDate: "20/02/2028", salesStartTime: "19:30",
      salesEndDate: "20/02/2028", salesEndTime: "23:45" };
    const payload = checkedWizardFields("dates", form);
    assert.equal(payload.salesStartAt, "2028-02-20T22:30:00.000Z");
    assert.equal(payload.salesEndAt, "2028-02-21T02:45:00.000Z");
    assert.throws(() => checkedWizardFields("dates", { ...form, salesEndTime: "" }), /horário de encerramento/);
    assert.throws(() => checkedWizardFields("dates", { ...form, salesEndTime: "19:30" }), /posterior ao início/);
    const record = { id: "draft", status: "DRAFT", title: form.title,
      salesStartAt: payload.salesStartAt, salesEndAt: "2028-02-21T02:45:18.004Z", customization: { retained: true } };
    const loaded = draftFields(record);
    assert.equal(loaded.salesEndDate, "20/02/2028");
    assert.equal(loaded.salesEndTime, "23:45");
    assert.deepEqual(draftPayload({ ...loaded, title: "Novo título" }, record), { title: "Novo título" });
    assert.throws(() => draftPayload({ ...loaded, salesEndDate: "" }, record), /substituir a data de encerramento/);
    assert.throws(() => draftPayload({ ...loaded, salesStartTime: "23:46" }, record), /posterior ao início/);
  } finally {
    if (old === undefined) delete process.env.TZ;
    else process.env.TZ = old;
  }
});
