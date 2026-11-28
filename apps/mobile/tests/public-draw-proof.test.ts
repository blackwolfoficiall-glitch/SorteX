import assert from "node:assert/strict";
import { test } from "node:test";
import { ApiError } from "../src/api/client";
import { readPublicDrawProof } from "../src/domain/public-draw-proof";

const code = "0123456789ABCDEF";
const official = ["086997", "004852", "000091", "082438", "039210"];
const canonical = ["86997", "04852", "00091", "82438", "39210"];
const proof = {
  verificationCode: code,
  status: "IDENTIFIED",
  winningNumber: "19000",
  campaign: { title: "Caso sintético", slug: "synthetic-federal" },
  draw: {
    date: "2026-11-26T03:30:00.000Z",
    auditHash: "a".repeat(64),
    rule: { version: 1, steps: [{ sourcePrize: 3, direction: "REVERSE" }] },
    result: {
      rawResult: "19000",
      normalizedResult: "19000",
      lottery: {
        extractionNumber: "6091",
        drawDate: "2026-08-12T00:00:00.000Z",
        sourcePrizes: official,
        prizes: canonical,
      },
    },
    lottery: { extractionNumber: "mutable-live-summary" },
  },
};
function response(value: unknown) {
  return {
    publicRequest: async <T>(path: string) => {
      assert.equal(path, `/public/winners/verify/${code}`);
      return value as T;
    },
  };
}

test("prova pública usa snapshot imutável e preserva valores textuais", async () => {
  const result = await readPublicDrawProof(response(proof), ` ${code} `);
  assert.equal(result.winningTicket, "19000");
  assert.equal(result.extractionNumber, "6091");
  assert.equal(result.sourcePrizes?.[2], "000091");
  assert.equal(result.canonicalPrizes?.[2], "00091");
  assert.deepEqual(result.rule, proof.draw.rule);
  assert.equal(result.auditHash, proof.draw.auditHash);
});

test("mantém exatamente os zeros do título vencedor", async () => {
  assert.equal(
    (
      await readPublicDrawProof(
        response({ ...proof, winningNumber: "00091" }),
        code,
      )
    ).winningTicket,
    "00091",
  );
  await assert.rejects(
    readPublicDrawProof(response({ ...proof, winningNumber: 91 }), code),
    /prova pública/,
  );
});

test("não constrói destinos com URL e não trata 404 ou prova incompleta como sucesso", async () => {
  await assert.rejects(
    readPublicDrawProof(response(proof), "https://site.example/verificar/123"),
    (error) => error instanceof ApiError && error.status === 400,
  );
  const unavailable = {
    publicRequest: async <T>(): Promise<T> => {
      throw new ApiError("Sem prova publicada.", 404);
    },
  };
  await assert.rejects(
    readPublicDrawProof(unavailable, code),
    (error) => error instanceof ApiError && error.status === 404,
  );
  await assert.rejects(
    readPublicDrawProof(
      response({ ...proof, verificationCode: "WRONG" }),
      code,
    ),
    /prova pública/,
  );
});
