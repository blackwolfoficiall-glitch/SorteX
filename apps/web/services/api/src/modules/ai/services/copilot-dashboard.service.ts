import { Injectable } from "@nestjs/common";

@Injectable()
export class CopilotDashboardService {

  async getDashboard() {

    return {

      campaignScore: 94,

      businessHealth: "EXCELLENT",

      dailyGoal: 1320,

      soldToday: 684,

      recoverableRevenue: 2840,

      opportunities: 6,

      alerts: 2,

      recommendations: [

        "Recuperar clientes VIP",

        "Criar promoção",

        "Impulsionar campanha",

      ],

    };

  }

}