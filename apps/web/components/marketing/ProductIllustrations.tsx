import {
  BarChart3,
  Bot,
  Check,
  Layers3,
  Sparkles,
  Users,
  Workflow,
} from "lucide-react";

const disclosure = "Ilustração demonstrativa · dados fictícios";

/** Editorial illustrations only: static examples, no API, accounts or operational controls. */
export function DashboardIllustration({ hero = false }: { hero?: boolean }) {
  return (
    <figure
      className={`sx-illustration sx-illustration-dashboard ${hero ? "sx-illustration-hero" : ""}`}
      data-illustration="dashboard"
      aria-label="Ilustração do dashboard inteligente"
    >
      <div className="sx-illustration-body">
        <div className="sx-visual-heading">
          <span>
            <BarChart3 size={17} aria-hidden="true" /> Visão da operação
          </span>
          <span className="sx-visual-badge">Exemplo</span>
        </div>
        <div className="sx-visual-kpis">
          <div>
            <span>Vendas no exemplo</span>
            <strong>
              R$ 48.750<span>,00</span>
            </strong>
          </div>
          <div>
            <span>Campanhas ativas</span>
            <strong>
              03 <Layers3 size={20} aria-hidden="true" />
            </strong>
          </div>
        </div>
        <div className="sx-visual-chart">
          <div>
            <span>Evolução das vendas</span>
            <small>Acumulado fictício</small>
          </div>
          <svg
            viewBox="0 0 420 114"
            role="img"
            aria-label="Evolução fictícia acumulada: R$ 6.200, R$ 16.000, R$ 30.350 e R$ 48.750"
          >
            <path
              d="M8 20H412M8 60H412M8 100H412"
              stroke="#e9e3f1"
              strokeWidth="1"
              strokeDasharray="4 5"
            />
            <path d="M8 98L142 77L276 48L412 10V110H8Z" fill="#ede3ff" />
            <path
              d="M8 98L142 77L276 48L412 10"
              fill="none"
              stroke="#8950ec"
              strokeWidth="3.5"
              strokeLinejoin="round"
            />
            {[
              [8, 98],
              [142, 77],
              [276, 48],
              [412, 10],
            ].map(([cx, cy]) => (
              <circle
                key={cx}
                cx={cx}
                cy={cy}
                r="4"
                fill="#8950ec"
                stroke="white"
                strokeWidth="2"
              />
            ))}
          </svg>
          <div className="sx-chart-axis">
            <span>Semana 1</span>
            <span>Semana 2</span>
            <span>Semana 3</span>
            <span>Semana 4</span>
          </div>
        </div>
        <div className="sx-visual-campaigns">
          <span className="sx-visual-label">Vendas por campanha</span>
          {[
            ["Aurora", "R$ 19.500", 40],
            ["Horizonte", "R$ 17.550", 36],
            ["Essência", "R$ 11.700", 24],
          ].map(([name, amount, progress]) => (
            <div key={name}>
              <span>{name}</span>
              <i aria-hidden="true">
                <b style={{ width: `${progress}%` }} />
              </i>
              <strong>{amount}</strong>
            </div>
          ))}
        </div>
      </div>
      <figcaption>{disclosure}</figcaption>
    </figure>
  );
}

export function CrmIllustration() {
  return (
    <figure
      className="sx-illustration sx-illustration-crm"
      data-illustration="crm"
      aria-label="Ilustração do CRM SorteX"
    >
      <div className="sx-illustration-body">
        <div className="sx-visual-heading">
          <span>
            <Users size={17} aria-hidden="true" /> Relacionamentos
          </span>
          <span className="sx-visual-badge">1.370 contatos</span>
        </div>
        <div className="sx-crm-composition">
          <div className="sx-contact-stack">
            <span className="sx-visual-label">Cada contato, um contexto</span>
            {[
              ["LD", "Luiza Demo", "VIP"],
              ["CD", "Caio Demo", "Cliente"],
              ["ND", "Nina Demo", "Lead"],
            ].map(([initials, name, status]) => (
              <div className="sx-contact" key={name}>
                <span className="sx-contact-avatar">{initials}</span>
                <div>
                  <strong>{name}</strong>
                  <small>
                    {status === "Lead"
                      ? "Interesse registrado"
                      : "Histórico de compras"}
                  </small>
                </div>
                <span className="sx-contact-status">{status}</span>
              </div>
            ))}
          </div>
          <div className="sx-segment-stack">
            <span className="sx-visual-label">Segmentos da base</span>
            <div className="sx-segment-orbit">
              <svg viewBox="0 0 100 100" aria-hidden="true">
                <circle
                  cx="50"
                  cy="50"
                  r="39"
                  fill="none"
                  stroke="#eee8f6"
                  strokeWidth="10"
                />
                <circle
                  cx="50"
                  cy="50"
                  r="39"
                  fill="none"
                  stroke="#8851e5"
                  strokeWidth="10"
                  strokeDasharray="223.5 245"
                  transform="rotate(-90 50 50)"
                />
              </svg>
              <span>
                <strong>1.250</strong>
                <small>Compradores</small>
              </span>
            </div>
            <div className="sx-segment-pills">
              <span>125 VIPs</span>
              <span>100 leads</span>
            </div>
          </div>
        </div>
        <div className="sx-relationship-opportunity">
          <Sparkles size={18} aria-hidden="true" />
          <div>
            <strong>Uma oportunidade para acompanhar</strong>
            <span>12 reservas expiradas para revisar com contexto.</span>
          </div>
        </div>
      </div>
      <figcaption>{disclosure}</figcaption>
    </figure>
  );
}

export function AiIllustration() {
  return (
    <figure
      className="sx-illustration sx-illustration-ai"
      data-illustration="ai"
      aria-label="Ilustração de conversa e recomendações da IA SorteX"
    >
      <div className="sx-illustration-body">
        <div className="sx-visual-heading">
          <span>
            <Bot size={18} aria-hidden="true" /> IA SorteX
          </span>
          <span className="sx-visual-badge">Conversa ilustrativa</span>
        </div>
        <div className="sx-chat-question">
          <span>Pergunta de exemplo</span>
          <p>Como estão minhas campanhas?</p>
        </div>
        <div className="sx-chat-answer">
          <span>
            <Sparkles size={14} aria-hidden="true" /> SorteX Advisor · exemplo
          </span>
          <p>
            Neste exemplo, <strong>3 campanhas ativas</strong> e{" "}
            <strong>R$ 48.750</strong> em vendas.
          </p>
        </div>
        <div className="sx-ai-recommendation">
          <span className="sx-visual-label">
            Prioridade sugerida no exemplo
          </span>
          <strong>Revisar 12 reservas expiradas</strong>
          <p>Consulte os contatos e revise um rascunho antes de enviar.</p>
        </div>
        <div className="sx-ai-confirmation">
          <Check size={15} aria-hidden="true" /> Você revisa. Você decide.
          Nenhum envio automático.
        </div>
      </div>
      <figcaption>{disclosure}</figcaption>
    </figure>
  );
}

export function LotteryIllustration() {
  return (
    <figure
      className="sx-illustration sx-illustration-lottery"
      data-illustration="lottery"
      aria-label="Ilustração de uma regra de apuração com resultado fictício"
    >
      <div className="sx-illustration-body">
        <div className="sx-visual-heading">
          <span>
            <Workflow size={17} aria-hidden="true" /> Da referência à regra
          </span>
          <span className="sx-visual-badge">Exemplo</span>
        </div>
        <div className="sx-lottery-reference">
          <div>
            <span>1º prêmio fictício</span>
            <strong>
              71<em>342</em>
            </strong>
          </div>
          <p>
            Últimos 3 dígitos
            <br />
            <span>Centena · dezena · unidade</span>
          </p>
        </div>
        <div className="sx-rule-path">
          <div>
            <span>01 / ORIGEM</span>
            <strong>1º prêmio</strong>
            <small>Resultado manual</small>
          </div>
          <div>
            <span>02 / REGRA</span>
            <strong>3 dígitos</strong>
            <small>1.000 números</small>
          </div>
          <div>
            <span>03 / SIMULAÇÃO</span>
            <strong>342</strong>
            <small>Número do exemplo</small>
          </div>
        </div>
        <div className="sx-rule-options">
          <span>Prêmio de origem</span>
          <span>Posição dos dígitos</span>
          <span>Normalização</span>
        </div>
        <p className="sx-lottery-explanation">
          Exemplo de seleção de dígitos disponível no motor de regras. O
          resultado oficial deve ser conferido na fonte; esta ilustração não
          executa uma apuração e não representa vínculo com a Caixa.
        </p>
      </div>
      <figcaption>{disclosure}</figcaption>
    </figure>
  );
}
