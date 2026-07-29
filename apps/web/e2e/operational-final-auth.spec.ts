import { expect, test, type Page } from "@playwright/test";

test.use({
  storageState: { cookies: [], origins: [] },
});
test.setTimeout(180_000);

const credentials = {
  buyer: {
    email: process.env.E2E_BUYER_EMAIL,
    password: process.env.E2E_BUYER_PASSWORD,
  },
  organizer: {
    email: process.env.E2E_ORGANIZER_EMAIL,
    password: process.env.E2E_ORGANIZER_PASSWORD,
  },
  admin: {
    email: process.env.E2E_ADMIN_EMAIL,
    password: process.env.E2E_ADMIN_PASSWORD,
  },
};

function required(value: string | undefined, name: string) {
  if (!value) throw new Error(`Variável obrigatória ausente: ${name}`);
  return value;
}

async function login(
  page: Page,
  account: { email?: string; password?: string },
  admin = false,
) {
  await page.goto(admin ? "/admin/login" : "/login", {
    waitUntil: "domcontentloaded",
  });
  await page.waitForLoadState("networkidle");
  await page.getByLabel("E-mail").fill(required(account.email, "E2E_*_EMAIL"));
  await page
    .getByLabel("Senha", { exact: true })
    .fill(required(account.password, "E2E_*_PASSWORD"));
  const loginResponsePromise = page.waitForResponse(
    (response) =>
      response.url().includes(
        admin ? "/api/auth/admin-login" : "/api/auth/login",
      ) && response.request().method() === "POST",
  );
  await page
    .getByRole("button", {
      name: admin ? "Entrar no painel" : "Entrar",
      exact: true,
    })
    .click();
  const loginResponse = await loginResponsePromise;
  expect(loginResponse.status(), await loginResponse.text()).toBe(200);
  await expect(page).toHaveURL(
    admin ? /\/admin\/dashboard/ : /\/(comprador|dashboard)/,
    { timeout: 45_000 },
  );
  const session = await page.request.get("/api/auth/me");
  expect(session.status(), await session.text()).toBe(200);
}

async function openHealthy(page: Page, path: string) {
  const response = await page.goto(path, {
    waitUntil: "domcontentloaded",
    timeout: 45_000,
  });
  expect(response?.status(), `${path} não respondeu com sucesso`).toBeLessThan(
    400,
  );
  await expect(page.getByText("Carregando sua conta...")).toHaveCount(0, {
    timeout: 20_000,
  });
  await expect(page.locator("body")).not.toContainText(
    /erro interno|unauthorized|cannot find module|vendor-chunks/i,
  );
}

test("comprador — sessão, navegação, reserva, persistência e logout", async ({
  page,
}) => {
  await login(page, credentials.buyer);
  await openHealthy(page, "/comprador");
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/\/comprador/);

  for (const path of [
    "/comprador/perfil",
    "/comprador/meus-numeros",
    "/comprador/participar",
  ]) {
    await openHealthy(page, path);
  }

  const campaignsResponse = await page.request.get("/api/buyer/campaigns");
  expect(campaignsResponse.status(), await campaignsResponse.text()).toBe(200);
  const campaignsPayload = await campaignsResponse.json();
  const campaigns = Array.isArray(campaignsPayload)
    ? campaignsPayload
    : (campaignsPayload.items ?? campaignsPayload.campaigns ?? []);
  const campaign = campaigns.find(
    (item: {
      id?: string;
      status?: string;
      drawDate?: string | null;
      salesEndAt?: string | null;
    }) =>
      item.id &&
      (!item.status || item.status === "PUBLISHED") &&
      (!item.drawDate || new Date(item.drawDate).getTime() > Date.now()) &&
      (!item.salesEndAt || new Date(item.salesEndAt).getTime() > Date.now()),
  );
  expect(campaign, "Nenhuma campanha publicada disponível").toBeTruthy();

  const quantity = Math.max(
    1,
    Number(campaign.minimumPurchase ?? campaign.minPurchase ?? 100),
  );
  const reservation = await page.request.post("/api/purchases/reserve-random", {
    data: {
      campaignId: campaign.id,
      quantity,
      idempotencyKey: `homologacao-${Date.now()}`,
    },
  });
  expect(reservation.status(), await reservation.text()).toBeLessThan(300);
  const reservationPayload = await reservation.json();
  expect(reservationPayload.id).toBeTruthy();

  await openHealthy(page, "/comprador/meus-numeros");
  await page.request.post("/api/auth/logout");
  await page.goto("/comprador", { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/\/login(?:\?|$)/, { timeout: 30_000 });
  await login(page, credentials.buyer);
  await openHealthy(page, "/comprador/meus-numeros");
});

test("organizador — sessão, módulos, cópia editável e publicação", async ({
  page,
}, testInfo) => {
  await login(page, credentials.organizer);
  await openHealthy(page, "/dashboard");
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/\/dashboard/);

  const modulePaths =
    testInfo.project.name === "desktop"
      ? [
          "/dashboard/campanhas",
          "/dashboard/personalizacao",
          "/dashboard/financeiro",
          "/dashboard/ganhadores",
          "/dashboard/configuracoes",
        ]
      : ["/dashboard/campanhas", "/dashboard/personalizacao"];
  for (const path of modulePaths) await openHealthy(page, path);

  const listResponse = await page.request.get("/api/campaigns/my");
  expect(listResponse.status(), await listResponse.text()).toBe(200);
  const listPayload = await listResponse.json();
  const campaigns = Array.isArray(listPayload)
    ? listPayload
    : (listPayload.items ?? listPayload.campaigns ?? []);
  const source = campaigns.find(
    (item: { id?: string; status?: string }) =>
      item.id && item.status === "PUBLISHED",
  );
  expect(source, "Nenhuma campanha publicada para duplicação segura").toBeTruthy();

  const duplicate = await page.request.post(
    `/api/campaigns/${source.id}/duplicate`,
  );
  expect(duplicate.status(), await duplicate.text()).toBeLessThan(300);
  const created = await duplicate.json();
  expect(created.id).toBeTruthy();
  expect(created.status).toBe("DRAFT");

  const title = `[HOMOLOGAÇÃO] ${source.title} ${Date.now()}`;
  const update = await page.request.patch(`/api/campaigns/${created.id}`, {
    data: { title },
  });
  expect(update.status(), await update.text()).toBeLessThan(300);
  expect((await update.json()).title).toBe(title);

  const publish = await page.request.post(
    `/api/campaigns/${created.id}/publish`,
  );
  expect(publish.status(), await publish.text()).toBeLessThan(300);
  expect((await publish.json()).status).toBe("PUBLISHED");

  const persisted = await page.request.get(`/api/campaigns/${created.id}`);
  expect(persisted.status(), await persisted.text()).toBe(200);
  expect((await persisted.json()).title).toBe(title);

  await page.request.post("/api/auth/logout");
  await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/\/login(?:\?|$)/, { timeout: 30_000 });
  await login(page, credentials.organizer);
  await openHealthy(page, "/dashboard/campanhas");
});

test("admin — sessão, consulta operacional, permissões e auditoria", async ({
  page,
}, testInfo) => {
  await login(page, credentials.admin, true);
  await openHealthy(page, "/admin/dashboard");
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/\/admin\/dashboard/);

  const desktopPaths = [
    "/admin/organizadores",
    "/admin/aprovacoes",
    "/admin/campanhas",
    "/admin/pagamentos",
    "/admin/usuarios",
    "/admin/financeiro",
    "/admin/auditoria",
    "/admin/configuracoes",
    "/admin/afiliados",
    "/admin/crm",
    "/admin/midia",
    "/admin/juridico",
    "/admin/saude",
  ];
  const mobilePaths = [
    "/admin/organizadores",
    "/admin/campanhas",
    "/admin/financeiro",
    "/admin/auditoria",
    "/admin/saude",
  ];
  for (const path of testInfo.project.name === "desktop"
    ? desktopPaths
    : mobilePaths) {
    await openHealthy(page, path);
  }

  const session = await page.request.get("/api/auth/me");
  const adminUser = await session.json();
  expect(adminUser.role).toBe("ADMIN");
  expect(adminUser.adminTeamRole).toBe("SUPERADMIN");

  await page.request.post("/api/auth/logout");
  await page.goto("/admin/dashboard", { waitUntil: "domcontentloaded" });
  await expect(page).toHaveURL(/\/admin\/login(?:\?|$)/, { timeout: 30_000 });
  await login(page, credentials.admin, true);
  await openHealthy(page, "/admin/auditoria");
});
