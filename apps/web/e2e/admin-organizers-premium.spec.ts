import { expect, test, type Page } from '@playwright/test';

const endpoint = '/api/admin/platform/organizers';
const email = process.env.E2E_ADMIN_EMAIL;
const password = process.env.E2E_ADMIN_PASSWORD;

async function login(page: Page) {
  await page.context().clearCookies();
  const reply = await page.request.post('/api/auth/admin-login', { data: { email, password } });
  expect(reply.status()).toBe(200);
}

test('administrator reads organizer profiles and applies filters without changing records', async ({ page }) => {
  test.skip(!email || !password, 'Requer a conta administrativa de teste.');
  await login(page);
  const methods: string[] = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === endpoint) methods.push(request.method());
  });
  const response = page.waitForResponse((reply) => new URL(reply.url()).pathname === endpoint);
  await page.goto('/admin/organizadores');
  const view = page.locator('.sx-admin-organizers');
  await expect(view.getByRole('heading', { name: 'Central de organizadores' })).toBeVisible();
  const reply = await response;
  expect(reply.status()).toBe(200);
  const result = await reply.json();
  const cards = view.getByRole('list').getByRole('listitem');
  await expect(cards).toHaveCount(result.data.length);
  if (result.data.length) {
    expect((await cards.first().getByRole('link').getAttribute('href')) === `/admin/organizadores/${result.data[0].userId}`).toBe(true);
  }
  await expect(view.getByRole('status')).toHaveText(new RegExp(`^${Number(result.pagination.total).toLocaleString('pt-BR')}`));

  const search = view.getByRole('searchbox', { name: 'Pesquisar organizadores' });
  await search.fill('sem-resultado-sintetico-a737c1');
  await view.getByRole('combobox', { name: 'Status', exact: true }).selectOption('VERIFIED');
  await view.getByRole('combobox', { name: 'Plano', exact: true }).selectOption('BASIC');
  await view.getByRole('combobox', { name: 'Risco', exact: true }).selectOption('LOW');
  expect(methods).toEqual(['GET']);
  const filtered = page.waitForResponse((item) => {
    const url = new URL(item.url());
    return url.pathname === endpoint && url.searchParams.get('search') === 'sem-resultado-sintetico-a737c1' &&
      url.searchParams.get('status') === 'VERIFIED' && url.searchParams.get('plan') === 'BASIC' &&
      url.searchParams.get('riskLevel') === 'LOW' && url.searchParams.get('page') === '1';
  });
  await search.press('Enter');
  expect((await filtered).status()).toBe(200);
  await expect(view.getByRole('heading', { name: 'Nenhum organizador encontrado' })).toBeVisible();
  await expect(view.getByRole('status')).toHaveText('0 organizadores nos filtros aplicados');
  await view.getByRole('button', { name: 'Limpar filtros' }).click();
  await expect(search).toBeEmpty();
  await expect(view.getByRole('status')).toContainText('no cadastro');
  expect(methods).toEqual(['GET', 'GET', 'GET']);

  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  await expect(view).toHaveCSS('color-scheme', 'dark');
  const apply = view.getByRole('button', { name: 'Filtrar' });
  await view.getByRole('combobox', { name: 'Risco', exact: true }).focus();
  await page.keyboard.press('Tab');
  await expect(apply).toBeFocused();
  await expect(apply).toHaveCSS('outline-style', 'solid');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});

test('administrator sees a distinct failure and retries returning to actual results', async ({ page }) => {
  test.skip(!email || !password, 'Requer a conta administrativa de teste.');
  await login(page);
  await page.route('**/api/admin/platform/organizers?*', async (route) => {
    await new Promise<void>((resolve) => setTimeout(resolve, 1000));
    await route.fulfill({ status: 503, json: {} });
  }, { times: 1 });
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
  await page.goto('/admin/organizadores');
  const view = page.locator('.sx-admin-organizers');
  await expect(view).toHaveCSS('color-scheme', 'light');
  await expect(view.getByRole('status')).toHaveText('Carregando organizadores…');
  await expect(view.locator('.sx-ao-spinner')).toHaveCSS('animation-name', 'none');
  await expect(view.getByRole('alert')).toHaveText('Não foi possível carregar os organizadores.');
  await expect(view.getByText('Nenhum organizador encontrado')).toHaveCount(0);
  await view.getByRole('button', { name: 'Tentar novamente' }).click();
  await expect(view.getByRole('status')).toContainText('no cadastro');
});

test('pagination uses the actual filtered API scope and returns to page one when filters change', async ({ page }) => {
  test.skip(process.env.SORTEX_SYNTHETIC_ADMIN_ORGANIZERS !== '1' || !email || !password, 'Requer os cadastros sintéticos locais.');
  await login(page);
  await page.goto('/admin/organizadores');
  const view = page.locator('.sx-admin-organizers');
  const filter = view.getByRole('searchbox', { name: 'Pesquisar organizadores' });
  await filter.fill('Ficha sintética QA');
  await filter.press('Enter');
  await expect(view.getByRole('status')).toHaveText('27 organizadores nos filtros aplicados');
  await expect(view.getByRole('listitem')).toHaveCount(25);
  await expect(view.getByRole('button', { name: 'Anterior' })).toBeDisabled();
  await view.getByRole('button', { name: 'Próxima' }).click();
  await expect(view.getByText('Página 2 de 2')).toBeVisible();
  await expect(view.getByRole('listitem')).toHaveCount(2);
  await expect(view.getByRole('button', { name: 'Próxima' })).toBeDisabled();
  await view.getByRole('combobox', { name: 'Status', exact: true }).selectOption('INCOMPLETE');
  await view.getByRole('button', { name: 'Filtrar' }).click();
  await expect(view.getByText('Página 1 de 2')).toBeVisible();
  await expect(view.getByRole('listitem')).toHaveCount(25);
});
