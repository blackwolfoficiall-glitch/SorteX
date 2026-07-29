import { expect, test } from "@playwright/test";

test("lead carrega, filtra, abre, edita, cria tarefa e inicia comunicação", async ({ page }) => {
  test.setTimeout(60_000);
  const listResponse = await page.request.get("/api/crm/contacts?limit=20");
  expect(listResponse.ok()).toBeTruthy();
  const list = (await listResponse.json()) as { items: Array<{ id: string; name: string }> };
  expect(list.items.length).toBeGreaterThan(0);
  const lead = list.items[0];
  const statusResponse = await page.request.patch(`/api/crm/contacts/${lead.id}/status`, {
    data: { status: "LEAD" },
  });
  expect(statusResponse.ok()).toBeTruthy();

  await page.goto("/dashboard/crm/contatos?status=LEAD");
  await page.getByPlaceholder("Nome, telefone ou e-mail").fill(lead.name);
  await expect(page.getByRole("link", { name: lead.name })).toBeVisible();
  await page.getByRole("link", { name: lead.name }).click();
  await expect(page.getByRole("heading", { name: lead.name })).toBeVisible();

  const note = `Nota de homologação ${Date.now()}`;
  await page.getByPlaceholder("Adicionar nota").fill(note);
  await page.getByRole("button", { name: "Adicionar nota" }).click();
  await expect(page.getByText("Nota adicionada.")).toBeVisible();
  await expect(page.getByText(note)).toBeVisible();

  const task = `Tarefa de homologação ${Date.now()}`;
  await page.getByPlaceholder("Nova tarefa").fill(task);
  await page.getByRole("button", { name: "Criar", exact: true }).click();
  await expect(page.getByText("Tarefa criada.")).toBeVisible();
  const tasksResponse = await page.request.get("/api/crm/tasks");
  expect(tasksResponse.ok()).toBeTruthy();
  const tasks = (await tasksResponse.json()) as Array<{ title: string; contactId?: string }>;
  expect(tasks.some((item) => item.title === task)).toBeTruthy();

  await page.getByRole("button", { name: "Marcar como VIP" }).click();
  await expect.poll(async () => {
    const response = await page.request.get(`/api/crm/contacts/${lead.id}`);
    return ((await response.json()) as { status: string }).status;
  }).toBe("VIP");
  await page.request.patch(`/api/crm/contacts/${lead.id}/status`, { data: { status: "LEAD" } });

  await page.reload();
  await expect(page.getByText(note)).toBeVisible();
  await page.getByRole("link", { name: "Abrir comunicação" }).click();
  await expect(page).toHaveURL(new RegExp(`/dashboard/comunicacao\\?contactId=${lead.id}`));
  await expect(page.getByRole("heading", { name: "Comunicação inteligente" })).toBeVisible();
});
