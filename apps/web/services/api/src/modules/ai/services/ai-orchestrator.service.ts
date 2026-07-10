import { Injectable } from "@nestjs/common";

import { CommercialAgent } from "../agents/commercial.agent";
import { CRMAgent } from "../agents/crm.agent";
import { MarketingAgent } from "../agents/marketing.agent";
import { FinanceAgent } from "../agents/finance.agent";
import { CampaignAgent } from "../agents/campaign.agent";
import { AffiliateAgent } from "../agents/affiliate.agent";
import { FraudAgent } from "../agents/fraud.agent";
import { SupportAgent } from "../agents/support.agent";

@Injectable()
export class AIOrchestratorService {

  constructor(
    private readonly commercial: CommercialAgent,
    private readonly crm: CRMAgent,
    private readonly marketing: MarketingAgent,
    private readonly finance: FinanceAgent,
    private readonly campaign: CampaignAgent,
    private readonly affiliate: AffiliateAgent,
    private readonly fraud: FraudAgent,
    private readonly support: SupportAgent,
  ) {}

  async execute() {

    const [
      commercial,
      crm,
      marketing,
      finance,
      campaign,
      affiliate,
      fraud,
      support,
    ] = await Promise.all([
      this.commercial.execute(),
      this.crm.execute(),
      this.marketing.execute(),
      this.finance.execute(),
      this.campaign.execute(),
      this.affiliate.execute(),
      this.fraud.execute(),
      this.support.execute(),
    ]);

    return {
      commercial,
      crm,
      marketing,
      finance,
      campaign,
      affiliate,
      fraud,
      support,
      generatedAt: new Date(),
    };
  }
}