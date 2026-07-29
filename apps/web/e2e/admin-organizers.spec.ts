import { expect, test, type Page } from '@playwright/test';

const organizer = {
  id: 'profile-1',
  userId: 'organizer-1',
  fullName: 'Organizador Homologação',
  organizationName: 'Empresa Homologação',
  cpf: '12345678900',
  cnpj: '12345678000100',
  phone: '71999999999',
  city: 'Salvador',
  state: 'BA',
  currentPlan: 'PROFESSIONAL',
  verificationStatus: 'PENDING',
  riskLevel: 'HIGH',
  riskScore: 78,
  campaignsBlocked: true,
  paymentsBlocked: true,
  payoutsBlocked: true,
  createdAt: '2026-07-01T10:00:00.000Z',
  updatedAt: '2026-07-28T10:00:00.000Z',
  documents: [{ id: 'document-1', status: 'SUBMITTED' }],
  _count: { reviewDecisions: 2, internalNoteEntries: 1 },
  user: {
    email: 'organizador@homologacao.test',
    phone: '71999999999',
    status: 'ACTIVE',
    isActive: true,
    createdAt: '2026-07-01T10:00:00.000Z',
    _count: { campaigns: 3 },
  },
};

async function mockAuthorizedAdmin(page: Page) {
  await page.context().addCookies([
    {
      name: 'sortex_access_token',
      value: 'e2e-admin-session',
      url: process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:3100',
    },
  ]);
  await page.route('**/api/auth/me', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        id: 'admin-analyst',
        name: 'Analista',
        email: 'analista@sortex.test',
        role: 'ADMIN',
        adminTeamRole: 'REGISTRATION_ANALYST',
        adminPermissions: ['USERS_READ', 'ORGANIZERS_REVIEW'],
        isActive: true,
        verified: true,
      }),
    }),
  );
}

function listResponse() {
  return {
    data: [organizer],
    pagination: { page: 1, pages: 1, total: 1 },
    summary: {
      pending: 1,
      underReview: 0,
      corrections: 0,
      documents: 0,
      highRisk: 1,
      approvedToday: 0,
      rejectedToday: 0,
    },
  };
}

test.describe('consolidação de organizadores', () => {
  test.beforeEach(async ({ page }) => {
    await mockAuthorizedAdmin(page);
  });

  test('fila pesquisa, filtra período e solicita correção com motivo', async ({
    page,
    browserName,
  }) => {
    let requestedUrl = '';
    let decisionBody = '';
    await page.route('**/api/admin/platform/approvals**', async (route) => {
      requestedUrl = route.request().url();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(listResponse()),
      });
    });
    await page.route(
      '**/api/admin/platform/organizers/organizer-1/decision',
      async (route) => {
        decisionBody = route.request().postData() || '';
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ verificationStatus: 'CORRECTION_REQUESTED' }),
        });
      },
    );

    await page.goto('/admin/aprovacoes');
    await expect(page.getByRole('heading', { name: 'Fila de aprovações' })).toBeVisible();
    await page.getByPlaceholder('Nome, e-mail, telefone, CPF ou CNPJ').fill('71999999999');
    await page.getByLabel('De', { exact: true }).fill('2026-07-01');
    await page.getByLabel('Até', { exact: true }).fill('2026-07-28');
    await page.getByRole('button', { name: 'Filtrar' }).click();
    await expect.poll(() => requestedUrl).toContain('search=71999999999');
    await expect.poll(() => requestedUrl).toContain('from=');
    await expect.poll(() => requestedUrl).toContain('to=');

    page.on('dialog', async (dialog) => {
      if (dialog.type() === 'prompt')
        await dialog.accept('Documento precisa ser atualizado.');
      else await dialog.accept();
    });
    const correctionButton = page.getByRole('button', { name: 'Solicitar correção' });
    await correctionButton.scrollIntoViewIfNeeded();
    await correctionButton.click({ force: browserName === 'chromium' && (await page.evaluate(() => matchMedia('(max-width: 600px)').matches)) });
    await expect.poll(() => decisionBody).toContain('CORRECTION_REQUESTED');
    expect(JSON.parse(decisionBody).reason).toBe(
      'Documento precisa ser atualizado.',
    );
  });

  test('central lista todos os estados e preserva acesso ao backoffice', async ({
    page,
  }) => {
    let requestedUrl = '';
    await page.route('**/api/admin/platform/organizers?**', async (route) => {
      requestedUrl = route.request().url();
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(listResponse()),
      });
    });
    await page.goto('/admin/organizadores');
    await expect(page.getByRole('heading', { name: 'Central de organizadores' })).toBeVisible();
    await expect(page.getByText('Empresa Homologação')).toBeVisible();
    await expect(page.getByText('3', { exact: true })).toBeVisible();
    await page.getByPlaceholder('Nome, CPF/CNPJ, e-mail ou telefone').fill('Empresa');
    await page.getByLabel('Plano').selectOption('PROFESSIONAL');
    await page.getByRole('button', { name: 'Filtrar' }).click();
    await expect.poll(() => requestedUrl).toContain('search=Empresa');
    await expect.poll(() => requestedUrl).toContain('plan=PROFESSIONAL');
    await expect(
      page.getByRole('link', { name: /Empresa Homologação/ }),
    ).toHaveAttribute('href', '/admin/organizadores/organizer-1');
  });
});
