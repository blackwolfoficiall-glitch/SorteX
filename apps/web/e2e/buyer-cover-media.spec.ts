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

test("capa privada publica, troca no mesmo endereço e volta a ser privada ao pausar", async ({ page, browser, baseURL }) => {
  const campaign = await createSyntheticCampaign(page.request, "Capa com visibilidade por status");
  const ownedPath = `/api/campaigns/${campaign.id}/media/cover`;
  const publicPath = `/api/public/campaign-media/${campaign.id}/cover`;
  const ownedImage = page.getByRole("img", { name: campaign.title, exact: true });
  async function showsOwnerCover(status: "DRAFT" | "PAUSED", width: number) {
    await page.goto(`/dashboard/campanhas?status=${status}`);
    await expect(ownedImage).toHaveAttribute("src", ownedPath);
    await expect.poll(() => ownedImage.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(width);
  }

  await showsOwnerCover("DRAFT", 2);
  const draft = await page.request.get(ownedPath);
  expect(draft.status()).toBe(200);
  expect(draft.headers()["cache-control"]).toContain("no-store");
  const draftBytes = await draft.body();

  const guest = await browser.newContext({
    baseURL, ignoreHTTPSErrors: test.info().project.use.ignoreHTTPSErrors,
  });
  try {
    expect((await guest.request.get(publicPath)).status()).toBe(403);
    const published = await page.request.post(`/api/campaigns/${campaign.id}/publish`);
    expect(published.status()).toBe(201);
    const storefront = await guest.newPage();
    await storefront.goto(`/campanha/${campaign.slug}`);
    const publicImage = storefront.getByRole("img", { name: campaign.title, exact: true });
    await expect(publicImage).toHaveAttribute("src", publicPath);
    await expect.poll(() => publicImage.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(2);
    const media = await guest.request.get(publicPath);
    expect(media.status()).toBe(200);
    expect(media.headers()["content-type"]).toContain("image/png");
    expect(media.headers()["cache-control"]).toContain("no-store");
    expect(await media.body()).toEqual(draftBytes);

    // 3×2 differs from the original 2×2 fixture; no cache-busting changes to the src.
    const replacement = Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAMAAAACCAIAAAASFvFNAAAAEElEQVR4nGNI0bgDQQxwFgBRpAhx0roQKQAAAABJRU5ErkJggg==",
      "base64",
    );
    expect(replacement).not.toEqual(draftBytes);
    const uploaded = await page.request.post(`/api/campaigns/${campaign.id}/images`, {
      multipart: {
        target: "COVER",
        files: { name: "nova-capa-sintetica.png", mimeType: "image/png", buffer: replacement },
      },
    });
    expect(uploaded.status()).toBe(201);
    expect(await uploaded.json()).toMatchObject({ id: campaign.id, status: "PUBLISHED" });
    const changedMedia = storefront.waitForResponse((response) =>
      new URL(response.url()).pathname === publicPath && response.request().resourceType() === "image",
    );
    await storefront.reload();
    await expect(publicImage).toHaveAttribute("src", publicPath);
    await expect.poll(() => publicImage.evaluate((img: HTMLImageElement) => img.naturalWidth)).toBe(3);
    const reloaded = await changedMedia;
    expect(reloaded.status()).toBe(200);
    expect(reloaded.headers()["content-type"]).toContain("image/png");
    expect(reloaded.headers()["cache-control"]).toContain("no-store");
    expect(await reloaded.body()).toEqual(replacement);

    const paused = await page.request.post(`/api/campaigns/${campaign.id}/pause`);
    expect(paused.status()).toBe(201);
    const gone = await guest.request.get(publicPath);
    expect(gone.status()).toBe(403);
    expect(gone.headers()["cache-control"]).toContain("no-store");
    await storefront.reload();
    await expect(storefront.getByText("Campanha não encontrada.", { exact: true })).toBeVisible();
    await expect(publicImage).toHaveCount(0);
    await showsOwnerCover("PAUSED", 3);
    const privateMedia = await page.request.get(ownedPath);
    expect(privateMedia.status()).toBe(200);
    expect(privateMedia.headers()["cache-control"]).toContain("no-store");
    expect(await privateMedia.body()).toEqual(replacement);
  } finally {
    await guest.close();
  }
});
