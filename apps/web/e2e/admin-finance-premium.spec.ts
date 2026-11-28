import { expect, test, type Page } from '@playwright/test';

const endpoint = '/api/admin/finance/';
const email = process.env.E2E_ADMIN_EMAIL;
const password = process.env.E2E_ADMIN_PASSWORD;
const format = (value: number) => Number(value).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const realSummary = (reply: { url: () => string }) => new URL(reply.url()).pathname === `${endpoint}overview`;

async function login(page: Page) {
  await page.context().clearCookies();
  const reply = await page.request.post('/api/auth/admin-login', { data: { email, password } });
  expect(reply.status()).toBe(200);
}

test('finance overview presents actual internal totals without asserting settlement', async ({ page }) => {
  test.skip(!email || !password, 'Requer a conta administrativa de teste.');
  await login(page);
  const methods: string[] = [];
  await page.route('**/api/admin/finance/**', async (route) => {
    const method = route.request().method();
    methods.push(method);
    if (method !== 'GET') return route.abort();
    await route.continue();
  });
  const overview = page.waitForResponse(realSummary);
  await page.goto('/admin/financeiro');
  const view = page.locator('.sx-admin-finance');
  await expect(view.getByRole('heading', { name: 'Controle financeiro' })).toBeVisible();
  const reply = await overview;
  expect(reply.status()).toBe(200);
  const summary = await reply.json();
  const kpi = (label: string) => view.getByText(label, { exact: true }).locator('..').locator('dd');
  if (summary.platform?.lifetimeNetRevenue != null) {
    await expect(kpi('Receita líquida acumulada da SorteX')).toContainText(Number(summary.platform.lifetimeNetRevenue).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
  } else await expect(kpi('Receita líquida acumulada da SorteX')).toContainText('Não informado');
  if (summary.organizers?.availableBalance != null) {
    const balance = kpi('Saldo interno disponível dos organizadores');
    await expect(balance).toContainText(format(summary.organizers.availableBalance));
    await expect(balance).not.toContainText('R$');
  }
  await expect(kpi('Solicitações de repasse pendentes')).toContainText(String(summary.pendingPayouts));
  await expect(view.getByText(/não comprovam repasse ou saque/)).toBeVisible();
  await expect(view.getByText(/nem convertidos por moeda/)).toBeVisible();
  const safeTabs = ['Livro financeiro', 'Contas', 'Ajustes', 'Assinaturas e planos', 'Conciliação'] as const;
  const tabPaths = ['ledger', 'accounts', 'adjustments', 'subscriptions', 'reconciliation'] as const;
  for (const [index, label] of safeTabs.entries()) {
    const next = view.getByRole('tab', { name: label, exact: true });
    const response = page.waitForResponse((r) => new URL(r.url()).pathname === endpoint + tabPaths[index]);
    await next.click();
    const result = await response;
    expect(result.status()).toBe(200);
    await expect(next).toHaveAttribute('aria-selected', 'true');
    if (label === 'Conciliação') {
      const data = await result.json();
      await expect(kpi('Pagamentos aprovados')).toHaveText(format(data.paymentTotal));
      await expect(kpi('Lançamentos brutos concluídos')).toHaveText(format(data.ledgerTotal));
      await expect(kpi('Diferença interna')).toHaveText(format(data.difference));
      await expect(view.getByText(/Não confirma liquidação no provedor/)).toBeVisible();
    }
  }
  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  await expect(view).toHaveCSS('color-scheme', 'dark');
  await view.getByRole('tab', { name: 'Ajustes', exact: true }).focus();
  await page.keyboard.press('Tab');
  const next = view.getByRole('tab', { name: 'Assinaturas e planos', exact: true });
  await expect(next).toBeFocused();
  await expect(next).toHaveCSS('outline-style', 'solid');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  expect(methods.length).toBeGreaterThanOrEqual(12);
  expect(methods.every((method) => method === 'GET')).toBe(true);
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('overview failure never shows financial zeros as real and retry restores data', async ({ page }) => {
  test.skip(!email || !password, 'Requer a conta administrativa de teste.');
  await login(page);
  await page.route('**/api/admin/finance/overview', async (route) => {
    await new Promise<void>((resolve) => setTimeout(resolve, 1000));
    await route.fulfill({ status: 503, json: {} });
  }, { times: 1 });
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
  await page.goto('/admin/financeiro');
  const view = page.locator('.sx-admin-finance');
  await expect(view).toHaveCSS('color-scheme', 'light');
  await expect(view.getByText('Carregando indicadores financeiros…')).toBeVisible();
  await expect(view.locator('.sx-af-spinner')).toHaveCSS('animation-name', 'none');
  await expect(view.getByRole('alert')).toBeVisible();
  await expect(view.getByText('Resumo financeiro indisponível.')).toBeVisible();
  await expect(view.locator('.sx-af-kpi')).toHaveCount(0);
  await expect(view.getByText('Nenhum registro encontrado para os filtros informados.')).toHaveCount(0);
  await view.getByRole('button', { name: 'Tentar novamente' }).click();
  await expect(view.getByText('Receita líquida acumulada da SorteX')).toBeVisible();
});
