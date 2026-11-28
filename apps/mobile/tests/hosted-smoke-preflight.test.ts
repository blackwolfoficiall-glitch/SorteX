import assert from "node:assert/strict";
import { test } from "node:test";
import { verifyHostedReadiness } from "../scripts/hosted-smoke-preflight";

const expected = "a".repeat(40);
const healthy = { version: expected, environment: "production" };
const warm = [healthy, healthy, { database: "up", storage: "disabled" }] as const;
const stale = { ...healthy, version: "b".repeat(40) };
const noWait = async () => {};

test("hosted smoke requires two consecutive, matching web/mobile samples", async () => {
  let polls = 0;
  const sequence = [warm, [healthy, stale, warm[2]] as const, warm, warm];
  assert.equal(await verifyHostedReadiness(expected, async () => sequence[polls++]!, noWait), warm);
  assert.equal(polls, 4);
});

test("a timed-out and mixed deployment cannot open the hosted seed flow", async () => {
  let polls = 0;
  let waits = 0;
  await assert.rejects(
    verifyHostedReadiness(expected, async () => {
      if (++polls === 1) throw new Error("Transient fixture error");
      return [stale, healthy, { database: "up", storage: "disabled" }] as const;
    }, async () => { waits++; }),
    /Nenhum cadastro/,
  );
  assert.equal(polls, 6);
  assert.equal(waits, 5);
});
