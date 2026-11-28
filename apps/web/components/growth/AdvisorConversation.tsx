"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  ArrowUpRight,
  Bot,
  CircleAlert,
  LoaderCircle,
  LockKeyhole,
  Send,
  Sparkles,
} from "lucide-react";
import { AuthApiError } from "@/lib/auth/client";
import { askAdvisor, type AdvisorAnswer } from "@/lib/growth/client";
import { AdvisorConfirmAction } from "./AdvisorConfirmAction";
import ui from "./advisor-premium.module.css";

const prompts = [
  {
    question: "Como estão minhas vendas?",
    title: "Desempenho das vendas",
    external: true,
  },
  { question: "Como está meu CRM?", title: "Visão do CRM", external: true },
  {
    question: "Como está meu financeiro?",
    title: "Histórico financeiro",
    external: true,
  },
  {
    question: "Qual a origem das vendas?",
    title: "Origem das vendas",
    external: true,
  },
  { question: "Qual promoção devo criar?", title: "Promoções", external: true },
  {
    question: "Como recuperar reservas abandonadas?",
    title: "Recuperação de reservas",
    external: true,
  },
  {
    question: "Quantas reservas abandonadas existem?",
    title: "Total de reservas abandonadas",
    external: false,
  },
  {
    question: "Qual horário devo divulgar?",
    title: "Melhor horário",
    external: false,
  },
] as const;
export const MAX_ADVISOR_QUESTION = 600;

type ChatEntry =
  | { id: number; role: "user"; text: string }
  | { id: number; role: "assistant"; answer: AdvisorAnswer };
type ConversationError = {
  kind: "quota" | "session" | "request";
  question: string;
};

function safeError(cause: unknown, question: string): ConversationError {
  if (cause instanceof AuthApiError) {
    if (
      cause.status === 429 &&
      cause.message.includes("O limite diário da IA SorteX foi atingido.")
    )
      return { kind: "quota", question };
    if (cause.status === 401) return { kind: "session", question };
  }
  return { kind: "request", question };
}
const errorCopy: Record<
  ConversationError["kind"],
  { title: string; body: string }
> = {
  quota: {
    title: "Limite da IA SorteX atingido.",
    body: "O limite local é renovado às 00h UTC. Você pode continuar usando as regras locais sem IA externa.",
  },
  session: {
    title: "Sua sessão expirou.",
    body: "Entre novamente para continuar. O histórico desta conversa não é salvo.",
  },
  request: {
    title: "Não foi possível responder.",
    body: "Sua pergunta ficou nesta conversa. Você pode editá-la antes de enviar novamente.",
  },
};

export default function AdvisorConversation({
  pilotAvailable,
  active,
}: {
  pilotAvailable: boolean;
  active: boolean;
}) {
  const [consent, setConsent] = useState(false);
  const [question, setQuestion] = useState("");
  const [items, setItems] = useState<ChatEntry[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<ConversationError | null>(null);
  const next = useRef(0);
  const sending = useRef(false);
  const log = useRef<HTMLOListElement>(null);
  const composer = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (active && log.current) log.current.scrollTop = log.current.scrollHeight;
  }, [active, items]);

  async function submit(
    event: FormEvent<HTMLFormElement> | null,
    preset?: string,
  ) {
    event?.preventDefault();
    const value = (preset ?? question).trim();
    if (
      !active ||
      sending.current ||
      value.length < 3 ||
      value.length > MAX_ADVISOR_QUESTION
    )
      return;
    // Only the displayed fixed options may ask to use a provider; free text
    // always asks for the local rules. Server approval still decides egress.
    const allowAi =
      pilotAvailable &&
      consent &&
      prompts.some((item) => item.external && item.question === value);
    sending.current = true;
    setBusy(true);
    setError(null);
    const id = ++next.current;
    setItems((current) => [...current, { id, role: "user", text: value }]);
    setQuestion("");
    try {
      const answer = await askAdvisor(value, allowAi);
      setItems((current) => [
        ...current,
        { id: id + 0.5, role: "assistant", answer },
      ]);
    } catch (cause) {
      const failed = safeError(cause, value);
      setError(failed);
      if (failed.kind === "quota") setConsent(false);
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }

  return (
    <section
      className={ui.chatGrid}
      aria-label="Conversa e sugestões do Advisor"
    >
      <div className={`sx-premium-surface ${ui.conversation}`}>
        <header className={ui.conversationHeader}>
          <div className={ui.headingWithIcon}>
            <span className={ui.icon} aria-hidden="true">
              <Bot size={23} />
            </span>
            <div>
              <p className={ui.eyebrow}>Copilot da operação</p>
              <h2 className="sx-premium-section">Converse com seu consultor</h2>
            </div>
          </div>
          {pilotAvailable ? (
            <label className={ui.consent}>
              <input
                type="checkbox"
                checked={consent}
                onChange={(event) => setConsent(event.target.checked)}
              />
              <span>
                <strong>
                  Usar IA externa em perguntas rápidas compatíveis
                </strong>
                <small>
                  Somente indicadores fictícios agregados. Perguntas de texto
                  livre usam regras locais.
                </small>
              </span>
            </label>
          ) : (
            <p className={ui.privacy}>
              <LockKeyhole size={17} aria-hidden="true" />
              Provedor de IA indisponível nesta conta. As respostas usam regras
              locais.
            </p>
          )}
        </header>
        {items.length === 0 ? (
          <div className={ui.chatEmpty}>
            <span className={ui.welcomeIcon} aria-hidden="true">
              <Sparkles size={30} />
            </span>
            <h3 className="sx-premium-section">
              Pergunte sobre a sua operação
            </h3>
            <p>
              Comece por uma pergunta rápida ou escreva a sua. Nenhuma ação é
              executada automaticamente.
            </p>
          </div>
        ) : (
          <ol
            className={ui.history}
            ref={log}
            role="log"
            aria-label="Histórico desta conversa"
            aria-live="polite"
            aria-relevant="additions"
          >
            {items.map((item) => (
              <li key={item.id} className={ui.entry} data-author={item.role}>
                <span className={ui.speaker}>
                  {item.role === "user" ? "Você" : "SorteX Advisor"}
                </span>
                {item.role === "user" ? (
                  <p className={ui.entryText}>{item.text}</p>
                ) : (
                  <AdvisorReply answer={item.answer} />
                )}
              </li>
            ))}
          </ol>
        )}
        {busy && (
          <p className={ui.chatBusy} role="status">
            <LoaderCircle size={17} aria-hidden="true" className={ui.spinner} />
            Analisando sua pergunta…
          </p>
        )}
        {error && (
          <div className={ui.chatError} role="alert">
            <CircleAlert size={19} aria-hidden="true" />
            <div>
              <strong>{errorCopy[error.kind].title}</strong>
              <p>{errorCopy[error.kind].body}</p>
              {error.kind !== "session" && (
                <button
                  type="button"
                  className={ui.editQuestion}
                  onClick={() => {
                    setQuestion(error.question);
                    composer.current?.focus();
                  }}
                >
                  Editar a pergunta
                </button>
              )}
            </div>
          </div>
        )}
        <form onSubmit={(event) => void submit(event)} className={ui.composer}>
          <label htmlFor="advisor-question">Sua pergunta</label>
          <div className={ui.composerRow}>
            <textarea
              id="advisor-question"
              ref={composer}
              rows={2}
              value={question}
              maxLength={MAX_ADVISOR_QUESTION}
              onChange={(event) => setQuestion(event.target.value)}
              placeholder="Pergunte sobre campanhas, vendas ou clientes..."
            />
            <button
              type="submit"
              disabled={busy || question.trim().length < 3}
              className="sx-premium-button"
              data-variant="primary"
            >
              <Send size={17} aria-hidden="true" />
              <span>Enviar pergunta</span>
            </button>
          </div>
          <p>
            O histórico fica disponível nesta visita e é apagado ao sair ou
            recarregar.
          </p>
        </form>
      </div>
      <aside
        className={`sx-premium-surface ${ui.promptRail}`}
        aria-label="Perguntas rápidas"
      >
        <header>
          <p className={ui.eyebrow}>Comece por aqui</p>
          <h2 className="sx-premium-section">Perguntas rápidas</h2>
          <p>Abra um assunto sem precisar digitar.</p>
        </header>
        <ul>
          {prompts.map((prompt) => (
            <li key={prompt.question}>
              <button
                type="button"
                disabled={busy}
                onClick={() => void submit(null, prompt.question)}
                className={ui.prompt}
                aria-label={prompt.question}
              >
                <span>
                  <strong>{prompt.title}</strong>
                  <small>{prompt.question}</small>
                </span>
                <ArrowUpRight size={17} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      </aside>
    </section>
  );
}

function AdvisorReply({ answer }: { answer: AdvisorAnswer }) {
  const via =
    answer.mode === "GEMINI"
      ? "Google Gemini"
      : answer.mode === "OPENAI"
        ? "OpenAI"
        : null;
  return (
    <>
      <p className={ui.entryText}>{answer.answer}</p>
      {answer.evidence.length > 0 && (
        <ul className={ui.evidence} aria-label="Evidências da resposta">
          {answer.evidence.map((evidence, index) => (
            <li key={index} className="sx-premium-badge">
              {evidence}
            </li>
          ))}
        </ul>
      )}
      {answer.actions.length > 0 && (
        <div className={ui.actions}>
          {answer.actions.map((action, index) => (
            <AdvisorConfirmAction key={index} action={action} />
          ))}
        </div>
      )}
      <p className={ui.origin} data-source={via ? "external" : "local"}>
        {via
          ? `Resposta gerada pelo ${via} com dados fictícios agregados`
          : "Resposta de regras locais, sem IA externa"}
      </p>
      {answer.mode === "DETERMINISTIC" &&
        answer.fallbackReason === "PROVIDER_RATE_LIMIT" && (
          <p className={ui.providerLimit} role="status">
            O provedor externo atingiu um limite de uso. Esta resposta foi
            gerada apenas pelas regras locais.
          </p>
        )}
    </>
  );
}
