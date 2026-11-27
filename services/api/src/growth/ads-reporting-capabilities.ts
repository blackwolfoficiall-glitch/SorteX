// The provider registry is capability metadata only. When a read adapter is
// introduced it must stay server-side, authorized per account and separate
// from publication, budget changes, or event uploads.
const requirements = {
  META_ADS: ['APP_REVIEW_IF_REQUIRED', 'AUTHORIZED_AD_ACCOUNT', 'ADS_READ'],
  GOOGLE_ADS: ['PROJECT_ACCESS', 'AUTHORIZED_CUSTOMER', 'GOOGLE_ADS_OAUTH'],
  TIKTOK_ADS: ['APP_APPROVAL', 'ADVERTISER_AUTHORIZATION', 'REPORTING_ACCESS'],
} as const;

const keys = ['META_ADS', 'GOOGLE_ADS', 'TIKTOK_ADS'] as const;

export function inactiveAdsReportingCapabilities() {
  return keys.map((provider) => ({
    provider,
    intendedCapability: 'READ_ONLY_REPORTING' as const,
    status: 'DISABLED' as const,
    canReadProviderData: false as const,
    canPublish: false as const,
    canChangeBudget: false as const,
    requirements: requirements[provider],
  }));
}
