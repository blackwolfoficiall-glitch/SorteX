import { expect, test } from "@playwright/test";

test("SorteX Ads separates paid orders from unverified media data on mobile web", async ({
  page,
  context,
  baseURL,
}) => {
  const password = process.env.TEST_SEED_PASSWORD;
  if (
    process.env.SORTEX_ADS_LOCAL !== "1" ||
    !password ||
    !baseURL ||
    !/^http:\/\/127\.0\.0\.1:\d+$/.test(baseURL)
  ) {
    throw new Error("Este cenário só aceita o seed sintético em loopback.");
  }
  await page.setViewportSize({ width: 390, height: 844 });

  const path = "/api/platform/sortex-ads/confirmed-sales";
  const anonymous = await page.request.get(path);
  expect(anonymous.status()).toBe(401);
  expect(anonymous.headers()["cache-control"]).toBe("private, no-store");

  const login = await context.request.post("/api/auth/login", {
    data: { email: "organizer1@sortex.example.invalid", password },
  });
  expect(login.ok()).toBe(true);
  await page.goto("/dashboard/ads");
  const report = page.getByRole("region", { name: "Vendas confirmadas" });
  await expect(report.getByText("Valor bruto dos pedidos pagos")).toBeVisible();
  await expect(report.getByText(/R\$\s0,20/).first()).toBeVisible();
  const originSummary = report.getByRole("complementary", {
    name: "Resumo das origens internas",
  });
  await expect(
    originSummary.getByText(/Nenhuma origem verificada neste recorte/),
  ).toBeVisible();
  await expect(
    originSummary.getByText("Esses números não medem eficiência de mídia."),
  ).toBeVisible();

  await expect(
    report.getByRole("term").filter({ hasText: /^Origem não identificada$/ }),
  ).toBeVisible();
  await expect(
    report.getByRole("heading", { name: "Desempenho de mídia indisponível" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "IA SorteX analisa" }),
  ).toHaveCount(0);
  await expect(page.getByRole("heading", { name: "Conexões" })).toBeVisible();
  await expect(
    report.getByRole("figure", { name: "Gráfico diário de pedidos pagos" }),
  ).toBeVisible();
  await expect(
    report.getByText("100% dos pedidos", { exact: true }),
  ).toBeVisible();
  await expect(
    report
      .getByRole("list", { name: "Leitura de plataformas publicitárias" })
      .getByRole("listitem"),
  ).toHaveCount(3);
  const origins = report.getByRole("combobox", { name: "Origem dos pedidos" });
  await expect(origins).toBeEnabled();
  await origins.selectOption("UNKNOWN");
  await report.getByRole("button", { name: "Aplicar filtros" }).click();
  await expect(
    report.getByText(/Período aplicado: .*Origem não identificada/),
  ).toBeVisible();
  await expect(
    originSummary.getByText(/Origem selecionada: Origem não identificada/),
  ).toBeVisible();
  await expect(
    originSummary.getByText(/Este recorte não compara origens/),
  ).toBeVisible();

  await expect(
    report.getByRole("term").filter({ hasText: /^Afiliados verificados$/ }),
  ).not.toBeVisible();
  await expect(report.getByText(/R\$\s0,20/).first()).toBeVisible();
  await origins.selectOption("AFFILIATE");
  await report.getByRole("button", { name: "Aplicar filtros" }).click();
  await expect(
    report.getByText(/Período aplicado: .*Afiliados verificados/),
  ).toBeVisible();
  await expect(
    report.getByText("Nenhum pedido pago no período selecionado."),
  ).toBeVisible();
  await origins.selectOption("ALL");

  await report
    .getByRole("combobox", { name: "Período", exact: true })
    .selectOption("YESTERDAY");
  const [response] = await Promise.all([
    page.waitForResponse((response) => {
      const url = new URL(response.url());
      return (
        url.pathname === path && url.searchParams.get("period") === "YESTERDAY"
      );
    }),
    report.getByRole("button", { name: "Aplicar filtros" }).click(),
  ]);
  expect(response.status()).toBe(200);
  expect(response.headers()["cache-control"]).toBe("private, no-store");
  await expect(
    report.getByText("Nenhum pedido pago no período selecionado."),
  ).toBeVisible();
  await expect(report.getByText(/R\$\s0,20/)).toHaveCount(0);
  await expect(
    originSummary.getByText(
      "Não há pedidos para comparar origens neste recorte.",
    ),
  ).toBeVisible();

  expect(
    await page.evaluate(() => document.documentElement.scrollWidth),
  ).toBeLessThanOrEqual(390);
});
