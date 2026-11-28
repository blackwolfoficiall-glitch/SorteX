import { expect, test, type Page } from '@playwright/test';

const endpoint = '/api/admin/platform/team';
const email = process.env.E2E_ADMIN_EMAIL;
const password = process.env.E2E_ADMIN_PASSWORD;

async function login(page: Page) {
  await page.context().clearCookies();
  const reply = await page.request.post('/api/auth/admin-login', { data: { email, password } });
  expect(reply.status()).toBe(200);
}

test('team consultation preserves controls and profile destinations without clicking them', async ({ page }) => {
  test.skip(process.env.SORTEX_SYNTHETIC_ADMIN_TEAM !== '1' || !email || !password, 'Requer equipe sintética sem convites.');
  await login(page);
  const methods: string[] = [];
  await page.route('**/api/admin/platform/team**', async (route) => {
    const method = route.request().method();
    methods.push(method);
    if (method !== 'GET' || new URL(route.request().url()).pathname !== endpoint) return route.abort();
    await route.continue();
  });
  const initial = page.waitForResponse((reply) => new URL(reply.url()).pathname === endpoint);
  await page.goto('/admin/equipe');
  const view = page.locator('.sx-admin-team');
  await expect(view.getByRole('heading', { name: 'Gestão da equipe', exact: true })).toBeVisible();
  const reply = await initial;
  expect(reply.status()).toBe(200);
  const payload = await reply.json();
  expect(payload.invitations.length).toBe(0);
  const summary = view.getByRole('region', { name: 'Resumo da equipe' });
  await expect(summary.getByText('Total de membros').locator('..').locator('p').last()).toHaveText(String(payload.summary.total));
  const members = view.getByRole('region', { name: 'Funcionários encontrados' });
  await expect(members.getByRole('article')).toHaveCount(payload.members.length);
  await expect(view.getByRole('button', { name: 'Convidar funcionário' })).toHaveAttribute('aria-expanded', 'false');
  await expect(view.getByRole('button', { name: 'Revogar sessões' }).first()).toBeVisible();
  expect((await members.getByRole('link', { name: 'Ver perfil' }).first().getAttribute('href')) === `/admin/equipe/${payload.members[0].id}`).toBe(true);
  await expect(view.getByText('Nenhum convite pendente.')).toBeVisible();

  const search = view.getByRole('searchbox', { name: 'Pesquisar funcionário' });
  await search.fill('Equipe fictícia leitura 320');
  await expect(view.getByRole('status')).toHaveText('1 funcionário na pesquisa');
  await expect(members.getByRole('heading')).toHaveText('Equipe fictícia leitura 320');
  await search.fill('sem-funcionario-qa-22eb16');
  await expect(view.getByRole('status')).toHaveText('0 funcionários na pesquisa');
  await expect(view.getByText('Nenhum funcionário encontrado para a pesquisa.')).toBeVisible();
  await expect(summary.getByText('Total de membros').locator('..').locator('p').last()).toHaveText(String(payload.summary.total));
  await search.clear();
  await expect(view.getByRole('status')).toContainText('na equipe');

  await page.emulateMedia({ colorScheme: 'dark' });
  await expect(view).toHaveCSS('color-scheme', 'dark');
  await search.focus();
  await page.keyboard.press('Tab');
  const refresh = view.getByRole('button', { name: 'Atualizar', exact: true });
  await expect(refresh).toBeFocused();
  await expect(refresh).toHaveCSS('outline-style', 'solid');
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  expect(methods).toEqual(['GET']);
  await expect(view.getByRole('button', { name: 'Gerar convite local' })).toHaveCount(0);
});

test('team failure stays separate from empty results and retry restores real members', async ({ page }) => {
  test.skip(process.env.SORTEX_SYNTHETIC_ADMIN_TEAM !== '1' || !email || !password, 'Requer equipe sintética sem convites.');
  await login(page);
  await page.route('**/api/admin/platform/team', async (route) => {
    await new Promise<void>((resolve) => setTimeout(resolve, 1000));
    await route.fulfill({ status: 503, json: {} });
  }, { times: 1 });
  await page.emulateMedia({ colorScheme: 'light', reducedMotion: 'reduce' });
  await page.goto('/admin/equipe');
  const view = page.locator('.sx-admin-team');
  await expect(view).toHaveCSS('color-scheme', 'light');
  await expect(view.getByRole('status')).toHaveText('Carregando equipe…');
  await expect(view.locator('.sx-at-spinner')).toHaveCSS('animation-name', 'none');
  await expect(view.getByRole('alert')).toHaveText('Não foi possível carregar a equipe.');
  await expect(view.getByText('Nenhum convite pendente.')).toHaveCount(0);
  await expect(view.getByRole('region', { name: 'Resumo da equipe' })).toHaveCount(0);
  await view.getByRole('button', { name: 'Tentar novamente' }).click();
  await expect(view.getByRole('status')).toContainText('na equipe');
});
