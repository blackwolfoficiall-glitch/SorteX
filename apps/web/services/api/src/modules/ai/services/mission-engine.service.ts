import { Injectable } from "@nestjs/common";

export interface Mission {
  id: string;
  priority: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
  title: string;
  description: string;
  estimatedRevenue: number;
  estimatedQuotas: number;
  action: string;
}

@Injectable()
export class MissionEngineService {

  generate() : Mission[] {

    return [

      {
        id: "recover-customers",
        priority: "HIGH",
        title: "Recuperar Clientes",
        description:
          "18 compradores possuem alta chance de comprar novamente hoje.",
        estimatedRevenue: 2840,
        estimatedQuotas: 138,
        action: "recoverCustomers",
      },

      {
        id: "promotion",
        priority: "HIGH",
        title: "Criar Promoção",
        description:
          "Ativar Compre 10 e Ganhe 2 pode aumentar as vendas.",
        estimatedRevenue: 1680,
        estimatedQuotas: 92,
        action: "createPromotion",
      },

      {
        id: "ads",
        priority: "MEDIUM",
        title: "Impulsionar Campanha",
        description:
          "Investimento sugerido de R$30 no SorteX Ads.",
        estimatedRevenue: 3920,
        estimatedQuotas: 240,
        action: "createAds",
      },

    ];

  }

}