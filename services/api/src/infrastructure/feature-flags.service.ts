import { Injectable } from '@nestjs/common';

export const FEATURE_FLAGS = {
  REAL_PAYMENTS: false,
  CARD_PAYMENTS: false,
  REAL_DRAWS: false,
  PAYOUTS: false,
  AFFILIATES: true,
  EXTERNAL_CRM: false,
  WHATSAPP: false,
  VIDEO_RENDERING: false,
  OPEN_REGISTRATION: false,
  PUBLIC_CAMPAIGNS: false,
} as const;

export type FeatureFlag = keyof typeof FEATURE_FLAGS;

@Injectable()
export class FeatureFlagsService {
  isEnabled(flag: FeatureFlag): boolean {
    const configured = process.env[`FEATURE_${flag}`];
    if (configured == null) return FEATURE_FLAGS[flag];
    return configured.trim().toLowerCase() === 'true';
  }

  publicFlags() {
    return {
      openRegistration: this.isEnabled('OPEN_REGISTRATION'),
      publicCampaigns: this.isEnabled('PUBLIC_CAMPAIGNS'),
    };
  }
}
