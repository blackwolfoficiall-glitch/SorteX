import { expect, test } from "@playwright/test";
import sharp from "sharp";

test("personalização renderiza a campanha real e persiste aparência e imagem", async ({
  page,
}) => {
  test.setTimeout(60_000);
  await page.goto("/dashboard/personalizacao");
  await expect(page.getByRole("heading", { name: "Personalização" })).toBeVisible();
  const openSection = async (name: "Identidade" | "Aparência" | "Pré-visualização") => {
    const mobileSelect = page.getByLabel("Seção de personalização");
    if ((page.viewportSize()?.width ?? 1280) < 768) {
      await expect(mobileSelect).toBeVisible();
      await mobileSelect.selectOption({ label: name });
    } else await page.getByRole("button", { name, exact: true }).click();
  };
  await openSection("Pré-visualização");
  const previewRegion = page
    .getByRole("region", { name: "Pré-visualização em tempo real" })
    .filter({ visible: true })
    .first();

  const campaign = previewRegion.getByLabel("Campanha da prévia");
  await expect(campaign).not.toHaveValue("");

  const preview = previewRegion.locator('iframe[title^="Prévia da campanha"]');
  await expect(preview).toBeVisible();
  await expect(
    page.getByText("Carregando pré-visualização…").filter({ visible: true }),
  ).toHaveCount(0, { timeout: 15_000 });
  await expect(preview.contentFrame().locator("body")).not.toBeEmpty();

  for (const device of ["Tablet", "Desktop", "Celular"] as const) {
    await previewRegion.getByRole("button", { name: device, exact: true }).click();
    await expect(previewRegion.getByRole("button", { name: device, exact: true })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  }

  const popupPromise = page.waitForEvent("popup");
  await previewRegion.getByRole("button", { name: "Abrir prévia completa" }).click();
  const popup = await popupPromise;
  await popup.waitForLoadState("domcontentloaded");
  await expect(popup.getByText("Modo de pré-visualização — alterações não publicadas.")).toBeVisible();
  await popup.close();

  await openSection("Aparência");
  const primaryColor = page.locator("label").filter({ hasText: /^Cor principal/ }).locator('input[type="color"]');
  const previousColor = await primaryColor.inputValue();
  const persistedColor = previousColor.toLowerCase() === "#123456" ? "#234567" : "#123456";
  await primaryColor.fill(persistedColor);
  await expect(page.getByText("Alterações não salvas")).toBeVisible();
  await page.getByRole("button", { name: "Salvar alterações" }).click();
  await expect(page.getByText("Personalização salva com sucesso.")).toBeVisible();

  await page.reload();
  await openSection("Aparência");
  await expect(page.locator("label").filter({ hasText: /^Cor principal/ }).locator('input[type="color"]')).toHaveValue(persistedColor);

  await openSection("Identidade");
  const centerPosition = page.getByRole("radio", { name: "Centro" });
  await page.getByText("Centro", { exact: true }).click();
  await expect(centerPosition).toBeChecked();
  await expect(page.getByTestId("logo-position-preview")).toHaveClass(/justify-center/);
  const testPng = await sharp({
    create: {
      width: 80,
      height: 40,
      channels: 4,
      background: { r: 109, g: 40, b: 217, alpha: 1 },
    },
  }).png().toBuffer();
  await page.getByLabel("Selecionar Logo").setInputFiles({
    name: "logo-homologacao.png",
    mimeType: "image/png",
    buffer: testPng,
  });
  await expect(page.getByText("Pronta para salvar").first()).toBeVisible();
  await expect(page.getByAltText("Prévia de Logo")).toHaveAttribute("src", /^blob:/);
  const logoSize = page.getByRole("slider", { name: "Tamanho da logo" });
  await expect(logoSize).toBeEnabled();
  await logoSize.fill("140");
  await expect(logoSize).toHaveValue("140");
  await expect(page.getByTestId("logo-position-preview")).toHaveAttribute(
    "data-logo-size",
    "140",
  );
  await page.getByRole("button", { name: "Restaurar tamanho padrão" }).click();
  await expect(logoSize).toHaveValue("100");
  await logoSize.fill("140");
  await page.getByRole("button", { name: "Salvar alterações" }).click();
  await expect(page.getByText("Personalização salva com sucesso.")).toBeVisible();

  await page.reload();
  await openSection("Identidade");
  await expect(page.getByRole("radio", { name: "Centro" })).toBeChecked();
  await expect(page.getByTestId("logo-position-preview")).toHaveClass(/justify-center/);
  await expect(
    page.getByRole("slider", { name: "Tamanho da logo" }),
  ).toHaveValue("140");
  const persistedLogo = page.getByAltText("Prévia de Logo");
  await expect(persistedLogo).toBeVisible();
  await expect(persistedLogo).toHaveAttribute("src", /\/api\/brand-assets\/.+\/logo/);
  await expect(page.getByText("Salva", { exact: true }).first()).toBeVisible();

  await page.getByRole("button", { name: "Remover imagem" }).first().click();
  await page.getByRole("button", { name: "Salvar alterações" }).click();
  await expect(page.getByText("Personalização salva com sucesso.")).toBeVisible();
  await page.reload();
  await openSection("Identidade");
  await expect(page.getByAltText("Prévia de Logo")).toHaveCount(0);
  await expect(
    page.getByRole("slider", { name: "Tamanho da logo" }),
  ).toBeDisabled();
  await expect(
    page.getByText("Adicione uma logo para ajustar o tamanho."),
  ).toBeVisible();

  await openSection("Aparência");
  const colorAfterReload = page.locator("label").filter({ hasText: /^Cor principal/ }).locator('input[type="color"]');
  await colorAfterReload.fill("#654321");
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Descartar alterações" }).click();
  await expect(colorAfterReload).toHaveValue(persistedColor);

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Restaurar padrão" }).click();
  await expect(colorAfterReload).toHaveValue("#6d28d9");
  await expect(page.getByText("Padrão aplicado à prévia.")).toBeVisible();
  page.once("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Descartar alterações" }).click();
  await expect(colorAfterReload).toHaveValue(persistedColor);
});
