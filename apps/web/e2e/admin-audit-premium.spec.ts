import { expect, test, type Page } from '@playwright/test';

const endpoint = '/api/admin/platform/audit-logs';
const email = process.env.E2E_ADMIN_EMAIL;
const password = process.env.E2E_ADMIN_PASSWORD;
const marker = 'QA_AUDITORIA_CONSULTA_FICTICIA';

async function login(page: Page) {
  await page.context().clearCookies();
  const reply = await page.request.post('/api/auth/admin-login', { data: { email, password } });
  expect(reply.status()).toBe(200);
}

test('audit results are read-only and distinguish loading, failure and recovery', async ({ page }) => {
  test.skip(!email || !password, 'Requer a conta administrativa de teste.');
  await login(page);
  const methods: string[] = [];
  await page.route('**/api/admin/platform/audit-logs?*', async (route) => {
    methods.push(route.request().method());
    if (route.request().method() !== 'GET') return route.abort();
    if (methods.length === 1) {
      await new Promise<void>((resolve) => setTimeout(resolve, 1000));
      await route.fulfill({ status: 503, json: {} });
    } else await route.continue();
  });
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
  await page.goto('/admin/auditoria');
  const view = page.locator('.sx-admin-audit');
  await expect(view).toHaveCSS('color-scheme', 'light');
  await expect(view.getByRole('status')).toHaveText('Carregando registros…');
  await expect(view.locator('.sx-aa-spinner')).toHaveCSS('animation-name', 'none');
  await expect(view.getByRole('alert')).toHaveText('Não foi possível consultar os registros.');
  await expect(view.getByText('Nenhum registro encontrado.')).toHaveCount(0);
  await view.getByRole('button', { name: 'Tentar novamente' }).click();
  await expect(view.getByRole('status')).toContainText('no histórico');
  await expect(view.getByRole('button', { name: /exportar|editar/i })).toHaveCount(0);
  expect(methods).toEqual(['GET', 'GET']);
});

test('audit filters match the real action and inclusive UTC date contract', async ({ page }) => {
  test.skip(process.env.SORTEX_SYNTHETIC_ADMIN_AUDIT !== '1' || !email || !password, 'Requer os eventos sintéticos locais.');
  await login(page);
  const view = page.locator('.sx-admin-audit');
  const seen: string[] = [];
  page.on('request', (request) => {
    if (new URL(request.url()).pathname === endpoint) seen.push(request.method());
  });
  await page.goto('/admin/auditoria');
  await expect(view.getByRole('heading', { name: 'Auditoria', exact: true })).toBeVisible();
  await expect(view.getByRole('status')).toContainText('no histórico');
  await view.getByRole('searchbox', { name: 'Pesquisar ação' }).fill(marker);
  await view.getByLabel('Data inicial').fill('2024-02-05');
  await view.getByLabel('Data final').fill('2024-02-04');
  await view.getByRole('button', { name: 'Filtrar' }).click();
  await expect(view.getByRole('alert')).toContainText('A data final');
  expect(seen).toEqual(['GET']);

  await view.getByLabel('Data final').fill('2024-02-05');
  const filtered = page.waitForResponse((reply) => {
    const url = new URL(reply.url());
    return url.pathname === endpoint && url.searchParams.get('action') === marker &&
      url.searchParams.get('from') === '2024-02-05T00:00:00.000Z' &&
      url.searchParams.get('to') === '2024-02-05T23:59:59.999Z' &&
      !url.searchParams.has('search');
  });
  await view.getByRole('button', { name: 'Filtrar' }).click();
  expect((await filtered).status()).toBe(200);
  await expect(view.getByRole('status')).toHaveText('28 registros nos filtros aplicados');
  const rows = view.getByRole('listitem');
  await expect(rows).toHaveCount(25);
  await expect(rows.first().getByRole('heading')).toHaveText(marker);
  await expect(rows.first().locator('time')).toHaveAttribute('datetime', '2024-02-05T23:59:59.999Z');
  await expect(view.getByText('campo-privado-de-fixture')).toHaveCount(0);
  await view.getByRole('button', { name: 'Próxima' }).click();
  await expect(view.getByText('Página 2 de 2')).toBeVisible();
  await expect(rows).toHaveCount(3);
  await expect(rows.last().locator('time')).toHaveAttribute('datetime', '2024-02-05T00:00:00.000Z');
  expect(seen.every((method) => method === 'GET')).toBe(true);

  await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' });
  await expect(view).toHaveCSS('color-scheme', 'dark');
  // Date inputs may have multiple native tab stops; prove an actual visible
  // keyboard focus step between the app's two filter actions instead.
  await view.getByRole('button', { name: 'Filtrar', exact: true }).focus();
  await page.keyboard.press('Tab');
  const clear = view.getByRole('button', { name: 'Limpar filtros', exact: true });
  await expect(clear).toBeFocused();
  await expect(clear).toHaveCSS('outline-style', 'solid');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  await view.getByRole('button', { name: 'Limpar filtros' }).click();
  await expect(view.getByRole('searchbox')).toBeEmpty();
  await expect(view.getByRole('status')).toContainText('no histórico');
});
