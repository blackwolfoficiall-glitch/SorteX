import { expect, test } from "@playwright/test";

test("perfil salva dados pessoais e públicos e mantém após atualizar", async ({ page }) => {
  await page.goto("/perfil");
  const city = page.getByLabel("Cidade");
  const state = page.getByLabel("Estado");
  const slogan = page.getByLabel("Slogan");
  const original = {
    city: await city.inputValue(),
    state: await state.inputValue(),
    slogan: await slogan.inputValue(),
  };
  const updatedSlogan = `Homologação SorteX ${Date.now()}`;

  await city.fill("Feira de Santana");
  await state.fill("ba");
  await expect(state).toHaveValue("BA");
  await slogan.fill(updatedSlogan);
  await page.getByRole("button", { name: "Salvar perfil" }).click();
  await expect(page.getByText("Perfil salvo com sucesso.")).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Cidade")).toHaveValue("Feira de Santana");
  await expect(page.getByLabel("Estado")).toHaveValue("BA");
  await expect(page.getByLabel("Slogan")).toHaveValue(updatedSlogan);

  await page.getByLabel("Cidade").fill(original.city);
  await page.getByLabel("Estado").fill(original.state);
  await page.getByLabel("Slogan").fill(original.slogan);
  await page.getByRole("button", { name: "Salvar perfil" }).click();
  await expect(page.getByText("Perfil salvo com sucesso.")).toBeVisible();
});

test("configurações abre cada área existente sem perder navegação", async ({ page }) => {
  const destinations = [
    ["Meu plano", /\/dashboard\/configuracoes\/plano/],
    ["Personalização", /\/dashboard\/personalizacao$/],
    ["Domínio próprio", /\/dashboard\/personalizacao\/dominio/],
    ["Redes sociais e comunidades", /\/dashboard\/personalizacao\/redes-sociais/],
  ] as const;

  for (const [name, url] of destinations) {
    await page.goto("/dashboard/configuracoes");
    await page
      .locator("main, div.mx-auto")
      .getByRole("link", { name: new RegExp(`^${name}`) })
      .last()
      .click();
    await expect(page).toHaveURL(url);
    await page.goBack();
    await expect(page).toHaveURL(/\/dashboard\/configuracoes$/);
  }
});
