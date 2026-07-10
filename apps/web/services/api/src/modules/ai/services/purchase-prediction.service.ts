import { Injectable } from "@nestjs/common";

@Injectable()
export class PurchasePredictionService {

  predict(score: number): number {

    if (score >= 90) return 98;

    if (score >= 80) return 92;

    if (score >= 70) return 85;

    if (score >= 60) return 70;

    if (score >= 50) return 55;

    return 25;

  }

}