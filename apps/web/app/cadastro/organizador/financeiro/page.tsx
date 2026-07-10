"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

import ProgressSteps from "@/components/organizador/ProgressSteps";
import GatewayCard from "@/components/organizador/GatewayCard";
import FinancialSummary from "@/components/organizador/FinancialSummary";
import ContinueButton from "@/components/organizador/ContinueButton";

export default function FinanceiroPage() {
  const router = useRouter();

  const [gatewaySelecionado, setGatewaySelecionado] =
    useState("Mercado Pago");

  const [conectado, setConectado] =
    useState(true);

  function configurarGateway(gateway: string) {
    setGatewaySelecionado(gateway);
    setConectado(true);
  }

  function finalizar() {
    router.push("/cadastro/organizador/confirmacao");
  }

  return (
    <main className="mx-auto max-w-2xl space-y-6 p-6">

      <ProgressSteps etapa={2} />

      <div className="rounded-3xl border bg-white p-6 shadow-sm">
        <h1 className="text-3xl font-bold">
          Configuração Financeira
        </h1>

        <p className="mt-2 text-zinc-500">
          Escolha o gateway que irá processar os pagamentos das suas campanhas.
        </p>
      </div>

      <GatewayCard
        nome="Mercado Pago"
        logo=""
        descricao="Mais utilizado na SorteX"
        pix="0,99%"
        credito="4,99%"
        debito="1,99%"
        recomendado
        conectado={gatewaySelecionado === "Mercado Pago"}
        onConfigurar={() => configurarGateway("Mercado Pago")}
      />

      <GatewayCard
        nome="Stone"
        logo=""
        descricao="Recebimento rápido"
        pix="1,19%"
        credito="4,79%"
        debito="1,99%"
        conectado={gatewaySelecionado === "Stone"}
        onConfigurar={() => configurarGateway("Stone")}
      />

      <GatewayCard
        nome="PagBank"
        logo=""
        descricao="Conta digital"
        pix="0,99%"
        credito="4,99%"
        debito="1,99%"
        conectado={gatewaySelecionado === "PagBank"}
        onConfigurar={() => configurarGateway("PagBank")}
      />

      <GatewayCard
        nome="Pagar.me"
        logo=""
        descricao="Gateway profissional"
        pix="0,99%"
        credito="4,49%"
        debito="1,89%"
        conectado={gatewaySelecionado === "Pagar.me"}
        onConfigurar={() => configurarGateway("Pagar.me")}
      />

      <GatewayCard
        nome="Asaas"
        logo=""
        descricao="PIX, boleto e cartão"
        pix="0,99%"
        credito="4,89%"
        debito="1,99%"
        conectado={gatewaySelecionado === "Asaas"}
        onConfigurar={() => configurarGateway("Asaas")}
      />

      <FinancialSummary
        gateway={gatewaySelecionado}
        status="Conectado (Modo Teste)"
        plano="Gratuito"
        taxa="2%"
      />

      <ContinueButton
        enabled={conectado}
        onClick={finalizar}
      />

    </main>
  );
}