import { expect, test, type Page } from "@playwright/test";

test.use({ storageState: { cookies: [], origins: [] } });

const code = "SYN-PROOF-2026";
const proofPath = `/verificar/${code}`;
const apiPath = `**/api/public/winners/verify/${code}`;
const hash = "a".repeat(64);
const source = "https://servicebus2.caixa.gov.br/portaldeloterias/api/federal/5999";
const proof = {
  verificationCode: code,
  status: "PAYMENT_PENDING",
  winningNumber: "00091",
  prizeName: "Prêmio sintético",
  publicDisplayName: "F*** R.",
  publicCity: "Feira de Santana",
  deliveryConfirmed: false,
  privateEmail: "fixture-nondisclosed@example.test",
  campaign: { title: "Campanha sintética", slug: "campanha-sintetica", organizerId: "fixture-nondisclosed-id" },
  organizer: { name: "Equipe sintética", logo: "fixture-internal-storage-key" },
  draw: {
    date: "2026-11-26T21:00:00.000Z",
    auditHash: hash,
    rule: {
      version: 1, outputLength: 1,
      normalization: { mode: "REJECT_OUT_OF_RANGE" },
      steps: [{ order: 1, sourcePrize: 3, digitPosition: "UNIT", direction: "REVERSE", transformation: "COMPLEMENT_9" }],
    },
    result: {
      rawResult: "1",
      normalizedResult: "00091",
      steps: [{ order: 1, selectedDigit: "1" }],
      lottery: { extractionNumber: "5999", sourceUrl: source, sourcePrizes: ["086997", "004852", "000091", "082438", "039210"] },
    },
  },
};

async function validProof(page: Page, body: unknown = proof) {
  await page.route(apiPath, (route) => route.fulfill({ json: body }));
  await page.goto(proofPath);
  await expect(page.getByRole("heading", { name: "Apuração confirmada" })).toBeVisible();
}

test("resume a apuração e permite copiar o código, sem exibir dados fora da prova", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: async (text: string) => { document.documentElement.dataset.copiedProof = text; } },
    });
  });
  await validProof(page);
  await expect(page.getByRole("strong").filter({ hasText: "00091" })).toBeVisible();
  await expect(page.getByText("Pagamento pendente", { exact: true })).toBeVisible();
  await expect(page.getByText(/Não comprova pagamento ou repasse/)).toBeVisible();
  await expect(page.getByText("F*** R.", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: "Campanha sintética" })).toHaveAttribute("href", "/campanha/campanha-sintetica");
  await expect(page.getByLabel("Código público de verificação")).toHaveValue(code);
  await page.getByRole("button", { name: "Copiar código" }).click();
  await expect(page.getByRole("status")).toHaveText("Código copiado.");
  await expect(page.locator("html")).toHaveAttribute("data-copied-proof", code);
  await page.getByText("Detalhes da apuração").click();
  await expect(page.getByText(hash, { exact: true })).toBeVisible();
  await expect(page.getByText("unidade do 3º prêmio, valor invertido, complemento de 9: 1")).toBeVisible();
  await expect(page.getByText(/3º: 000091/)).toBeVisible();
  await expect(page.getByRole("link", { name: /fonte oficial da CAIXA/ })).toHaveAttribute("href", source);
  await expect(page.getByText(/fixture-nondisclosed|fixture-internal-storage-key/)).toHaveCount(0);
  await expect(page.locator("pre")).toHaveCount(0);
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
    await page.evaluate(() => document.documentElement.clientWidth),
  );
});

test("seleciona o código quando a área de transferência está bloqueada", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "clipboard", {
      value: { writeText: async () => { throw new Error("blocked"); } },
    });
  });
  await validProof(page);
  await page.getByRole("button", { name: "Copiar código" }).click();
  const field = page.getByLabel("Código público de verificação");
  await expect(field).toBeFocused();
  expect(await field.evaluate((el: HTMLInputElement) =>
    el.value.slice(el.selectionStart ?? 0, el.selectionEnd ?? 0),
  )).toBe(code);
  await expect(page.getByRole("status")).toHaveText(/Código selecionado/);
});

test("um código desconhecido não mostra confirmação nem código copiável", async ({ page }) => {
  const unknown = "SYN-NOT-FOUND";
  await page.route(`**/api/public/winners/verify/${unknown}`, (route) => route.fulfill({ status: 404, json: {} }));
  await page.goto(`/verificar/${unknown}`);
  await expect(page.getByRole("status")).toHaveText("Não há prova de ganhador válida para este código.");
  await expect(page.getByText(/Apuração confirmada/)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Copiar código" })).toHaveCount(0);
});

test("não reutiliza uma prova após o servidor invalidar a apuração", async ({ page }) => {
  await validProof(page);
  await page.unroute(apiPath);
  await page.route(apiPath, (route) => route.fulfill({ status: 404, json: {} }));
  await page.reload();
  await expect(page.getByRole("status")).toHaveText("Não há prova de ganhador válida para este código.");
  await expect(page.getByText(/Apuração confirmada|Verificação pública/)).toHaveCount(0);
  await expect(page.getByLabel("Código público de verificação")).toHaveCount(0);
});

test("separa recebimento confirmado e não linka uma fonte fora da CAIXA", async ({ page }) => {
  await validProof(page, {
    ...proof, status: "CONFIRMED_BY_WINNER", deliveryConfirmed: true,
    draw: {
      ...proof.draw,
      result: { ...proof.draw.result, lottery: { ...proof.draw.result.lottery, sourceUrl: "https://example.test/5999" } },
    },
  });
  await expect(page.getByText("Recebimento confirmado pelo ganhador")).toBeVisible();
  await expect(page.getByText(/Não comprova pagamento ou repasse/)).toBeVisible();
  await page.getByText("Detalhes da apuração").click();
  await expect(page.getByRole("link", { name: /fonte oficial da CAIXA/ })).toHaveCount(0);
});

for (const [invalid, partialDraw] of [
  ["sem confirmação", { auditHash: hash }],
  ["com data impossível", { auditHash: hash, date: "2026-02-30T21:00:00.000Z" }],
  ["com hash incompleto", { auditHash: "invalid", date: proof.draw.date }],
] as const) {
  test(`resposta ${invalid} não é tratada como apuração confirmada`, async ({ page }) => {
    await page.route(apiPath, (route) => route.fulfill({
      json: { verificationCode: code, winningNumber: "00091", draw: partialDraw },
    }));
    await page.goto(proofPath);
    await expect(page.getByRole("status")).toHaveText(/Não foi possível verificar o resultado agora/);
    await expect(page.getByText(/Apuração confirmada|Verificação pública/)).toHaveCount(0);
  });
}

test("mantém legível uma regra legada de posições numéricas", async ({ page }) => {
  await validProof(page, {
    ...proof,
    draw: { ...proof.draw, rule: { digits: [{ order: 0, prize: 2, position: 3 }] } },
  });
  await page.getByText("Detalhes da apuração").click();
  await expect(page.getByText(/dezena do 2º prêmio/)).toBeVisible();
  await expect(page.getByText("Resto da divisão pelo total de títulos")).toBeVisible();
});
