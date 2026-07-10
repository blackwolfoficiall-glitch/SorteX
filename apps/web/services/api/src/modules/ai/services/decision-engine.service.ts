import { Injectable } from "@nestjs/common";

export interface Decision {
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  category:
    | "CRM"
    | "CAMPAIGN"
    | "ADS"
    | "FINANCE"
    | "AFFILIATE";
  title: string;
  description: string;
  estimatedImpact: number;
  action: string;
}

@Injectable()
export class DecisionEngineService {
  rank(decisions: Decision[]): Decision[] {
    const weight = {
      CRITICAL: 4,
      HIGH: 3,
      MEDIUM: 2,
      LOW: 1,
    };

    return decisions.sort(
      (a, b) =>
        weight[b.priority] - weight[a.priority] ||
        b.estimatedImpact - a.estimatedImpact,
    );
  }
}