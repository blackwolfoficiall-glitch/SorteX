import {
  Calculator,
  CircleDollarSign,
  Percent,
  TrendingUp,
} from "lucide-react";

export default function FinancialSimulator({
  totalNumbers,
  numberPrice,
  prizeValue,
  instantPrizeTotal,
  platformFee,
  gatewayName,
  gatewayFee,
}: {
  totalNumbers: number;
  numberPrice: number;
  prizeValue: number;
  instantPrizeTotal: number;
  platformFee: number;
  gatewayName: string;
  gatewayFee: number;
}) {
  const maximumRevenue = totalNumbers * numberPrice;
  const feeValue = maximumRevenue * (platformFee / 100);
  const gatewayFeeValue = maximumRevenue * (gatewayFee / 100);
  const totalCost = prizeValue + instantPrizeTotal + feeValue + gatewayFeeValue;
  const estimatedProfit = maximumRevenue - totalCost;
  const netReceived = maximumRevenue - feeValue - gatewayFeeValue;
  const breakEvenNumbers =
    numberPrice > 0
      ? Math.ceil(
            (prizeValue + instantPrizeTotal) /
            Math.max(numberPrice * (1 - (platformFee + gatewayFee) / 100), 0.0001),
        )
      : 0;
  const breakEvenPercent =
    totalNumbers > 0
      ? Math.min(100, (breakEvenNumbers / totalNumbers) * 100)
      : 0;
  const money = (value: number) =>
    value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
  return (
    <section className="rounded-3xl bg-zinc-950 p-6 text-white">
      <div className="flex items-center gap-3">
        <Calculator className="text-violet-400" />
        <div>
          <h3 className="font-black">Simulador financeiro</h3>
          <p className="text-xs text-zinc-400">
            Estimativa sem movimentação financeira.
          </p>
        </div>
      </div>
      <div className="mt-4 rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm"><span className="text-zinc-400">Gateway utilizado</span><b className="ml-2 text-white">{gatewayName}</b></div>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <Metric
          icon={<CircleDollarSign />}
          label="Faturamento máximo"
          value={money(maximumRevenue)}
        />
        <Metric
          icon={<Percent />}
          label={`Taxa SorteX (${platformFee.toFixed(2)}%)`}
          value={money(feeValue)}
        />
        <Metric icon={<Percent/>} label={`Taxa Gateway (${gatewayFee.toFixed(2)}%)`} value={money(gatewayFeeValue)}/>
        <Metric
          icon={<TrendingUp />}
          label="Lucro líquido"
          value={money(estimatedProfit)}
          success={estimatedProfit >= 0}
        />
        <Metric icon={<TrendingUp/>} label="Receita estimada" value={money(maximumRevenue)}/>
        <Metric icon={<CircleDollarSign/>} label="Valor líquido recebido" value={money(netReceived)}/>
        <Metric
          icon={<Calculator />}
          label="Ponto de equilíbrio"
          value={`${breakEvenNumbers.toLocaleString("pt-BR")} títulos (${breakEvenPercent.toFixed(1)}%)`}
        />
      </div>
      <div className="mt-4 text-xs text-zinc-400">
        Prêmio principal: {money(prizeValue)} · Cotas premiadas:{" "}
        {money(instantPrizeTotal)}.
      </div>
    </section>
  );
}
function Metric({
  icon,
  label,
  value,
  success,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  success?: boolean;
}) {
  return (
    <div className="rounded-2xl bg-white/5 p-4">
      <div className="flex items-center gap-2 text-xs text-zinc-400">
        {icon}
        {label}
      </div>
      <p
        className={`mt-2 font-black ${success ? "text-green-400" : "text-white"}`}
      >
        {value}
      </p>
    </div>
  );
}
