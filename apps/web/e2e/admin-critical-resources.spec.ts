import { expect, test } from '@playwright/test';

const resources = [
  { path: 'campanhas', api: 'campaigns', heading: 'Moderação de campanhas', title: 'Campanha Beta', row: { id: 'campaign-1', title: 'Campanha Beta', status: 'PENDING_REVIEW', createdAt: '2026-07-28T10:00:00Z', organizer: { name: 'Organizador' } } },
  { path: 'pagamentos', api: 'payments', heading: 'Pagamentos', title: 'PAY-001', row: { id: 'payment-1', externalReference: 'PAY-001', amount: 50, method: 'PIX', status: 'APPROVED', createdAt: '2026-07-28T10:00:00Z', buyer: { name: 'Comprador' } } },
  { path: 'usuarios', api: 'users', heading: 'Usuários', title: 'Usuário Teste', row: { id: 'user-1', name: 'Usuário Teste', email: 'usuario@sortex.test', role: 'BUYER', status: 'ACTIVE', createdAt: '2026-07-28T10:00:00Z' } },
  { path: 'suporte', api: 'support', heading: 'Suporte', title: 'Ajuda com cadastro', row: { id: 'support-1', subject: 'Ajuda com cadastro', description: 'Dúvida', priority: 'HIGH', status: 'OPEN', createdAt: '2026-07-28T10:00:00Z' } },
  { path: 'ganhadores', api: 'winners', heading: 'Ganhadores', title: 'Moto', row: { id: 'winner-1', prizeName: 'Moto', winningNumber: '12345', status: 'IDENTIFIED', createdAt: '2026-07-28T10:00:00Z', buyer: { name: 'Ganhador' }, campaign: { title: 'Campanha Beta' } } },
  { path: 'denuncias', api: 'reports', heading: 'Denúncias', title: 'Conteúdo irregular', row: { id: 'report-1', reason: 'Conteúdo irregular', description: 'Descrição da denúncia', entityType: 'CAMPAIGN', entityId: 'campaign-1', status: 'OPEN', createdAt: '2026-07-28T10:00:00Z' } },
] as const;

const superadmin = {
  id: 'admin-1', name: 'Super Admin', email: 'admin@sortex.test', phone: null, cpf: null, cnpj: null,
  role: 'ADMIN', adminTeamRole: 'SUPERADMIN',
  adminPermissions: ['USERS_READ', 'USERS_WRITE', 'CAMPAIGNS_REVIEW', 'FINANCE_READ', 'FINANCE_WRITE', 'DRAWS_REVIEW', 'SUPPORT_WRITE'],
  city: null, state: null, isActive: true, verified: true,
  createdAt: '2026-07-01T00:00:00Z', updatedAt: '2026-07-01T00:00:00Z',
};

async function prepare(page: import('@playwright/test').Page) {
  await page.context().addCookies([{ name: 'sortex_access_token', value: 'admin-session', url: process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:3000' }]);
  await page.route('**/api/auth/me', (route) => route.fulfill({ json: superadmin }));
  await page.route('**/api/admin/platform/**', (route) => {
    const path = new URL(route.request().url()).pathname.replace('/api/admin/platform/', '');
    const resource = resources.find((item) => path === item.api || path.startsWith(`${item.api}?`) || path.startsWith(`${item.api}/`));
    if (!resource) return route.fulfill({ status: 404, json: { message: 'Não encontrado' } });
    if (route.request().method() !== 'GET') return route.fulfill({ json: { ok: true } });
    if (path.startsWith(`${resource.api}/`)) return route.fulfill({ json: { ...resource.row, audit: [{ id: 'audit-1', action: 'ADMIN_REVIEW', createdAt: '2026-07-28T11:00:00Z', actor: { name: 'Super Admin' } }], messages: resource.api === 'support' ? [] : undefined } });
    return route.fulfill({ json: { data: [resource.row], pagination: { page: 1, pages: 1, total: 1 } } });
  });
}

test.describe('páginas administrativas críticas', () => {
  for (const resource of resources) {
    test(`${resource.heading} possui listagem, filtros e detalhes`, async ({ page }) => {
      await prepare(page);
      await page.goto(`/admin/${resource.path}`);
      await expect(page.getByRole('heading', { name: resource.heading })).toBeVisible();
      await expect(page.getByText(resource.title, { exact: true }).first()).toBeVisible();
      await expect(page.getByLabel('Ordenar')).toBeVisible();
      await page.getByRole('button', { name: 'Detalhes' }).click();
      await expect(page.getByRole('dialog', { name: `Detalhes de ${resource.heading}` })).toBeVisible();
      await expect(page.getByText('Histórico administrativo')).toBeVisible();
    });
  }

  test('controles permanecem utilizáveis no celular', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await prepare(page);
    await page.goto('/admin/campanhas');
    await expect(page.getByLabel('Data inicial')).toBeVisible();
    await expect(page.getByLabel('Data final')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Detalhes' })).toBeVisible();
  });
});
