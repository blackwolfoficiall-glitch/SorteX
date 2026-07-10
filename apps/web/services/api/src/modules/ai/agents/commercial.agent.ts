import { Injectable } from "@nestjs/common";

@Injectable()
export class CommercialAgent {

  async execute() {

    return {

      priority: "HIGH",

      missions: [

        "Recuperar clientes",

        "Criar promoção",

        "Impulsionar campanha",

        "Enviar WhatsApp",

      ],

    };

  }

}