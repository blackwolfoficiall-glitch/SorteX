import assert from "node:assert/strict";
import test from "node:test";
import { draftFields, draftPayload, emptyOrganizerDraft, isEditableOrganizerCampaign, saveOrganizerCampaign } from "../src/domain/organizer-draft";

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
    shortDescription: " Resumo editado ", numberPrice: "70,00", totalNumbers: "900", mainPrizeName: "Não sobrescrever" }, campaign);
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
