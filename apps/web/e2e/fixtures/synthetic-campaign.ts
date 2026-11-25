import { randomUUID } from "node:crypto";
import { expect, test, type APIRequestContext } from "@playwright/test";

const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAAFElEQVR4nGP4z8DAwMDAxMDAwMDAAAANHQEDasKb6QAAAABJRU5ErkJggg==",
  "base64",
);

export async function createSyntheticCampaign(
  request: APIRequestContext,
  label: string,
  options: { publish?: boolean; fields?: Record<string, unknown> } = {},
) {
  const base = test.info().project.use.baseURL;
  const loopback = ["127.0.0.1", "localhost", "[::1]"];
  const upstreams = [process.env.PLAYWRIGHT_API_URL, process.env.API_INTERNAL_URL, process.env.API_URL]
    .filter((value): value is string => Boolean(value));
  if (!base || ![base, ...upstreams].every((url) => loopback.includes(new URL(url).hostname))) {
    throw new Error("Campanhas sintéticas exigem Next e API de teste locais e isolados.");
  }
  const runId = randomUUID();
  const slug = `homologacao-e2e-${runId}`;
  const now = Date.now();
  const created = await request.post("/api/campaigns", {
    data: {
      title: `[HOMOLOGAÇÃO] ${label} ${runId.slice(0, 8)}`,
      slug,
      category: "OTHER",
      regulation: "Regulamento exclusivo de homologação automatizada.",
      mainPrizeName: "Prêmio de homologação",
      mainPrizeDescription: "Prêmio fictício exclusivo de homologação.",
      estimatedPrizeValue: 100,
      totalNumbers: 1000,
      numberPrice: 1,
      minimumPurchase: 1,
      maximumPurchasePerBuyer: 500,
      numberSelectionMode: "RANDOM",
      drawDate: new Date(now + 7 * 86400000).toISOString(),
      drawTime: "20:00",
      drawBasis: "MANUAL_RESULT",
      salesStartAt: new Date(now - 86400000).toISOString(),
      ...options.fields,
    },
  });
  expect(created.ok(), await created.text()).toBeTruthy();
  const campaign = await created.json() as {
    id: string;
    slug: string;
    title: string;
    totalNumbers: number;
  };
  const cover = await request.post(`/api/campaigns/${campaign.id}/images`, {
    multipart: {
      target: "COVER",
      files: { name: "capa-homologacao.png", mimeType: "image/png", buffer: png },
    },
  });
  expect(cover.ok(), await cover.text()).toBeTruthy();
  if (options.publish) {
    const published = await request.post(`/api/campaigns/${campaign.id}/publish`);
    expect(published.ok(), await published.text()).toBeTruthy();
    expect((await published.json()).status).toBe("PUBLISHED");
  }
  return campaign;
}
