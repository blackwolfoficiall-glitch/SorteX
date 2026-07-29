import { expect, test } from '@playwright/test';

const admin = {
  id: 'finance-admin',
  name: 'Financeiro',
  email: 'financeiro@sortex.test',
  phone: null,
  cpf: null,
  cnpj: null,
  role: 'ADMIN',
  adminTeamRole: 'FINANCE',
  adminPermissions: ['FINANCE_READ', 'FINANCE_WRITE', 'PAYOUTS_REVIEW'],
  city: null,
  state: null,
  isActive: true,
  verified: true,
  createdAt: '2026-07-01T00:00:00.000Z',
  updatedAt: '2026-07-01T00:00:00.000Z',
};
const overview = {
  platform: { lifetimeNetRevenue: 100 },
  organizers: { lifetimeGrossRevenue: 500, availableBalance: 300 },
  pendingPayouts: 1,
};

async function prepare(page: import('@playwright/test').Page) {
  await page.context().addCookies([{
    name: 'sortex_access_token',
    value: 'finance-session',
    url: process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:3000',
  }]);
  await page.route('**/api/auth/me', (route) => route.fulfill({ json: admin }));
  await page.route('**/api/admin/finance/**', async (route) => {
    const url = new URL(route.request().url());
    const path = url.pathname.replace('/api/admin/finance/', '');
    if (path === 'overview') return route.fulfill({ json: overview });
    if (path.startsWith('reconciliation')) return route.fulfill({ json: {
      paymentTotal: 500, ledgerTotal: 500, difference: 0, balanced: true,
    } });
    if (path.includes('/approve') || path.includes('/reject') || path.includes('/block') || path.includes('/unblock'))
      return route.fulfill({ json: { ok: true } });
    if (/^(payouts|ledger|accounts|adjustments|subscriptions)\/[^/]+/.test(path))
      return route.fulfill({ json: { id: 'row-1', status: 'REQUESTED', audit: [] } });
    const data = path.startsWith('payouts') ? [{
      id: 'payout-1', amount: 90, status: 'REQUESTED',
      requestedAt: '2026-07-28T10:00:00.000Z',
      organizer: { name: 'Organizador Teste' },
    }] : [];
    return route.fulfill({ json: { data, pagination: { page: 1, pages: 1, total: data.length } } });
  });
}

test.describe('financeiro administrativo', () => {
  test('lista repasses, abre detalhes e expõe ações autorizadas', async ({ page }) => {
    await prepare(page);
    await page.goto('/admin/financeiro');
    await expect(page.getByRole('heading', { name: 'Controle financeiro' })).toBeVisible();
    await expect(page.getByText('Organizador Teste')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Aprovar' })).toBeVisible();
    await page.getByRole('button', { name: 'Detalhes' }).click();
    await expect(page.getByRole('dialog', { name: 'Detalhes financeiros' })).toBeVisible();
  });

  test('navega pelas áreas e conciliação no celular', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await prepare(page);
    await page.goto('/admin/financeiro');
    for (const name of ['Livro financeiro', 'Contas', 'Ajustes', 'Assinaturas e planos', 'Conciliação']) {
      await page.getByRole('tab', { name }).click();
      await expect(page.getByRole('heading', { name, exact: true })).toBeVisible();
    }
    await expect(page.getByText('Conciliado')).toBeVisible();
  });
});
