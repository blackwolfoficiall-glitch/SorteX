// Scope metadata only, not runtime configuration or approval. This module
// accepts no settings, reads no account data, and cannot enable a capability.
const requirements = {
  META_ADS: ['APP_REVIEW_IF_REQUIRED', 'AUTHORIZED_AD_ACCOUNT', 'ADS_READ'],
  GOOGLE_ADS: ['PROJECT_ACCESS', 'AUTHORIZED_CUSTOMER', 'GOOGLE_ADS_OAUTH'],
  TIKTOK_ADS: ['APP_APPROVAL', 'ADVERTISER_AUTHORIZATION', 'REPORTING_ACCESS'],
} as const;

export type AdsReportingProvider = keyof typeof requirements;

type AdsQaPath = {
  META_ADS: 'OFFLINE_ONLY_PRODUCTION_DATA_API';
  GOOGLE_ADS: 'ISOLATED_TEST_ACCOUNT_WITHOUT_SERVING_METRICS';
  TIKTOK_ADS: 'OFFLINE_UNTIL_REPORTING_TEST_ACCESS_VERIFIED';
};

const qaPaths: AdsQaPath = {
  META_ADS: 'OFFLINE_ONLY_PRODUCTION_DATA_API',
  GOOGLE_ADS: 'ISOLATED_TEST_ACCOUNT_WITHOUT_SERVING_METRICS',
  TIKTOK_ADS: 'OFFLINE_UNTIL_REPORTING_TEST_ACCESS_VERIFIED',
};
const unverified = 'NOT_VERIFIED' as const;

type DisabledCapabilityFor<Provider extends AdsReportingProvider> = {
  provider: Provider;
  intendedCapability: 'READ_ONLY_REPORTING';
  status: 'DISABLED';
  canReadProviderData: false;
  canPublish: false;
  canChangeBudget: false;
  requirements: (typeof requirements)[Provider];
  onboarding: {
    schemaVersion: 1;
    qaPath: AdsQaPath[Provider];
    authorization: {
      applicationAccess: typeof unverified;
      advertiserConsent: typeof unverified;
      campaignEligibility: typeof unverified;
      noSpendScope: typeof unverified;
    };
    canConnectAccount: false;
    canUploadConversionEvents: false;
  };
};

export type DisabledAdsReportingCapability = {
  [Provider in AdsReportingProvider]: DisabledCapabilityFor<Provider>;
}[AdsReportingProvider];

function disabledCapability<Provider extends AdsReportingProvider>(
  provider: Provider,
): DisabledCapabilityFor<Provider> {
  return {
    provider,
    intendedCapability: 'READ_ONLY_REPORTING',
    status: 'DISABLED',
    canReadProviderData: false,
    canPublish: false,
    canChangeBudget: false,
    requirements: requirements[provider],
    onboarding: {
      schemaVersion: 1,
      qaPath: qaPaths[provider],
      authorization: {
        applicationAccess: unverified,
        advertiserConsent: unverified,
        campaignEligibility: unverified,
        noSpendScope: unverified,
      },
      canConnectAccount: false,
      canUploadConversionEvents: false,
    },
  };
}

export function inactiveAdsReportingCapabilities(): DisabledAdsReportingCapability[] {
  return [
    disabledCapability('META_ADS'),
    disabledCapability('GOOGLE_ADS'),
    disabledCapability('TIKTOK_ADS'),
  ];
}
