import { expect, test, type Page } from "@playwright/test";
import { createSyntheticCampaign } from "./fixtures/synthetic-campaign";

function campaignCard(page: Page, title: string) {
  return page.getByRole("article").filter({
    has: page.getByRole("heading", { name: title, exact: true }),
  }).filter({ has: page.getByRole("button", { name: "Duplicar", exact: true }) });
}

test("organizador edita, publica, pausa, reativa e encerra com estado persistido", async ({ page, browser, baseURL }) => {
  test.setTimeout(100_000);
  const campaign = await createSyntheticCampaign(page.request, "Jornada web");
  const editedTitle = `Jornada web atualizada ${campaign.id.slice(-8)}`;
  const guest = await browser.newContext({
    baseURL,
    viewport: page.viewportSize(),
    ignoreHTTPSErrors: test.info().project.use.ignoreHTTPSErrors,
  });
  try {
    const publicPath = `/api/public/campaigns/${campaign.slug}`;
    const ownerPath = `/api/campaigns/${campaign.id}`;
    async function status(expected: string) {
      const response = await page.request.get(ownerPath);
      expect(response.status()).toBe(200);
      expect(await response.json()).toMatchObject({ id: campaign.id, title: editedTitle, status: expected });
    }
    async function publicStatus(expected: number) {
      const response = await guest.request.get(publicPath);
      expect(response.status()).toBe(expected);
      if (expected === 200) expect(await response.json()).toMatchObject({ id: campaign.id, title: editedTitle, status: "PUBLISHED" });
    }
    async function action(name: string, endpoint: string, expected: string) {
      const response = page.waitForResponse((res) => res.url().endsWith(`${ownerPath}/${endpoint}`) && res.request().method() === "POST");
      await campaignCard(page, editedTitle).getByRole("button", { name, exact: true }).click();
      const mutation = await response;
      expect(mutation.status(), await mutation.text()).toBe(201);
      expect(await mutation.json()).toMatchObject({ id: campaign.id, status: expected });
      await status(expected);
    }

    await publicStatus(404);
    await page.goto("/dashboard/campanhas");
    await campaignCard(page, campaign.title).getByRole("link", { name: "Editar" }).click();
    await page.getByLabel("Título", { exact: true }).fill(editedTitle);
    await page.getByLabel("Descrição curta (opcional)").fill("Descrição sintética persistida.");
    await page.getByRole("button", { name: "Salvar rascunho" }).first().click();
    await expect(page).toHaveURL(/status=DRAFT$/);
    await status("DRAFT");
    await page.reload();
    await expect(campaignCard(page, editedTitle).getByText("Rascunho", { exact: true })).toBeVisible();
    expect(await (await page.request.get(ownerPath)).json()).toHaveProperty("shortDescription", "Descrição sintética persistida.");

    await action("Publicar", "publish", "PUBLISHED");
    await publicStatus(200);
    await page.goto("/dashboard/campanhas?status=PUBLISHED");
    await expect(campaignCard(page, editedTitle).getByText("Publicada", { exact: true })).toBeVisible();
    const storefront = await guest.newPage();
    await storefront.goto(`/campanha/${campaign.slug}`);
    await expect(storefront.getByRole("heading", { name: editedTitle, exact: true })).toBeVisible();

    await action("Pausar", "pause", "PAUSED");
    await publicStatus(404);
    await storefront.bringToFront();
    await expect(storefront.getByText("Campanha não encontrada.", { exact: true })).toBeVisible({ timeout: 22_000 });
    await expect(storefront.getByRole("heading", { name: editedTitle, exact: true })).toHaveCount(0);

    await page.bringToFront();
    await page.goto("/dashboard/campanhas?status=PAUSED");
    await expect(campaignCard(page, editedTitle).getByText("Pausada", { exact: true })).toBeVisible();
    await campaignCard(page, editedTitle).getByRole("link", { name: "Editar" }).click();
    await page.getByLabel("Descrição curta (opcional)").fill("Editada enquanto pausada.");
    await page.getByRole("button", { name: "Salvar alterações" }).first().click();
    await expect(page).toHaveURL(/status=PAUSED$/);
    expect(await (await page.request.get(ownerPath)).json()).toMatchObject({ status: "PAUSED", shortDescription: "Editada enquanto pausada." });

    await action("Reativar", "publish", "PUBLISHED");
    await publicStatus(200);
    await storefront.reload();
    await expect(storefront.getByRole("heading", { name: editedTitle, exact: true })).toBeVisible();
    await page.goto("/dashboard/campanhas?status=PUBLISHED");
    page.once("dialog", (dialog) => dialog.dismiss());
    await campaignCard(page, editedTitle).getByRole("button", { name: "Encerrar", exact: true }).click();
    await status("PUBLISHED");
    page.once("dialog", (dialog) => dialog.accept());
    await action("Encerrar", "finish", "FINISHED");
    await publicStatus(404);
    await page.goto("/dashboard/campanhas?status=FINISHED");
    const done = campaignCard(page, editedTitle);
    await expect(done.getByText("Finalizada", { exact: true })).toBeVisible();
    await expect(done.getByRole("link", { name: "Editar", exact: true })).toHaveCount(0);
    await expect(done.getByRole("button", { name: /Publicar|Reativar|Pausar|Encerrar/ })).toHaveCount(0);
  } finally {
    await guest.close();
  }
});

test("publicação incompleta mantém rascunho e mostra correção sem perder a lista", async ({ page, request }) => {
  const campaign = await createSyntheticCampaign(page.request, "Checklist incompleto", { fields: { regulation: "" } });
  await page.goto("/dashboard/campanhas");
  const card = campaignCard(page, campaign.title);
  const pending = page.waitForResponse((response) => response.url().endsWith(`/api/campaigns/${campaign.id}/publish`));
  await card.getByRole("button", { name: "Publicar", exact: true }).click();
  expect((await pending).status()).toBe(400);
  await expect(card.getByRole("alert")).toContainText(/complete os seguintes itens.*regulamento/i);
  await expect(card.getByRole("link", { name: "Revisar dados da campanha" })).toHaveAttribute("href", `/dashboard/campanhas/${campaign.id}/editar`);
  await expect(card.getByText("Rascunho", { exact: true })).toBeVisible();
  expect((await request.get(`/api/public/campaigns/${campaign.slug}`)).status()).toBe(404);
});

test("outro organizador não edita nem muda a situação da campanha", async ({ page, browser, baseURL }) => {
  const campaign = await createSyntheticCampaign(page.request, "Isolamento da jornada");
  const email = process.env.E2E_OTHER_ORGANIZER_EMAIL;
  const password = process.env.E2E_OTHER_ORGANIZER_PASSWORD;
  if (!email || !password) throw new Error("Defina a segunda conta de organizador sintética e isolada.");
  const other = await browser.newContext({ baseURL, ignoreHTTPSErrors: test.info().project.use.ignoreHTTPSErrors });
  try {
    const login = await other.request.post("/api/auth/login", { data: { email, password } });
    expect(login.status()).toBe(200);
    expect(await (await other.request.get("/api/auth/me")).json()).toMatchObject({ role: "ORGANIZER", email });
    const path = `/api/campaigns/${campaign.id}`;
    const list = await other.request.get("/api/campaigns/my");
    expect(list.status()).toBe(200);
    expect((await list.json() as { id: string }[]).map(({ id }) => id)).not.toContain(campaign.id);
    expect((await other.request.get(path)).status()).toBe(403);
    expect((await other.request.patch(path, { data: { title: "Alteração rejeitada" } })).status()).toBe(403);
    for (const action of ["publish", "pause", "finish"]) {
      expect((await other.request.post(`${path}/${action}`)).status()).toBe(403);
    }
    expect(await (await page.request.get(path)).json()).toMatchObject({ title: campaign.title, status: "DRAFT" });
  } finally {
    await other.close();
  }
});

test("bloqueio administrativo impede reativar pela tela sem impedir o encerramento", async ({ page, browser, baseURL }) => {
  const campaign = await createSyntheticCampaign(page.request, "Bloqueio de publicação", { publish: true });
  const ownerPath = `/api/campaigns/${campaign.id}`;
  expect((await page.request.post(`${ownerPath}/pause`)).status()).toBe(201);
  const email = process.env.E2E_ADMIN_EMAIL;
  const password = process.env.E2E_ADMIN_PASSWORD;
  if (!email || !password) throw new Error("Defina a conta administrativa sintética e isolada.");
  const admin = await browser.newContext({ baseURL, ignoreHTTPSErrors: test.info().project.use.ignoreHTTPSErrors });
  try {
    const login = await admin.request.post("/api/auth/admin-login", { data: { email, password } });
    expect(login.status()).toBe(200);
    const block = await admin.request.post(`/api/admin/platform/campaigns/${campaign.id}/action`, {
      data: { action: "BLOCK_PUBLICATION", reason: "Matriz sintética de homologação." },
    });
    expect(block.status(), await block.text()).toBe(201);
    expect(await (await page.request.get(ownerPath)).json()).toMatchObject({ status: "PAUSED", publicationBlocked: true });
    await page.goto("/dashboard/campanhas?status=PAUSED");
    const card = campaignCard(page, campaign.title);
    await expect(card.getByText(/a publicação está bloqueada/i)).toBeVisible();
    await expect(card.getByRole("button", { name: "Reativar" })).toHaveCount(0);
    await expect(card.getByRole("button", { name: "Encerrar" })).toBeEnabled();
  } finally {
    await admin.close();
  }
});
