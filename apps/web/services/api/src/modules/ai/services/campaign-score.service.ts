import { Injectable } from "@nestjs/common";

@Injectable()
export class CampaignScoreService {

  calculate(data: {

    soldPercentage: number;

    conversion: number;

    abandonedPayments: number;

    recurringCustomers: number;

    adsROI: number;

  }): number {

    let score = 0;

    score += data.soldPercentage * 0.35;

    score += data.conversion * 20;

    score += data.recurringCustomers * 2;

    score += data.adsROI * 5;

    score -= data.abandonedPayments * 2;

    if (score < 0) score = 0;

    if (score > 100) score = 100;

    return Math.round(score);

  }

}