import { expect, test, type Page } from '@playwright/test';

const endpoint = '/api/admin/platform/users';
const email = process.env.E2E_ADMIN_EMAIL;
const password = process.env.E2E_ADMIN_PASSWORD;

async function login(page: Page) {
  await page.context().clearCookies();
  const reply = await page.request.post('/api/auth/admin-login', { data: { email, password } });
  expect(reply.status()).toBe(200);
}

test('user directory uses the actual API and preserves privileged controls without invoking them', async ({ page }) => {
  test.skip(!email || !password, 'Requer a conta administrativa de teste.');
  await login(page);
  const methods: string[] = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname.startsWith(endpoint)) methods.push(request.method());
  });
  const initial = page.waitForResponse((reply) => new URL(reply.url()).pathname === endpoint);
  await page.goto('/admin/usuarios');
  const view = page.locator('.sx-admin-users');
  await expect(view.getByRole('heading', { name: 'Usuários', exact: true })).toBeVisible();
  const reply = await initial;
  expect(reply.status()).toBe(200);
  const { data, pagination } = await reply.json();
  const entries = view.getByRole('listitem');
  await expect(entries).toHaveCount(data.length);
  if (data.length) {
    const first = entries.first();
    expect((await first.getByRole('heading').textContent()) === data[0].name).toBe(true);
    await expect(first.getByRole('button', { name: 'Detalhes' })).toBeVisible();
    await expect(first.getByRole('button', { name: 'Ativar' })).toBeVisible();
  }
  await expect(view.getByRole('status')).toHaveText(new RegExp(`^${Number(pagination.total).toLocaleString('pt-BR')}`));

  const exactFilter = page.waitForResponse((reply) => {
    const url = new URL(reply.url());
    return url.pathname === endpoint && url.searchParams.get('status') === 'ACTIVE' && url.searchParams.get('page') === '1';
  });
  await view.getByRole('combobox', { name: 'Filtrar status' }).selectOption('ACTIVE');
  expect((await exactFilter).status()).toBe(200);
  await expect(view.getByRole('status')).toContainText('nos filtros aplicados');

  await view.getByRole('searchbox', { name: 'Pesquisar usuários' }).fill('conta-nao-encontrada-test-6ed20a');
  await expect(view.getByRole('status')).toHaveText('0 usuários nos filtros aplicados');
  await expect(view.getByText('Nenhum registro encontrado para os filtros informados.')).toBeVisible();
  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(view).toHaveCSS('color-scheme', 'dark');
  const status = view.getByRole('combobox', { name: 'Filtrar status' });
  await view.getByRole('searchbox').focus();
  await page.keyboard.press('Tab');
  // iOS WebKit can skip selects during sequential keyboard navigation. Use the
  // active next control, without treating the skipped native picker as a tab stop.
  expect(await view.evaluate((el) => el.contains(document.activeElement))).toBe(true);
  expect(await view.evaluate(() => getComputedStyle(document.activeElement!).outlineStyle)).toBe('solid');
  await expect(status).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  expect(methods.length).toBeGreaterThanOrEqual(3);
  expect(methods.every((method) => method === 'GET')).toBe(true);
});

test('list network failure is not reported as empty and can be retried', async ({ page }) => {
  test.skip(!email || !password, 'Requer a conta administrativa de teste.');
  await login(page);
  await page.route('**/api/admin/platform/users?*', async (route) => {
    await new Promise<void>((resolve) => setTimeout(resolve, 1000));
    await route.fulfill({ status: 503, json: {} });
  }, { times: 1 });
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
  await page.goto('/admin/usuarios');
  const view = page.locator('.sx-admin-users');
  await expect(view).toHaveCSS('color-scheme', 'light');
  await expect(view.getByRole('status')).toHaveText('Carregando usuários…');
  await expect(view.locator('.sx-au-spinner')).toHaveCSS('animation-name', 'none');
  await expect(view.getByRole('alert')).toBeVisible();
  await expect(view.getByRole('status')).toHaveText('Listagem indisponível.');
  await expect(view.getByText('Nenhum registro encontrado para os filtros informados.')).toHaveCount(0);
  await view.getByRole('button', { name: 'Tentar novamente' }).click();
  await expect(view.getByRole('status')).toContainText('no cadastro');
});

test('dates and ordering keep the existing list API and return to the first page', async ({ page }) => {
  test.skip(process.env.SORTEX_SYNTHETIC_ADMIN_USERS !== '1' || !email || !password, 'Requer os usuários sintéticos locais.');
  await login(page);
  await page.goto('/admin/usuarios');
  const view = page.locator('.sx-admin-users');
  const search = view.getByRole('searchbox', { name: 'Pesquisar usuários' });
  await search.fill('Conta de verificação fictícia');
  await expect(view.getByRole('status')).toHaveText('24 usuários nos filtros aplicados');
  await expect(view.getByRole('listitem')).toHaveCount(20);
  await view.getByRole('button', { name: 'Próxima' }).click();
  await expect(view.getByText('Página 2 de 2')).toBeVisible();
  await expect(view.getByRole('listitem')).toHaveCount(4);
  await view.getByRole('combobox', { name: 'Ordenar' }).selectOption('oldest');
  await expect(view.getByText('Página 1 de 2')).toBeVisible();
  expect((await view.getByRole('listitem').first().getByRole('heading').textContent()) === 'Conta de verificação fictícia 1').toBe(true);
  const dates = page.waitForResponse((reply) => {
    const url = new URL(reply.url());
    return url.pathname === endpoint && url.searchParams.has('from') && url.searchParams.has('to') &&
      url.searchParams.get('sort') === 'oldest' && url.searchParams.get('page') === '1';
  });
  await view.getByLabel('Data inicial').fill('2000-01-01');
  await view.getByLabel('Data final').fill('2001-01-01');
  expect((await dates).status()).toBe(200);
  await expect(view.getByRole('status')).toHaveText('0 usuários nos filtros aplicados');
});
