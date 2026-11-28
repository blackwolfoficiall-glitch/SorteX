"use client";

import { type FormEvent, useEffect, useState } from "react";
import { CalendarDays, LifeBuoy, LoaderCircle, MessageSquare, Plus } from "lucide-react";
import { useAuthorizedUser } from "@/components/auth/RoleGate";
import PremiumScope from "@/components/premium/PremiumScope";
import { authRequest } from "@/lib/auth/client";
import styles from "./buyer-support-premium.module.css";

const categories = [
  ["ACCOUNT", "Conta"], ["CAMPAIGN", "Campanha"], ["PAYMENT", "Pagamento"],
  ["PRIZE", "Prêmio"], ["TECHNICAL", "Técnico"], ["OTHER", "Outro"],
] as const;
type Category = typeof categories[number][0];
type Ticket = { id: string; subject: string; description: string; status: string; category: string; updatedAt: string };
type History = { attempt: number } & ({ items: Ticket[] } | { failed: true });
const statuses: Record<string, string> = {
  OPEN: "Aberto", IN_PROGRESS: "Em andamento", WAITING_USER: "Aguardando sua resposta", RESOLVED: "Resolvido", CLOSED: "Encerrado",
};
const date = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short", timeZone: "America/Sao_Paulo" });

export default function BuyerSupportPage() {
  const user = useAuthorizedUser();
  return (
    <PremiumScope className={styles.page}>
      <div className={styles.wrap}>
        <header className={styles.hero}>
          <div>
            <p className={styles.kicker}>Área do comprador</p>
            <h1>Suporte</h1>
            <p>Abra um chamado e acompanhe os atendimentos da sua conta.</p>
          </div>
          <LifeBuoy size={32} aria-hidden="true" />
        </header>
        {user?.role === "BUYER" ? <BuyerSupport key={user.id} /> : (
          <p className={styles.restricted}>Esta área de suporte é exclusiva para contas de comprador.</p>
        )}
      </div>
    </PremiumScope>
  );
}

function BuyerSupport() {
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState<Category>("ACCOUNT");
  const [attempt, setAttempt] = useState(0);
  const [load, setLoad] = useState<History>();
  const [submission, setSubmission] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const history = load?.attempt === attempt ? load : undefined;

  useEffect(() => {
    const aborter = new AbortController();
    authRequest<unknown>("/api/buyer/support", { cache: "no-store", signal: aborter.signal })
      .then((data) => {
        if (!aborter.signal.aborted) {
          setLoad(Array.isArray(data) ? { attempt, items: data } : { attempt, failed: true });
        }
      })
      .catch(() => { if (!aborter.signal.aborted) setLoad({ attempt, failed: true }); });
    return () => aborter.abort();
  }, [attempt]);

  function reload() { setAttempt((value) => value + 1); }
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submission === "sending") return;
    setSubmission("sending");
    try {
      await authRequest("/api/buyer/support", { method: "POST", body: JSON.stringify({ subject, description, category }) });
      setSubject("");
      setDescription("");
      setSubmission("sent");
      reload();
    } catch {
      setSubmission("error");
    }
  }

  return (
    <div className={styles.grid}>
      <section className={styles.panel} aria-labelledby="new-support">
        <header className={styles.panelHead}>
          <span><Plus size={20} aria-hidden="true" /></span>
          <h2 id="new-support">Novo chamado</h2>
        </header>
        <form onSubmit={submit} className={styles.form}>
          <label>Categoria
            <select value={category} onChange={(event) => setCategory(event.target.value as Category)}>
              {categories.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </label>
          <label>Assunto
            <input required minLength={3} maxLength={160} value={subject} onChange={(event) => setSubject(event.target.value)} />
          </label>
          <label>Descrição
            <textarea required minLength={10} maxLength={5000} value={description} aria-describedby="support-data-hint" onChange={(event) => setDescription(event.target.value)} />
          </label>
          <p id="support-data-hint" className={styles.hint}>Não inclua senhas, códigos de acesso nem dados de cartão.</p>
          {submission === "error" && <p role="alert" className={styles.error}>Não foi possível confirmar o envio. Confira o histórico antes de tentar de novo.</p>}
          {submission === "sent" && <p role="status" className={styles.success}>Chamado enviado.</p>}
          <button type="submit" className={`${styles.button} ${styles.primary}`} disabled={submission === "sending"}>
            {submission === "sending" ? "Enviando chamado…" : "Abrir chamado"}
          </button>
        </form>
      </section>
      <section className={styles.panel} aria-labelledby="support-tickets">
        <header className={styles.panelHead}>
          <span><MessageSquare size={20} aria-hidden="true" /></span>
          <h2 id="support-tickets">Meus chamados</h2>
        </header>
        {!history ? (
          <p role="status" className={styles.state}><LoaderCircle size={17} className={styles.spinner} aria-hidden="true" /> Carregando chamados…</p>
        ) : "failed" in history ? (
          <div className={styles.state}>
            <p role="alert" className={styles.error}>Não foi possível carregar seus chamados.</p>
            <button type="button" className={styles.button} onClick={reload}>Tentar novamente</button>
          </div>
        ) : history.items.length === 0 ? <p className={styles.state}>Você ainda não tem chamados.</p> : (
          <ul className={styles.list} role="list">
            {history.items.map((ticket) => {
              const updated = new Date(ticket.updatedAt);
              const hasDate = Number.isFinite(updated.getTime());
              return (
                <li key={ticket.id}>
                  <span className={styles.badge}>{Object.hasOwn(statuses, ticket.status) ? statuses[ticket.status] : "Situação não informada"}</span>
                  <h3>{ticket.subject}</h3>
                  <p className={styles.description}>{ticket.description}</p>
                  {hasDate && <p className={styles.date}><CalendarDays size={15} aria-hidden="true" /> Atualizado em <time dateTime={ticket.updatedAt}>{date.format(updated)}</time></p>}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
