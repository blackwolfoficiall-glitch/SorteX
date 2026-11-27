import { CampaignStatus } from '@prisma/client';

// Completed public campaigns can keep their results even when no longer
// shoppable. Paused/withdrawn, cancelled and never-published campaigns may not.
export function publicCampaignResultStatus() {
  return {
    in: [
      CampaignStatus.PUBLISHED,
      CampaignStatus.SOLD_OUT,
      CampaignStatus.DRAWN,
      CampaignStatus.FINISHED,
    ],
  };
}
