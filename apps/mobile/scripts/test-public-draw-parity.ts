import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { ApiError, SortexClient, type Vault } from "../src/api/client";
import { validateApiUrl } from "../src/api/config";
import { readPublicDrawProof } from "../src/domain/public-draw-proof";

function loopback(name: string) {
  const url = new URL(process.env[name] ?? "");
  assert.ok(
    url.protocol === "http:" &&
      url.hostname === "127.0.0.1" &&
      url.pathname === "/" &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash,
    `${name} deve apontar para loopback.`,
  );
  return url.origin;
}

async function main() {
  assert.equal(process.env.SORTEX_FEDERAL_PARITY_MODE, "local-synthetic-only");
  const api = validateApiUrl(loopback("SORTEX_PARITY_API"), true);
  const web = loopback("SORTEX_PARITY_WEB");
  const fixture = JSON.parse(
    await readFile(process.env.SORTEX_FEDERAL_PARITY_FIXTURE ?? "", "utf8"),
  ) as {
    email: string;
    password: string;
    campaignId: string;
    campaignSlug: string;
    lotteryDrawId: string;
  };
  assert.match(fixture.email, /^sortex-federal-[0-9a-f]+@example\.test$/);
  assert.match(fixture.campaignSlug, /^synthetic-federal-[0-9a-f]+$/);
  let tokens: Awaited<ReturnType<Vault["read"]>> = null;
  const mobile = new SortexClient(api, {
    read: async () => tokens,
    write: async (next) => {
      tokens = next;
    },
    clear: async () => {
      tokens = null;
    },
  });
  await mobile.login(fixture.email, fixture.password);
  const path = `/campaigns/${encodeURIComponent(fixture.campaignId)}/draw`;
  const execute = await mobile.request<{
    winningNumber: string;
    normalizedWinningNumber: string;
    status: string;
  }>(`${path}/execute`, "POST", { lotteryDrawId: fixture.lotteryDrawId });
  assert.equal(execute.status, "PENDING_CONFIRMATION");
  assert.equal(execute.winningNumber, "19000");
  assert.equal(execute.normalizedWinningNumber, "19000");
  const confirmation = await mobile.request<{
    draw: { status: string; auditHash: string };
    winner: { publicVerificationCode: string; winningNumber: string };
  }>(`${path}/confirm`, "POST", {});
  assert.equal(confirmation.draw.status, "CONFIRMED");
  assert.equal(confirmation.winner.winningNumber, "19000");
  await mobile.logout();

  const code = confirmation.winner.publicVerificationCode;
  const webPath = `/api/public/winners/verify/${encodeURIComponent(code)}`;
  const [appProof, webResponse] = await Promise.all([
    readPublicDrawProof(mobile, code),
    fetch(web + webPath, {
      redirect: "error",
      cache: "no-store",
      signal: AbortSignal.timeout(15000),
    }),
  ]);
  assert.equal(webResponse.status, 200);
  assert.equal(webResponse.headers.get("Cache-Control"), "no-store");
  const webProof = (await webResponse.json()) as {
    verificationCode: string;
    status: string;
    winningNumber: string;
    campaign: { slug: string };
    draw: {
      date: string;
      auditHash: string;
      rule: unknown;
      result: {
        rawResult: string;
        normalizedResult: string;
        lottery: {
          extractionNumber: string;
          drawDate: string;
          sourcePrizes: string[];
          prizes: string[];
        };
      };
    };
  };
  const { result } = webProof.draw;
  assert.equal(webProof.verificationCode, code);
  assert.equal(appProof.code, code);
  assert.equal(webProof.winningNumber, "19000");
  assert.equal(appProof.winningTicket, "19000");
  assert.equal(appProof.winnerStatus, webProof.status);
  assert.equal(appProof.winnerStatus, "IDENTIFIED");
  assert.equal(appProof.campaignSlug, fixture.campaignSlug);
  assert.equal(appProof.campaignSlug, webProof.campaign.slug);
  assert.equal(appProof.confirmedAt, webProof.draw.date);
  assert.equal(appProof.auditHash, confirmation.draw.auditHash);
  assert.equal(appProof.auditHash, webProof.draw.auditHash);
  assert.deepEqual(appProof.rule, webProof.draw.rule);
  const steps = appProof.rule.steps;
  assert.ok(Array.isArray(steps) && steps.length === 5);
  assert.ok(
    steps.every(
      (step) => step?.sourcePrize === 3 && step?.direction === "REVERSE",
    ),
  );
  assert.equal(appProof.rawResult, result.rawResult);
  assert.equal(appProof.rawResult, "19000");
  assert.equal(appProof.normalizedResult, result.normalizedResult);
  assert.equal(appProof.normalizedResult, "19000");
  assert.equal(appProof.extractionNumber, result.lottery.extractionNumber);
  assert.equal(appProof.extractionNumber, "6091");
  assert.equal(appProof.extractionDate, result.lottery.drawDate);
  assert.deepEqual(appProof.sourcePrizes, result.lottery.sourcePrizes);
  assert.equal(appProof.sourcePrizes?.[2], "000091");
  assert.deepEqual(appProof.canonicalPrizes, result.lottery.prizes);
  assert.equal(appProof.canonicalPrizes?.[2], "00091");

  const missing = "NOT-A-PUBLISHED-PROOF";
  await assert.rejects(
    readPublicDrawProof(mobile, missing),
    (error) => error instanceof ApiError && error.status === 404,
  );
  const webMissing = await fetch(web + webPath.replace(code, missing), {
    redirect: "error",
    signal: AbortSignal.timeout(15000),
  });
  assert.equal(webMissing.status, 404);
  console.log(
    JSON.stringify({
      type: "local-http-federal-proof-parity-not-ios-acceptance",
      campaignId: fixture.campaignId,
      verificationCode: appProof.code,
      extraction: appProof.extractionNumber,
      officialTicket: appProof.sourcePrizes?.[2],
      canonicalTicket: appProof.canonicalPrizes?.[2],
      winningTicket: appProof.winningTicket,
      rule: "five explicit reverse steps from prize 3",
      drawStatus: confirmation.draw.status,
      winnerStatus: appProof.winnerStatus,
      auditHash: appProof.auditHash,
      equalPublicProof: true,
      unpublishedCodeRejectedByBoth: true,
      paymentCalls: 0,
    }),
  );
}

void main().catch((error: unknown) => {
  console.error(
    error instanceof Error ? error.message : "Falha no smoke de prova Federal.",
  );
  process.exitCode = 1;
});
