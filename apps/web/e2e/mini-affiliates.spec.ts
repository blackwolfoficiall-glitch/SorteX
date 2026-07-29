import { expect, test } from "@playwright/test";

test("mini campanha cria, edita, publica e abre a página persistida", async ({ page }) => {
  const planResponse = await page.request.post("/api/plans/select", {
    data: { planId: "plan_avancado", billingCycle: "MONTHLY" },
  });
  expect(planResponse.ok()).toBeTruthy();
  await page.goto("/dashboard/personalizacao?onboarding=1");
  await page.getByRole("button", { name: "Pular por agora" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  const suffix = Date.now().toString().slice(-7);
  const originalName = `Mini Homologação ${suffix}`;
  const editedName = `${originalName} Editada`;

  await page.goto("/dashboard/mini-campanhas");
  await expect(page.getByRole("button", { name: "Criar Mini Campanha" })).toBeEnabled();
  await page.getByRole("button", { name: "Criar Mini Campanha" }).click();
  await page.getByLabel("Nome").fill(originalName);
  await page.getByRole("textbox", { name: "Prêmio", exact: true }).fill("20 títulos de homologação");
  await page.getByLabel("Quantidade máxima de títulos").fill("120");
  await page.getByLabel("Preço por título").fill("1.50");
  await page.getByLabel("Limite por comprador").fill("12");
  await page.getByLabel("Regra").fill("Regra exclusiva para o teste isolado de homologação.");
  await page.getByRole("button", { name: "Salvar Mini Campanha" }).click();
  const createdCard = page.locator("article").filter({ has: page.getByRole("heading", { name: originalName }) });
  await expect(createdCard).toBeVisible();

  await createdCard.getByRole("button", { name: "Editar" }).click();
  await page.getByLabel("Nome").fill(editedName);
  await page.getByRole("button", { name: "Salvar Mini Campanha" }).click();
  await expect(page.getByRole("heading", { name: editedName })).toBeVisible();

  await page.reload();
  const persistedCard = page.locator("article").filter({ has: page.getByRole("heading", { name: editedName }) });
  await expect(persistedCard).toBeVisible();
  await persistedCard.getByRole("button", { name: "Publicar" }).click();
  await expect(persistedCard.getByText("Publicada")).toBeVisible();

  await persistedCard.getByRole("link", { name: /Link/ }).click();
  await expect(page).toHaveURL(/\/mini-campanhas\//);
  await expect(page.getByRole("heading", { name: editedName })).toBeVisible();
});

test("afiliados persiste comissão, estados e respeita Não cancelar", async ({ page, context }) => {
  test.setTimeout(60_000);
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  const suffix = Date.now().toString().slice(-7);
  const inviteName = `Afiliado Homologação ${suffix}`;
  const inviteEmail = `afiliado.${suffix}@example.invalid`;
  const openSection = async (name: "Programas" | "Convites") => {
    const mobileSelect = page.getByLabel("Seção de afiliados");
    if ((page.viewportSize()?.width ?? 1280) < 768) {
      await expect(mobileSelect).toBeVisible();
      await mobileSelect.selectOption({ label: name });
    } else await page.getByRole("button", { name, exact: true }).click();
  };

  await page.goto("/dashboard/afiliados");
  await openSection("Programas");
  const programCard = page.locator("article").filter({ has: page.getByRole("heading", { name: "Programa Teste" }) });
  await programCard.getByRole("button", { name: "Editar" }).click();
  await page.getByRole("spinbutton", { name: "Valor", exact: true }).fill("17");
  await page.getByRole("button", { name: "Salvar alterações" }).click();
  await expect(page.getByText("Programa atualizado com sucesso.")).toBeVisible();
  await expect(programCard.getByText("17% por venda")).toBeVisible();

  const toggle = programCard.getByRole("button", { name: /Ativar|Pausar/ });
  const initialAction = await toggle.innerText();
  await toggle.click();
  await expect(programCard.getByRole("button", { name: initialAction === "Ativar" ? "Pausar" : "Ativar" })).toBeVisible();
  await programCard.getByRole("button", { name: initialAction === "Ativar" ? "Pausar" : "Ativar" }).click();
  await expect(programCard.getByRole("button", { name: initialAction })).toBeVisible();

  await openSection("Convites");
  await page.getByLabel("Nome").fill(inviteName);
  await page.getByLabel("E-mail").fill(inviteEmail);
  await page.getByLabel("WhatsApp").fill("71999990000");
  await page.getByRole("button", { name: "Gerar convite" }).click();
  await expect(page.getByText("Convite criado. Nenhuma mensagem externa foi enviada.")).toBeVisible();
  await page.getByRole("button", { name: "Copiar link" }).first().click();
  await expect(page.getByText("Link copiado com sucesso.")).toBeVisible();

  const inviteRow = page.locator("article").filter({ has: page.getByRole("heading", { name: inviteName }) });
  page.once("dialog", (dialog) => dialog.dismiss());
  await inviteRow.getByRole("button", { name: "Cancelar" }).click();
  await expect(inviteRow).toBeVisible();

  page.once("dialog", (dialog) => dialog.accept());
  await inviteRow.getByRole("button", { name: "Cancelar" }).click();
  await expect(inviteRow.getByText("Cancelado")).toBeVisible();
  await page.reload();
  await openSection("Convites");
  await expect(page.locator("article").filter({ has: page.getByRole("heading", { name: inviteName }) }).getByText("Cancelado")).toBeVisible();
});
