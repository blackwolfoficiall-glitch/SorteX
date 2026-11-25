import { expect, test } from "@playwright/test";
import { createSyntheticCampaign } from "./fixtures/synthetic-campaign";

test("comprador vê a capa publicada carregada no card do sorteio", async ({ page }) => {
  const campaign = await createSyntheticCampaign(page.request, "Capa no comprador", {
    publish: true,
  });
  const email = process.env.E2E_BUYER_EMAIL;
  const password = process.env.E2E_BUYER_PASSWORD;
  if (!email || !password)
    throw new Error("Defina E2E_BUYER_EMAIL e E2E_BUYER_PASSWORD para a conta sintética.");

  // The organizer fixture is shared by other tests. Clear only this context's
  // cookie rather than revoking the shared session in the backend.
  await page.context().clearCookies();
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Entrar", exact: true }).click();
  await expect(page).toHaveURL(/\/comprador/);

  await page.goto("/comprador/sorteios");
  const cardCover = page.getByRole("img", { name: campaign.title, exact: true });
  await expect(cardCover).toBeVisible();
  const src = await cardCover.getAttribute("src");
  expect(src).toBe(`/api/public/campaign-media/${campaign.id}/cover`);
  const media = await page.request.get(src!);
  expect(media.ok()).toBeTruthy();
  expect(media.headers()["content-type"]).toContain("image/png");
  await expect.poll(async () =>
    cardCover.evaluate((image: HTMLImageElement) => image.naturalWidth),
  ).toBeGreaterThan(0);
});
