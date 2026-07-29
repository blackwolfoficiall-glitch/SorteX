import { FeatureFlagsService } from './feature-flags.service';

describe('FeatureFlagsService', () => {
  const original = process.env;

  beforeEach(() => {
    process.env = { ...original };
  });

  afterAll(() => {
    process.env = original;
  });

  it('keeps risky capabilities disabled by default', () => {
    const service = new FeatureFlagsService();
    expect(service.isEnabled('REAL_PAYMENTS')).toBe(false);
    expect(service.isEnabled('REAL_DRAWS')).toBe(false);
    expect(service.isEnabled('PAYOUTS')).toBe(false);
    expect(service.isEnabled('OPEN_REGISTRATION')).toBe(false);
  });

  it('allows explicit environment overrides', () => {
    process.env.FEATURE_PUBLIC_CAMPAIGNS = 'true';
    expect(new FeatureFlagsService().isEnabled('PUBLIC_CAMPAIGNS')).toBe(true);
  });
});
