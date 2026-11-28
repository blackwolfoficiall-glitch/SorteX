type FinanceGet = <T>(url: string) => Promise<T>;

export async function loadOrganizerFinanceDashboard<Overview, Statement, Campaigns>(
  get: FinanceGet,
  isActive: () => boolean,
) {
  // The legacy overview releases due internal credits. Wait for it before
  // reading data that must reflect the same change on the first render.
  const overview = await get<Overview>("/api/finance/overview");
  if (!isActive()) return;

  const [statement, campaigns] = await Promise.all([
    get<Statement>("/api/finance/statement?limit=100"),
    get<Campaigns>("/api/finance/campaigns"),
  ]);
  if (!isActive()) return;
  return { overview, statement, campaigns };
}
