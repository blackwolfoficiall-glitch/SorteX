import Link from "next/link";
import type { ReactNode } from "react";
import PremiumScope from "@/components/premium/PremiumScope";
import homeHero from "./public-home-premium-hero.module.css";
import {
  DashboardIllustration,
  CrmIllustration,
  AiIllustration,
  LotteryIllustration,
} from "./ProductIllustrations";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronDown,
  ClipboardList,
  Layers3,
  LayoutDashboard,
  Sparkles,
  Bot,
  Palette,
  Network,
  CreditCard,
  Ticket,
  Users,
  Workflow,
} from "lucide-react";
export function SorteXMark({ light = false }: { light?: boolean }) {
  return (
    <Link
      href="/"
      aria-label="Página inicial da SorteX"
      className={`sx-wordmark ${light ? "sx-wordmark-light" : ""}`}
    >
      Sorte<span>X</span>
      <i aria-hidden="true" />
    </Link>
  );
}
const resources = [
  [
    LayoutDashboard,
    "Dashboard inteligente",
    "Veja receita confirmada, pedidos, cotas, participantes e campanhas ativas. Compare vendas por período com dados da sua conta.",
    "Operacional",
  ],
  [
    Users,
    "CRM para cultivar relações",
    "Organize contatos, tags, segmentos, histórico e tarefas. Encontre públicos para acompanhar com mais contexto.",
    "Módulo implementado",
  ],
  [
    Sparkles,
    "IA SorteX com contexto",
    "Consulte indicadores, priorize reservas e simule cenários. Sugestões e rascunhos sempre passam pela sua revisão.",
    "Demonstração determinística",
  ],
  [
    Workflow,
    "Apuração com regras claras",
    "Configure regras, simule a apuração e consulte o histórico. Os resultados da Federal são cadastrados e revisados manualmente.",
    "Operacional · entrada manual",
  ],
] as const;
const plans = [
  {
    name: "Inicial",
    text: "Para estruturar as primeiras campanhas.",
    benefits: [
      "Gestão de campanhas e pedidos",
      "Indicadores e acompanhamento",
      "Identidade básica do organizador",
    ],
  },
  {
    name: "Profissional",
    text: "Para organizar vendas e relacionamento.",
    benefits: [
      "CRM, contatos e segmentação",
      "Módulo de afiliados",
      "Personalização ampliada",
    ],
  },
  {
    name: "Avançado",
    text: "Para explorar análises e automações.",
    benefits: [
      "IA SorteX e simulações",
      "Automações internas",
      "Estrutura para domínio próprio",
    ],
  },
  {
    name: "Empresarial",
    text: "Para avaliar uma operação com necessidades próprias.",
    benefits: [
      "Limites a definir com a equipe",
      "Recursos conforme escopo aprovado",
      "Condições comerciais específicas",
    ],
  },
];
const faq = [
  [
    "O que posso fazer na SorteX?",
    "Organizadores encontram ferramentas para configurar campanhas, acompanhar pedidos, participantes e resultados. Compradores acessam campanhas e acompanham seus títulos pela própria conta.",
  ],
  [
    "Qual perfil devo escolher?",
    "Escolha Comprador para participar e acompanhar seus títulos. Para criar e administrar campanhas, escolha Organizador e informe se o cadastro é de Pessoa Física ou Pessoa Jurídica.",
  ],
  [
    "Criar uma conta libera uma campanha automaticamente?",
    "Não. O organizador passa pelo fluxo de cadastro, complementação e análise. A disponibilidade das ações depende da situação do perfil e das regras da plataforma.",
  ],
  [
    "Quais pagamentos estão disponíveis?",
    "Os meios de pagamento dependem das integrações habilitadas para a campanha. Esta prévia utiliza somente modo de teste e não processa cobranças reais.",
  ],
  [
    "Onde encontro planos e condições?",
    "Os cards mostram a estrutura de planos. Mensalidades, limites, benefícios finais e demais condições aguardam confirmação comercial. Não há contratação ou cobrança nesta prévia.",
  ],
] as const;
export default function ProductHome() {
  return (
    <div className="sx-site">
      <a href="#conteudo" className="sx-skip">
        Ir para o conteúdo
      </a>
      <div className="sx-dark-top">
        <header className="sx-container sx-header">
          <SorteXMark light />
          <nav aria-label="Navegação principal" className="sx-main-nav">
            <a href="#recursos">Recursos</a>
            <a href="#como-funciona">Como funciona</a>
            <a href="#planos">Planos</a>
          </nav>
          <nav aria-label="Acesso à conta" className="sx-access-nav">
            <Link href="/login">Entrar</Link>
            <Link
              href="/cadastro/organizador"
              className="sx-button sx-button-white"
            >
              Quero organizar <ArrowUpRight size={16} />
            </Link>
          </nav>
        </header>
      </div>
      <main id="conteudo">
        <div className="sx-dark-top">
          <PremiumScope className={homeHero.surface}>
            <section className={`sx-container ${homeHero.hero}`} aria-labelledby="home-heading">
              <div className={homeHero.ticket}>
                <p className={homeHero.kicker}>
                  <span className="sx-live-dot" aria-hidden="true" />
                  GESTÃO PARA QUEM ORGANIZA
                </p>
                <h1 id="home-heading">
                  Sua campanha,
                  <br />
                  em outro <em>nível.</em>
                </h1>
                <p className={homeHero.lead}>
                  Campanhas, vendas e relacionamento com seus clientes em um só
                  lugar. Acompanhe os resultados e encontre o próximo passo da sua
                  operação com a SorteX.
                </p>
                <div className={homeHero.actions}>
                  <Link className={`${homeHero.action} ${homeHero.primary}`} href="/cadastro/organizador">
                    Quero organizar <ArrowUpRight size={18} aria-hidden="true" />
                  </Link>
                  <Link className={homeHero.action} href="/cadastro/comprador">
                    Quero participar <ArrowRight size={17} aria-hidden="true" />
                  </Link>
                </div>
                <a className={homeHero.discover} href="#por-dentro">
                  <ArrowDown size={16} aria-hidden="true" />
                  Veja a SorteX por dentro
                </a>
              </div>
              <div className={homeHero.stage}>
                <div className={homeHero.stageHeading}>
                  <span><LayoutDashboard size={16} aria-hidden="true" /> Seu espaço de gestão</span>
                  <span className={homeHero.stageTag}>Visão ilustrada</span>
                </div>
                <DashboardIllustration hero />
                <div className={homeHero.legend}>
                  <span><Check size={15} aria-hidden="true" /> Campanhas</span>
                  <span><Check size={15} aria-hidden="true" /> Participantes</span>
                  <span><Check size={15} aria-hidden="true" /> Resultados</span>
                </div>
              </div>
            </section>
          </PremiumScope>
          <div className="sx-container sx-capabilities">
            <span>
              Sua operação conectada.
              <br />
              <strong>Da campanha ao relacionamento.</strong>
            </span>
            <div>
              <Layers3 size={20} />
              Gestão de campanhas
            </div>
            <div>
              <Ticket size={20} />
              Base de clientes
            </div>
            <div>
              <ClipboardList size={20} />
              Acompanhamento e registros
            </div>
          </div>
        </div>
        <section id="recursos" className="sx-resource-section">
          <div className="sx-container sx-section">
            <p className="sx-eyebrow">FERRAMENTAS QUE TRABALHAM JUNTAS</p>
            <h2>Do detalhe à visão do todo.</h2>
            <div className="sx-resource-grid">
              {resources.map(([Icon, title, copy, status]) => (
                <article key={title}>
                  <Icon size={25} />
                  <span className="sx-feature-status">{status}</span>
                  <h3>{title}</h3>
                  <p>{copy}</p>
                </article>
              ))}
            </div>
            <div className="sx-integration-note">
              <span className="sx-live-dot" />
              Integrações de pagamento conforme disponibilidade. Nesta prévia,
              somente modo de teste.
            </div>
          </div>
        </section>
        <section
          id="por-dentro"
          className="sx-container sx-section sx-product-tour"
        >
          <div className="sx-section-heading">
            <div>
              <p className="sx-eyebrow">VEJA O QUE MUDA NO SEU DIA A DIA</p>
              <h2>
                Gestão que você
                <br />
                consegue enxergar.
              </h2>
            </div>
            <p>
              Campanhas, clientes e decisões conectados. Composições
              ilustrativas mostram como cada recurso pode apoiar a gestão, com
              exemplos simples e legíveis também no celular.
            </p>
          </div>
          <ProductDemo
            title="Dashboard inteligente"
            number="01"
            icon={LayoutDashboard}
            copy="Troque planilhas dispersas por uma visão conectada de receita confirmada, pedidos e campanhas. O gráfico usa as vendas registradas no período escolhido."
            points={[
              "Receita total, do dia e do mês",
              "Participantes únicos e ticket médio",
              "Campanhas ativas e cotas vendidas",
            ]}
            visual={<DashboardIllustration />}
          />
          <ProductDemo
            title="CRM: conheça sua base"
            number="02"
            icon={Users}
            copy="Consulte o histórico de cada contato, organize segmentos e acompanhe tarefas. Diferencie clientes, VIPs e oportunidades de relacionamento."
            points={[
              "Tags, segmentos e filtros de contatos",
              "Compras e histórico de relacionamento",
              "Tarefas e notificações internas",
            ]}
            note="O catálogo configura CRM no Profissional. Envios externos de WhatsApp, SMS e e-mail ainda dependem de provedores e não estão ativos nesta prévia."
            visual={<CrmIllustration />}
          />
          <ProductDemo
            title="IA SorteX: do dado à próxima ação"
            number="03"
            icon={Bot}
            copy="O Advisor reúne sinais da sua conta para destacar reservas expiradas, pagamentos pendentes e campanhas que merecem atenção. Você decide o que fazer."
            points={[
              "Resumo e alertas com evidências da conta",
              "Simulações com premissas editáveis",
              "Rascunhos de mensagens para revisão",
            ]}
            note="Na prévia, respostas por regras e modelos determinísticos, sem chamadas pagas. Geração por modelo externo exige configuração própria. O catálogo associa IA ao Avançado; projeções não são garantias."
            visual={<AiIllustration />}
          />
        </section>
        <section id="como-funciona" className="sx-campaign-flow">
          <div className="sx-container sx-section">
            <div className="sx-section-heading">
              <div>
                <p className="sx-eyebrow">DA CRIAÇÃO À APURAÇÃO</p>
                <h2>
                  Uma campanha.
                  <br />
                  Etapas bem definidas.
                </h2>
              </div>
              <p>
                Prepare sua operação, acompanhe as vendas e mantenha as regras e
                os registros acessíveis.
              </p>
            </div>
            <ol className="sx-flow-steps">
              {[
                [
                  "01",
                  "Prepare sua conta",
                  "Cadastre PF ou PJ, complete o perfil e acompanhe a análise do organizador.",
                ],
                [
                  "02",
                  "Configure sua campanha",
                  "Defina cotas, valores, período e regras. Revise os detalhes antes da publicação.",
                ],
                [
                  "03",
                  "Acompanhe a operação",
                  "Consulte pedidos e participantes; acompanhe confirmações e indicadores financeiros.",
                ],
                [
                  "04",
                  "Simule e registre",
                  "Revise a fonte do resultado, simule a regra escolhida e consulte o histórico de apuração.",
                ],
              ].map(([n, title, copy]) => (
                <li key={n}>
                  <span>{n}</span>
                  <h3>{title}</h3>
                  <p>{copy}</p>
                </li>
              ))}
            </ol>
            <div className="sx-lottery-panel">
              <div>
                <p className="sx-eyebrow">LOTERIA FEDERAL</p>
                <h3>
                  O resultado é a referência.
                  <br />A regra é da campanha.
                </h3>
                <p>
                  Os números da extração devem ser conferidos na fonte oficial.
                  Na SorteX, o resultado é cadastrado e revisado manualmente; a
                  regra definida para cada campanha determina como esses números
                  serão utilizados.
                </p>
                <p>
                  O sistema oferece configuração de regras, simulação e
                  histórico de apuração. A consulta automática externa está
                  desativada. Não existe parceria ou autorização da Caixa
                  implícita no uso desses recursos.
                </p>
              </div>
              <LotteryIllustration />
            </div>
          </div>
        </section>
        <section className="sx-container sx-section">
          <div className="sx-section-heading">
            <div>
              <p className="sx-eyebrow">MAIS CONTEXTO PARA SUA OPERAÇÃO</p>
              <h2>As peças trabalham juntas.</h2>
            </div>
            <p>
              Recursos existentes, com limites e integrações apresentados de
              forma clara.
            </p>
          </div>
          <div className="sx-extras-grid">
            {[
              [
                ClipboardList,
                "Pedidos e financeiro",
                "Filtros de pedidos, status de pagamento e demonstrativos para acompanhar os registros. Recebimentos e saques reais não estão habilitados nesta prévia.",
              ],
              [
                Network,
                "Afiliados",
                "Módulo com programas, links, conversões e comissões. Previsto no catálogo Profissional; pagamentos reais de comissões dependem de homologação.",
              ],
              [
                Palette,
                "Sua identidade",
                "Nome público, slogan e personalização da campanha. Domínio próprio depende de plano e configuração; a prévia usa endereço provisório.",
              ],
              [
                CreditCard,
                "Integrações de pagamento",
                "Adaptadores e configuração de gateways existentes. Nesta demonstração, todos os pagamentos são simulados: nenhuma cobrança ou liquidação real.",
              ],
            ].map(([Icon, title, copy]) => {
              const FeatureIcon = Icon as typeof ClipboardList;
              return (
                <article key={String(title)}>
                  <FeatureIcon size={23} />
                  <h3>{String(title)}</h3>
                  <p>{String(copy)}</p>
                </article>
              );
            })}
          </div>
        </section>
        <section id="planos" className="sx-plans-background">
          <div className="sx-container sx-section">
            <div className="sx-section-heading">
              <div>
                <p className="sx-eyebrow">PLANOS PARA CADA ETAPA</p>
                <h2>
                  Escolha o próximo passo
                  <br />
                  da sua gestão.
                </h2>
              </div>
              <p>
                Estrutura baseada no catálogo atual. Preços, benefícios e
                limites finais aguardam confirmação comercial; esta prévia não
                realiza contratação.
              </p>
            </div>
            <div className="sx-pricing-grid">
              {plans.map((plan) => (
                <article key={plan.name}>
                  <p className="sx-eyebrow">SORTEX {plan.name.toUpperCase()}</p>
                  <h3>{plan.name}</h3>
                  <p>{plan.text}</p>
                  <div className="sx-plan-price">
                    A confirmar
                    <span>Mensalidade em R$ · periodicidade mensal</span>
                  </div>
                  <ul>
                    {plan.benefits.map((benefit) => (
                      <li key={benefit}>
                        <Check size={15} />
                        {benefit}
                      </li>
                    ))}
                  </ul>
                  <Link
                    className="sx-button sx-button-outline"
                    href="/cadastro/organizador"
                  >
                    Conhecer o plano {plan.name} <ArrowUpRight size={15} />
                  </Link>
                  <small>Benefícios sujeitos à confirmação comercial.</small>
                </article>
              ))}
            </div>
            <p className="sx-plan-disclosure">
              Falta confirmar a mensalidade vigente de Inicial, Profissional,
              Avançado e Empresarial, os limites e as condições de cada opção.
              Eventuais cobranças por uso, processamento e demais condições
              deverão ser informadas antes de qualquer contratação. Nenhum plano
              é ativado por estes botões.
            </p>
          </div>
        </section>
        <section id="duvidas" className="sx-container sx-section sx-faq">
          <div>
            <p className="sx-eyebrow">BOM SABER</p>
            <h2>
              Vamos tirar
              <br />
              suas dúvidas.
            </h2>
            <p>
              Mais contexto para começar
              <br />
              com o perfil certo.
            </p>
            <Link href="/contato" className="sx-card-link">
              Contato <ArrowUpRight size={17} />
            </Link>
          </div>
          <div>
            {faq.map(([question, answer]) => (
              <details key={question}>
                <summary>
                  {question}
                  <ChevronDown size={18} />
                </summary>
                <p>{answer}</p>
              </details>
            ))}
          </div>
        </section>
        <section className="sx-container sx-last-call">
          <div>
            <p className="sx-eyebrow">SEU PRÓXIMO PASSO COMEÇA AQUI</p>
            <h2>
              Vamos colocar sua
              <br />
              campanha em outro nível?
            </h2>
          </div>
          <Link
            href="/cadastro/organizador"
            className="sx-button sx-button-purple"
          >
            Criar conta de organizador <ArrowUpRight size={19} />
          </Link>
        </section>
      </main>
      <footer className="sx-container sx-footer">
        <div>
          <SorteXMark />
          <p>Sua campanha, em outro nível.</p>
        </div>
        <nav aria-label="Links institucionais">
          <Link href="/termos">Termos de uso</Link>
          <Link href="/privacidade">Privacidade</Link>
          <Link href="/contato">Contato</Link>
          <Link href="/login">Entrar</Link>
        </nav>
        <small>© {new Date().getFullYear()} SorteX.</small>
      </footer>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "SoftwareApplication",
            name: "SorteX",
            applicationCategory: "BusinessApplication",
            operatingSystem: "Web",
            description:
              "Plataforma de gestão de campanhas, vendas e relacionamento para organizadores.",
          }),
        }}
      />
    </div>
  );
}

function ProductDemo({
  title,
  number,
  icon: Icon,
  copy,
  points,
  note,
  visual,
}: {
  title: string;
  number: string;
  icon: typeof LayoutDashboard;
  copy: string;
  points: string[];
  note?: string;
  visual: ReactNode;
}) {
  return (
    <article className="sx-demo-row">
      <div className="sx-demo-copy">
        <span className="sx-demo-index">{number} / SORTEX</span>
        <Icon size={30} />
        <h3>{title}</h3>
        <p>{copy}</p>
        <ul>
          {points.map((point) => (
            <li key={point}>
              <Check size={16} />
              {point}
            </li>
          ))}
        </ul>
        {note && <p className="sx-feature-note">{note}</p>}
      </div>
      <div className="sx-demo-visual">{visual}</div>
    </article>
  );
}
