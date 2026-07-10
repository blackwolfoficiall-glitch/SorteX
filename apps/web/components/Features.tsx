import {
  Brain,
  Users,
  ShieldCheck,
  CreditCard,
  Trophy,
  BarChart3,
} from "lucide-react";

const features = [
  {
    icon: Brain,
    title: "IA Integrada",
    description:
      "Automações inteligentes para aumentar suas vendas e melhorar o atendimento.",
  },
  {
    icon: Users,
    title: "CRM Inteligente",
    description:
      "Gerencie compradores, acompanhe o funil e envie campanhas automaticamente.",
  },
  {
    icon: CreditCard,
    title: "Pagamentos",
    description:
      "PIX, cartão de crédito e débito com confirmação automática.",
  },
  {
    icon: Trophy,
    title: "Campanhas Premiadas",
    description:
      "Organize campanhas com transparência e praticidade.",
  },
  {
    icon: ShieldCheck,
    title: "Segurança",
    description:
      "Proteção de dados, autenticação e infraestrutura moderna.",
  },
  {
    icon: BarChart3,
    title: "Relatórios",
    description:
      "Acompanhe vendas, compradores e desempenho em tempo real.",
  },
];

export default function Features() {
  return (
    <section className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-6">

        <div className="text-center mb-16">
          <span className="text-[#6C3BFF] font-semibold">
            Tudo que você precisa
          </span>

          <h2 className="text-5xl font-bold mt-4 text-gray-900">
            Recursos feitos para vender mais
          </h2>

          <p className="mt-5 text-xl text-gray-500 max-w-3xl mx-auto">
            A SorteX reúne tecnologia, inteligência artificial e automações
            para facilitar toda a gestão das suas campanhas.
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">

          {features.map((feature) => (
            <div
              key={feature.title}
              className="rounded-3xl border border-gray-200 p-8 hover:shadow-xl transition"
            >
              <feature.icon
                className="text-[#6C3BFF] mb-5"
                size={34}
              />

              <h3 className="text-2xl font-bold text-gray-900">
                {feature.title}
              </h3>

              <p className="mt-3 text-gray-600 leading-7">
                {feature.description}
              </p>
            </div>
          ))}

        </div>

      </div>
    </section>
  );
}