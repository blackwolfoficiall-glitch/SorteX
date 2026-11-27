import { expect, test, type Page } from '@playwright/test';

const endpoint = '/api/admin/platform/plans';
const email = process.env.E2E_ADMIN_EMAIL;
const password = process.env.E2E_ADMIN_PASSWORD;

async function login(page: Page) {
  await page.context().clearCookies();
  const reply = await page.request.post('/api/auth/admin-login', { data: { email, password } });
  expect(reply.status()).toBe(200);
}

test('Planos displays real plan configuration without making billing or setup requests', async ({ page }) => {
  test.skip(!email || !password, 'Requer a conta administrativa de teste.');
  await login(page);
  const methods: string[] = [];
  await page.route('**/api/admin/platform/plans', async (route) => {
    const method = route.request().method();
    methods.push(method);
    if (method !== 'GET') return route.abort();
    await route.continue();
  });
  const initial = page.waitForResponse((reply) => new URL(reply.url()).pathname === endpoint);
  await page.goto('/admin/planos');
  const view = page.locator('.sx-admin-plans');
  await expect(view.getByRole('heading', { name: 'Planos', exact: true })).toBeVisible();
  const reply = await initial;
  expect(reply.status()).toBe(200);
  const payload = await reply.json();
  const plans = Array.isArray(payload) ? payload : payload.data;
  const rows = view.getByRole('listitem');
  await expect(rows).toHaveCount(plans.length);
  await expect(view.getByRole('button', { name: 'Novo plano' })).toBeVisible();
  if (plans.length) {
    const plan = plans[0];
    const first = rows.first();
    expect((await first.getByRole('heading').textContent()) === plan.name).toBe(true);
    const metric = (label: string) => first.getByText(label, { exact: true }).locator('..').locator('dd');
    await expect(metric('Valor mensal')).toHaveText(Number(plan.monthlyPrice).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
    await expect(metric('Valor anual')).toHaveText(plan.annualPrice == null ? 'Não informado' : Number(plan.annualPrice).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }));
    await expect(metric('Taxa padrão SorteX')).toHaveText(`${Number(plan.platformFeeRate).toLocaleString('pt-BR', { maximumFractionDigits: 3 })}%`);
    await expect(first.getByText(plan.isActive ? 'Ativo' : 'Inativo', { exact: true })).toBeVisible();
  }
  await expect(view.getByText('Valores de referência do plano.', { exact: false })).toBeVisible();
  const search = view.getByRole('searchbox', { name: 'Pesquisar plano' });
  await search.fill('sem-plano-na-consulta-45a668');
  await expect(view.getByRole('status')).toHaveText('0 planos na pesquisa');
  await expect(view.getByText('Nenhum plano encontrado para a pesquisa.')).toBeVisible();
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
});

test('catalog failure stays separate from empty results and returns to actual data', async ({ page }) => {
  test.skip(!email || !password, 'Requer a conta administrativa de teste.');
  await login(page);
  await page.route('**/api/admin/platform/plans', async (route) => {
    await new Promise<void>((resolve) => setTimeout(resolve, 1000));
    await route.fulfill({ status: 503, json: {} });
  }, { times: 1 });
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
  await page.goto('/admin/planos');
  const view = page.locator('.sx-admin-plans');
  await expect(view).toHaveCSS('color-scheme', 'light');
  await expect(view.getByRole('status')).toHaveText('Carregando planos…');
  await expect(view.locator('.sx-ap-spinner')).toHaveCSS('animation-name', 'none');
  await expect(view.getByRole('alert')).toHaveText('Não foi possível consultar os planos.');
  await expect(view.getByText('Nenhum plano encontrado.')).toHaveCount(0);
  await view.getByRole('button', { name: 'Tentar novamente' }).click();
  await expect(view.getByRole('status')).toContainText('no catálogo');
});
