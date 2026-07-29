import { expect, test } from "@playwright/test";

const modules = [
  ["Campanhas", "/dashboard/campanhas"],
  ["Ganhadores", "/dashboard/campanhas/ganhadores"],
  ["Pedidos", "/dashboard/pedidos"],
  ["Promoções", "/dashboard/promocoes"],
  ["Cotas premiadas", "/dashboard/ganhadores"],
  ["CRM", "/dashboard/crm"],
  ["Comunicação", "/dashboard/comunicacao"],
  ["Afiliados", "/dashboard/afiliados"],
  ["IA SorteX", "/dashboard/ia"],
  ["Integrações", "/dashboard/integracoes"],
  ["Configurações", "/dashboard/configuracoes"],
  ["Perfil", "/perfil"],
] as const;

test("jornada principal do organizador carrega todos os módulos sem erro técnico", async ({ page }) => {
  for (const [name, route] of modules) {
    await test.step(name, async () => {
      const response = await page.goto(route);
      expect(response?.status(), `${name} respondeu HTTP inesperado`).toBeLessThan(400);
      await expect(page).toHaveURL(new RegExp(route.replace("?", "\\?")));
      await expect(page.locator("body")).not.toContainText("Unauthorized");
      await expect(page.locator("body")).not.toContainText("Internal Server Error");
      await expect(page.locator("body")).not.toContainText("Application error");
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      );
      expect(overflow, `${name} possui overflow horizontal`).toBe(false);
    });
  }
});

test("CRM e Comunicação preservam abas e contexto pela URL", async ({ page }) => {
  for (const tab of ["overview", "contacts", "segments", "automations", "abandoned", "tasks"]) {
    await page.goto(`/dashboard/crm?tab=${tab}`);
    await expect(page).toHaveURL(new RegExp(`tab=${tab}`));
    await expect(page.locator("body")).not.toContainText("Unauthorized");
  }

  for (const tab of ["overview", "new", "templates", "schedules", "history", "metrics"]) {
    await page.goto(`/dashboard/comunicacao?tab=${tab}`);
    await expect(page).toHaveURL(new RegExp(`tab=${tab}`));
    await expect(page.locator("body")).not.toContainText("Unauthorized");
  }
});

test("atalhos operacionais do dashboard abrem o fluxo correto", async ({ page }) => {
  await page.goto("/dashboard");
  const expected = [
    ["Recuperar clientes", /crm\/contatos\?status=INACTIVE/],
    ["Falar com VIPs", /comunicacao\?tab=new&audience=VIP/],
    ["Boas-vindas", /crm\/automacoes\?template=welcome/],
    ["Impulsionar", /ads\?action=create&campaignId=/],
  ] as const;

  for (const [name, url] of expected) {
    await page.goto("/dashboard");
    const shortcut = page.getByRole("link", { name, exact: true });
    await expect(shortcut).toBeVisible();
    await shortcut.click();
    await expect(page).toHaveURL(url);
  }
});
