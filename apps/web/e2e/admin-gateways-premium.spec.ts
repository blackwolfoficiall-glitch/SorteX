import { expect, test, type Page } from '@playwright/test';

const endpoint = '/api/admin/platform/gateways';
const email = process.env.E2E_ADMIN_EMAIL;
const password = process.env.E2E_ADMIN_PASSWORD;

async function login(page: Page) {
  await page.context().clearCookies();
  const reply = await page.request.post('/api/auth/admin-login', { data: { email, password } });
  expect(reply.status()).toBe(200);
}

test('Gateways displays stored capability with no connectivity or provider requests', async ({ page }) => {
  test.skip(!email || !password, 'Requer a conta administrativa de teste.');
  await login(page);
  const methods: string[] = [];
  const external: string[] = [];
  page.on('request', (request) => {
    if (new URL(request.url()).origin !== new URL(page.url()).origin && page.url().startsWith('http')) external.push(new URL(request.url()).origin);
  });
  await page.route('**/api/admin/platform/gateways', async (route) => {
    const method = route.request().method();
    methods.push(method);
    if (method !== 'GET') return route.abort();
    await route.continue();
  });
  const initial = page.waitForResponse((reply) => new URL(reply.url()).pathname === endpoint);
  await page.goto('/admin/gateways');
  const view = page.locator('.sx-admin-gateways');
  await expect(view.getByRole('heading', { name: 'Gateways', exact: true })).toBeVisible();
  const reply = await initial;
  expect(reply.status()).toBe(200);
  const payload = await reply.json();
  const gateways = Array.isArray(payload) ? payload : payload.data;
  const rows = view.getByRole('listitem');
  await expect(rows).toHaveCount(gateways.length);
  await expect(view.getByRole('button', { name: 'Configurar gateway' })).toBeVisible();
  if (gateways.length) {
    const record = gateways[0];
    const first = rows.first();
    expect((await first.getByRole('heading').textContent()) === record.displayName).toBe(true);
    const metric = (label: string) => first.getByText(label, { exact: true }).locator('..').locator('dd');
    await expect(metric('Sandbox')).toHaveText(record.sandboxEnabled ? 'Habilitado no cadastro' : 'Desabilitado no cadastro');
    await expect(metric('Produção')).toHaveText(record.productionEnabled ? 'Habilitado no cadastro' : 'Desabilitado no cadastro');
    await expect(metric('Split')).toHaveText(record.splitAvailable ? 'Habilitado no cadastro' : 'Desabilitado no cadastro');
    await expect(metric('Cobrança de planos')).toHaveText(record.planBillingAvailable ? 'Habilitado no cadastro' : 'Desabilitado no cadastro');
    await expect(metric('Taxa estimada no cadastro')).toHaveText(`${Number(record.estimatedFeeRate).toLocaleString('pt-BR', { maximumFractionDigits: 3 })}%`);
  }
  await expect(view.getByText(/não testa conexão nem confirma transações/)).toBeVisible();
  await expect(view.getByText('diagnostico-qa-sem-dados')).toHaveCount(0);
  const search = view.getByRole('searchbox', { name: 'Pesquisar gateway' });
  await search.fill('diagnostico-qa-sem-dados');
  await expect(view.getByRole('status')).toHaveText('0 gateways na pesquisa');
  await expect(view.getByText('Nenhum gateway encontrado para a pesquisa.')).toBeVisible();
  expect(methods).toEqual(['GET']);
  await search.fill('');
  await expect(view.getByRole('status')).toContainText('no catálogo');
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(view).toHaveCSS('color-scheme', 'dark');
  await search.focus();
  await page.keyboard.press('Tab');
  await expect(view.getByRole('button', { name: 'Atualizar', exact: true })).toBeFocused();
  await expect(view.getByRole('button', { name: 'Atualizar', exact: true })).toHaveCSS('outline-style', 'solid');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  await expect(view.getByRole('button', { name: 'Salvar', exact: true })).toHaveCount(0);
  expect(external.length).toBe(0);
});

test('catalog failure stays separate from empty results and returns to actual data', async ({ page }) => {
  test.skip(!email || !password, 'Requer a conta administrativa de teste.');
  await login(page);
  await page.route('**/api/admin/platform/gateways', async (route) => {
    await new Promise<void>((resolve) => setTimeout(resolve, 1000));
    await route.fulfill({ status: 503, json: {} });
  }, { times: 1 });
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
  await page.goto('/admin/gateways');
  const view = page.locator('.sx-admin-gateways');
  await expect(view).toHaveCSS('color-scheme', 'light');
  await expect(view.getByRole('status')).toHaveText('Carregando gateways…');
  await expect(view.locator('.sx-ap-spinner')).toHaveCSS('animation-name', 'none');
  await expect(view.getByRole('alert')).toHaveText('Não foi possível consultar os gateways.');
  await expect(view.getByText('Nenhum gateway encontrado.')).toHaveCount(0);
  await view.getByRole('button', { name: 'Tentar novamente' }).click();
  await expect(view.getByRole('status')).toContainText('no catálogo');
});
