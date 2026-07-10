import { Injectable } from "@nestjs/common";

@Injectable()
export class DashboardService {

  async getDashboard() {

    return {

      kpis: {

        saldoArrecadado: 128450,

        recebidoHoje: 2480,

        receitaMes: 68920,

        cotasVendidas: 18452,

        campanhasAtivas: 12,

      },

      ia: {

        score: 94,

        oportunidades: 6,

        alertas: 2,

      },

    };

  }

}