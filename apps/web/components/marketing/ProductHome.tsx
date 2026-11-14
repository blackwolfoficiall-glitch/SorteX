import Link from "next/link";
import Image from "next/image";
import {
  ArrowDown,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Check,
  ChevronDown,
  ClipboardList,
  Layers3,
  LayoutDashboard,
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
    Layers3,
    "Campanhas",
    "Configure os detalhes, acompanhe o andamento e mantenha cada campanha no seu lugar.",
  ],
  [
    Users,
    "Participantes",
    "Consulte participantes e pedidos, com status e informações disponíveis no painel.",
  ],
  [
    BarChart3,
    "Vendas e relatórios",
    "Acompanhe os indicadores e registros da campanha sem perder a visão do conjunto.",
  ],
  [
    Workflow,
    "Sorteios e resultados",
    "Defina as regras disponíveis e acompanhe a apuração e os resultados registrados.",
  ],
] as const;
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
    "As condições comerciais devem ser confirmadas antes de contratar ou publicar uma campanha. Esta página não oferece planos nem apresenta preços ainda não validados para lançamento.",
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
            <a href="#duvidas">Dúvidas</a>
          </nav>
          <nav aria-label="Acesso à conta" className="sx-access-nav">
            <Link href="/login">Entrar</Link>
            <Link href="/cadastro" className="sx-button sx-button-white">
              Criar conta <ArrowUpRight size={16} />
            </Link>
          </nav>
        </header>
      </div>
      <main id="conteudo">
        <div className="sx-dark-top">
          <section className="sx-container sx-hero">
            <div className="sx-hero-copy">
              <p className="sx-eyebrow">
                <span className="sx-live-dot" />
                UMA NOVA VISÃO PARA SUAS CAMPANHAS
              </p>
              <h1>
                Sua campanha,
                <br />
                em outro <em>nível.</em>
              </h1>
              <p className="sx-lead">
                Da primeira ideia ao acompanhamento dos resultados. Um espaço
                para organizar, participar e seguir cada etapa.
              </p>
              <div className="sx-hero-actions">
                <Link
                  className="sx-button sx-button-purple"
                  href="/cadastro/organizador"
                >
                  Quero organizar <ArrowUpRight size={18} />
                </Link>
                <Link className="sx-quiet-link" href="/cadastro/comprador">
                  Quero participar <ArrowRight size={17} />
                </Link>
              </div>
              <a className="sx-discover" href="#por-dentro">
                <span>
                  <ArrowDown size={15} />
                </span>
                Veja a SorteX por dentro
              </a>
            </div>
            <div className="sx-product-stage">
              <div className="sx-stage-label">
                <span>
                  <LayoutDashboard size={15} />
                  Seu espaço de gestão
                </span>
                <span className="sx-small-tag">Interface real</span>
              </div>
              <div className="sx-screen sx-screen-hero">
                <div className="sx-window-bar">
                  <span />
                  <span />
                  <span />
                  <i>sortex · painel do organizador</i>
                </div>
                <Image
                  src="/product/dashboard-preview.png"
                  width={1440}
                  height={470}
                  priority
                  alt="Captura real do painel do organizador SorteX em ambiente de teste"
                />
              </div>
              <div className="sx-stage-caption">
                <span>
                  <Check size={14} /> Campanhas
                </span>
                <span>
                  <Check size={14} /> Participantes
                </span>
                <span>
                  <Check size={14} /> Resultados
                </span>
              </div>
              <p className="sx-demo-note">
                Captura da plataforma. Ambiente de demonstração com dados
                sintéticos.
              </p>
            </div>
          </section>
          <div className="sx-container sx-capabilities">
            <span>
              Uma plataforma.
              <br />
              <strong>Dois jeitos de fazer parte.</strong>
            </span>
            <div>
              <Layers3 size={20} />
              Gestão de campanhas
            </div>
            <div>
              <Ticket size={20} />
              Área do comprador
            </div>
            <div>
              <ClipboardList size={20} />
              Acompanhamento e registros
            </div>
          </div>
        </div>
        <section id="por-dentro" className="sx-container sx-section">
          <div className="sx-section-heading">
            <div>
              <p className="sx-eyebrow">MENOS DISPERSÃO. MAIS VISÃO.</p>
              <h2>
                O próximo passo da sua campanha
                <br className="hidden md:block" /> começa com organização.
              </h2>
            </div>
            <p>
              Informações conectadas, caminhos claros e uma interface pensada
              para o dia a dia de quem organiza e de quem participa.
            </p>
          </div>
          <div className="sx-bento">
            <article className="sx-campaign-card">
              <div className="sx-card-title">
                <span className="sx-icon-box">
                  <Layers3 size={21} />
                </span>
                <span>01 / ORGANIZAR</span>
              </div>
              <h3>
                Uma visão clara.
                <br />
                Cada campanha no seu lugar.
              </h3>
              <p>
                Criação, status e acompanhamento reunidos na área do
                organizador.
              </p>
              <div className="sx-screen sx-screen-secondary">
                <Image
                  src="/product/campaigns-preview.png"
                  width={1440}
                  height={980}
                  alt="Tela real da gestão de campanhas da SorteX, com dados de teste"
                />
              </div>
              <p className="sx-image-credit">
                Interface real da SorteX · dados de teste
              </p>
            </article>
            <div className="sx-bento-side">
              <article className="sx-participant-card">
                <div className="sx-card-title">
                  <span className="sx-icon-box">
                    <Ticket size={21} />
                  </span>
                  <span>02 / PARTICIPAR</span>
                </div>
                <h3>
                  Seus títulos.
                  <br />
                  Seu acompanhamento.
                </h3>
                <p>
                  Acesse as campanhas disponíveis e consulte títulos, pedidos e
                  resultados na sua conta.
                </p>
                <Link href="/cadastro/comprador" className="sx-card-link">
                  Conhecer a área do comprador <ArrowUpRight size={19} />
                </Link>
              </article>
              <article className="sx-profile-card">
                <div className="sx-profile-symbol" aria-hidden="true">
                  X
                </div>
                <div>
                  <p className="sx-eyebrow">DO SEU JEITO</p>
                  <h3>Uma identidade para o seu trabalho.</h3>
                  <p>
                    Nome público, slogan e configurações de perfil no espaço do
                    organizador.
                  </p>
                </div>
              </article>
            </div>
          </div>
        </section>
        <section id="recursos" className="sx-resource-section">
          <div className="sx-container sx-section">
            <p className="sx-eyebrow">FERRAMENTAS QUE TRABALHAM JUNTAS</p>
            <h2>Do detalhe à visão do todo.</h2>
            <div className="sx-resource-grid">
              {resources.map(([Icon, title, copy]) => (
                <article key={title}>
                  <Icon size={25} />
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
        <section id="como-funciona" className="sx-container sx-section">
          <div className="sx-section-heading">
            <div>
              <p className="sx-eyebrow">UM CAMINHO CLARO, DESDE O INÍCIO</p>
              <h2>
                Escolha como você
                <br />
                quer fazer parte.
              </h2>
            </div>
            <Link href="/cadastro" className="sx-button sx-button-outline">
              Encontrar meu perfil <ArrowRight size={17} />
            </Link>
          </div>
          <div className="sx-journeys">
            {[
              {
                title: "Para quem organiza",
                icon: LayoutDashboard,
                href: "/cadastro/organizador",
                action: "Criar conta de organizador",
                steps: [
                  "Cadastre seu perfil PF ou PJ",
                  "Complete as informações e acompanhe a análise",
                  "Configure e acompanhe suas campanhas",
                ],
              },
              {
                title: "Para quem participa",
                icon: Ticket,
                href: "/cadastro/comprador",
                action: "Criar conta de comprador",
                steps: [
                  "Crie sua conta de comprador",
                  "Consulte as campanhas disponíveis",
                  "Acompanhe seus títulos e resultados",
                ],
              },
            ].map(({ title, icon: Icon, href, action, steps }) => (
              <article key={title}>
                <div className="sx-journey-title">
                  <Icon size={24} />
                  <h3>{title}</h3>
                </div>
                <ol>
                  {steps.map((step, i) => (
                    <li key={step}>
                      <span>0{i + 1}</span>
                      {step}
                    </li>
                  ))}
                </ol>
                <Link href={href}>
                  {action}
                  <ArrowUpRight size={18} />
                </Link>
              </article>
            ))}
          </div>
        </section>
        <section className="sx-manifesto">
          <div className="sx-container sx-manifesto-inner">
            <p className="sx-eyebrow">SOBRE A SORTEX</p>
            <h2>
              Tecnologia para organizar.
              <br />
              <em>Clareza para acompanhar.</em>
            </h2>
            <p>
              A SorteX conecta a gestão de campanhas à experiência de quem
              participa. Nosso foco é dar a cada perfil um caminho organizado,
              com informações acessíveis e acompanhamento das etapas.
            </p>
            <div className="sx-manifesto-bottom">
              <span>
                Campanhas com identidade.
                <br />
                Gestão com contexto.
              </span>
              <Link href="/login" className="sx-button sx-button-white">
                Acessar a plataforma <ArrowUpRight size={18} />
              </Link>
            </div>
          </div>
        </section>
        <section id="planos" className="sx-container sx-plan-section">
          <div>
            <p className="sx-eyebrow">PLANOS E CONDIÇÕES</p>
            <h2>Conheça antes de decidir.</h2>
          </div>
          <div>
            <p>
              Os planos e as condições comerciais serão apresentados e
              confirmados antes de qualquer contratação. Esta página não
              habilita cobranças.
            </p>
            <Link href="/contato" className="sx-card-link">
              Informações de contato <ArrowUpRight size={17} />
            </Link>
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
          <Link href="/cadastro" className="sx-button sx-button-purple">
            Começar meu cadastro <ArrowUpRight size={19} />
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
            description: "Plataforma para gestão e participação em campanhas.",
          }),
        }}
      />
    </div>
  );
}
