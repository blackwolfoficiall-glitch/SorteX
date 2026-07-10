import { Injectable } from "@nestjs/common";

@Injectable()
export class EngagementScoreService {

  calculate(data: {
    totalOrders: number;
    totalSpent: number;
    abandonedPurchases: number;
    lastPurchaseDays: number;
    referrals: number;
  }): number {

    let score = 0;

    score += data.totalOrders * 8;

    score += Number(data.totalSpent) / 50;

    score += data.referrals * 20;

    score -= data.abandonedPurchases * 12;

    score -= data.lastPurchaseDays;

    if (score < 0) score = 0;

    if (score > 100) score = 100;

    return Math.round(score);

  }

}