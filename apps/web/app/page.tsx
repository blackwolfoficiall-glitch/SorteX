import {
  BadgeCheck,
  CheckCircle2,
  CreditCard,
  DatabaseZap,
  FileCheck2,
  Headphones,
  LockKeyhole,
  ShieldCheck,
} from "lucide-react";
import Header from "../components/Header";
import HeroBanner from "../components/home/HeroBanner";
import Footer from "../components/Footer";

const benefits = [
  [BadgeCheck, "Organizadores verificados", "Perfis de organizadores passam por um fluxo de envio e revisão de dados."],
  [CreditCard, "Pagamentos protegidos", "Os pagamentos são processados por gateways integrados, conforme o meio disponível."],
  [FileCheck2, "Resultados transparentes", "Regras e resultados podem ser consultados dentro da plataforma."],
  [DatabaseZap, "Cálculo auditável", "Campanhas podem utilizar resultados da Loteria Federal com regras registradas e cálculo reproduzível."],
  [CheckCircle2, "Código de verificação", "Ganhadores e entregas podem possuir uma página pública de verificação."],
  [LockKeyhole, "Proteção de dados", "Sessões protegidas e acesso aos dados conforme o perfil do usuário."],
  [Headphones, "Suporte ao participante", "Chamados e histórico de atendimento ficam vinculados à conta."],
  [ShieldCheck, "Histórico de auditoria", "Ações críticas preservam registros para conferência e análise."],
] as const;

const steps = [
  "Crie sua conta.",
  "Acesse as campanhas disponíveis.",
  "Escolha e compre seus títulos.",
  "Acompanhe o sorteio e os resultados.",
  "Consulte seus títulos e prêmios na sua conta.",
];

const faq = [
  ["O que é a SorteX?", "Uma plataforma para participação e gestão de campanhas premiadas, com recursos de segurança e transparência."],
  ["Como faço para participar?", "Crie uma conta de comprador, entre na plataforma e consulte as campanhas disponíveis para o seu perfil."],
  ["Como encontro as campanhas?", "As campanhas ficam disponíveis na área interna depois do cadastro e login."],
  ["Como funciona o resultado pela Loteria Federal?", "Quando previsto na campanha, resultados da Loteria Federal podem servir como fonte para uma regra registrada previamente na SorteX."],
  ["Como acompanho meus títulos?", "A área Meus Títulos reúne reservas, compras, números e respectivos status."],
  ["Como recebo um prêmio?", "O organizador realiza a entrega conforme o regulamento, e a confirmação pode ser registrada na plataforma."],
  ["Como me cadastro como organizador?", "Escolha a conta de organizador, envie os dados solicitados e aguarde a verificação."],
  ["Como a SorteX protege meus dados?", "A plataforma utiliza controle de acesso, sessões protegidas e limita a exposição pública de dados pessoais."],
] as const;

export default function Home() {
  return (
    <>
      <Header />
      <main>
        <HeroBanner />

        <section className="mx-auto max-w-7xl px-5 py-20">
          <p className="text-sm font-black uppercase tracking-[0.2em] text-violet-700">Por que escolher a SorteX</p>
          <h2 className="mt-3 max-w-3xl text-3xl font-black text-zinc-950 md:text-5xl">Confiança construída com informação clara</h2>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {benefits.map(([Icon, title, description]) => (
              <article key={title} className="rounded-3xl border border-zinc-200 bg-white p-6 shadow-sm">
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-violet-50 text-violet-700"><Icon size={24} /></span>
                <h3 className="mt-5 text-lg font-black">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-zinc-600">{description}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="bg-zinc-950 py-20 text-white">
          <div className="mx-auto max-w-7xl px-5">
            <p className="text-sm font-black uppercase tracking-[0.2em] text-violet-300">Como funciona</p>
            <h2 className="mt-3 text-3xl font-black md:text-5xl">Da conta ao acompanhamento do resultado</h2>
            <ol className="mt-10 grid gap-4 md:grid-cols-5">
              {steps.map((step, index) => <li key={step} className="rounded-3xl border border-white/10 bg-white/5 p-5"><span className="text-3xl font-black text-violet-300">{index + 1}</span><p className="mt-4 font-bold">{step}</p></li>)}
            </ol>
          </div>
        </section>

        <section className="mx-auto grid max-w-7xl gap-10 px-5 py-20 lg:grid-cols-2 lg:items-center">
          <div><p className="text-sm font-black uppercase tracking-[0.2em] text-green-700">Segurança e transparência</p><h2 className="mt-3 text-3xl font-black md:text-5xl">Acompanhe as etapas importantes</h2><p className="mt-5 text-lg leading-8 text-zinc-600">Organizadores verificados, regras registradas antes do sorteio, histórico de auditoria, pagamentos processados por gateway e confirmação de entrega ajudam o participante a conferir o processo.</p></div>
          <div className="rounded-[32px] bg-violet-50 p-8"><p className="font-bold text-violet-950">Quando uma campanha utiliza a Loteria Federal, ela atua como fonte do resultado. A regra de cálculo é definida e registrada na SorteX para permitir conferência posterior.</p></div>
        </section>

        <section className="mx-auto max-w-7xl px-5 pb-20">
          <div className="rounded-[36px] bg-gradient-to-r from-violet-700 to-purple-900 p-8 text-white md:p-12">
            <h2 className="text-3xl font-black md:text-4xl">Quer realizar campanhas na SorteX?</h2>
            <p className="mt-4 max-w-3xl text-lg text-violet-100">Crie sua conta, envie seus dados para verificação e tenha acesso às ferramentas de campanhas, vendas, financeiro, afiliados e divulgação.</p>
            <a href="/cadastro" className="mt-7 inline-block rounded-2xl bg-white px-6 py-3 font-bold text-violet-700">Criar conta</a>
          </div>
        </section>

        <section className="border-t bg-zinc-50 py-20">
          <div className="mx-auto max-w-4xl px-5"><p className="text-center text-sm font-black uppercase tracking-[0.2em] text-violet-700">Perguntas frequentes</p><h2 className="mt-3 text-center text-3xl font-black md:text-5xl">Dúvidas sobre a SorteX</h2><div className="mt-10 space-y-3">{faq.map(([question, answer]) => <details key={question} className="group rounded-2xl border bg-white p-5"><summary className="cursor-pointer list-none font-black">{question}</summary><p className="mt-3 leading-7 text-zinc-600">{answer}</p></details>)}</div></div>
        </section>
      </main>
      <Footer />
    </>
  );
}
