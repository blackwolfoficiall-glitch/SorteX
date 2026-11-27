import { validateDashboardPeriod } from './dashboard-period';

describe('Organizer dashboard civil periods', () => {
  const now = new Date('2026-11-27T02:59:59.999Z');

  it('accepts exactly 367 inclusive days, measured in São Paulo', () => {
    expect(
      validateDashboardPeriod({ start: '2025-11-25', end: '2026-11-26' }, now),
    ).toEqual({
      start: '2025-11-25',
      end: '2026-11-26',
      timeZone: 'America/Sao_Paulo',
    });
    expect(() =>
      validateDashboardPeriod({ start: '2025-11-24', end: '2026-11-26' }, now),
    ).toThrow();
    expect(() =>
      validateDashboardPeriod({ start: '2026-11-26', end: '2026-11-27' }, now),
    ).toThrow();
    expect(
      validateDashboardPeriod(
        { start: '2026-11-27', end: '2026-11-27' },
        new Date('2026-11-27T03:00:00Z'),
      ).end,
    ).toBe('2026-11-27');
  });

  it.each([
    ['2026-02-29', '2026-03-01'],
    ['2026-11-22', '2026-11-21'],
    ['2026-1-01', '2026-11-22'],
    ['2026-11-21\n', '2026-11-22'],
    ['1999-12-31', '2000-01-01'],
    ['', '2026-11-26'],
  ])('rejects %s and %s', (start, end) => {
    expect(() => validateDashboardPeriod({ start, end }, now)).toThrow();
  });

  it('validates an actual leap day', () => {
    expect(
      validateDashboardPeriod({ start: '2024-02-29', end: '2024-02-29' }, now)
        .start,
    ).toBe('2024-02-29');
  });
});
