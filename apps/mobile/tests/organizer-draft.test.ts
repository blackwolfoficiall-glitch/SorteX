import assert from "node:assert/strict";
import test from "node:test";
import { draftFields, draftPayload, emptyOrganizerDraft } from "../src/domain/organizer-draft";

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
