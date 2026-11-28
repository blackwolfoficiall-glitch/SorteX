import assert from "node:assert/strict";
import test from "node:test";
import { projectBuyerPrizes } from "./prizes.ts";

const row = {
  id: "fixture-id", buyerId: "owner", winningNumber: "00091", status: "PENDING_CONTACT",
  campaign: { title: "Campanha sintética", privateField: "do not return" },
  prizeName: "Sorteio sintético", instantPrize: { description: "Cota sintética" },
  confirmationToken: "do not return",
};

test("projects only prize display fields and keeps leading zeros in both lists", () => {
  assert.deepEqual(projectBuyerPrizes([row], "owner", "draw"), [{
    id: "fixture-id", ticketNumber: "00091", prizeName: "Sorteio sintético",
    campaignTitle: "Campanha sintética", status: "Contato pendente",
  }]);
  assert.deepEqual(projectBuyerPrizes([{ ...row, status: "IDENTIFIED" }], "owner", "instant"), [{
    id: "fixture-id", ticketNumber: "00091", prizeName: "Cota sintética",
    campaignTitle: "Campanha sintética", status: "Prêmio identificado",
  }]);
});

test("rejects malformed payloads or mixed accounts instead of showing them or a false empty state", () => {
  assert.deepEqual(projectBuyerPrizes([], "owner", "draw"), []);
  for (const value of [null, {}, [row, { ...row, buyerId: "other" }], [{ ...row, winningNumber: 91 }]]) {
    assert.throws(() => projectBuyerPrizes(value, "owner", "draw"));
  }
});
