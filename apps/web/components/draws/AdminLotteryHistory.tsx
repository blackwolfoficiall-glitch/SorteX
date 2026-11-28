import { History, ShieldCheck, Trophy } from "lucide-react";
import type { ReactNode } from "react";
import PremiumScope from "@/components/premium/PremiumScope";
import styles from "./admin-lottery-history.module.css";

type Row = Record<string, unknown>;

const statuses = {
  DRAFT: "Rascunho",
  PENDING_REVIEW: "Pendente de revisão",
  VERIFIED: "Verificada",
  REJECTED: "Rejeitada",
  LOCKED: "Bloqueada",
};

const sources = {
  MANUAL: "Cadastro manual",
  IMPORTED: "Importação",
  OFFICIAL_API: "API oficial",
  OFFICIAL_DOCUMENT: "Documento oficial",
};

const prizeFields = [
  "firstPrize",
  "secondPrize",
  "thirdPrize",
  "fourthPrize",
  "fifthPrize",
] as const;

function text(value: unknown): string {
  return typeof value === "string" && value ? value : "";
}

function label(map: Record<string, string>, value: unknown): string {
  const code = text(value);
  return Object.hasOwn(map, code) ? map[code] : code || "Não informado";
}

function drawDate(value: unknown): ReactNode {
  const raw = text(value);
  const iso = /^(\d{4})-(\d{2})-(\d{2})(?:T|$)/.exec(raw);
  return iso ? (
    <time dateTime={iso[0].slice(0, 10)}>
      {iso[3]}/{iso[2]}/{iso[1]}
    </time>
  ) : (
    raw || "Não informada"
  );
}

export default function AdminLotteryHistory({
  forms,
  items,
  message,
  renderReview,
}: {
  forms: ReactNode;
  items: Row[];
  message: string;
  renderReview: (item: Row) => ReactNode;
}) {
  return (
    <PremiumScope className={styles.scope}>
      <section className={styles.content} aria-labelledby="admin-lottery-title">
        <header className={styles.banner}>
          <span className={styles.ticket}>
            <Trophy aria-hidden="true" size={25} />
          </span>
          <div>
            <p className={styles.eyebrow}>Administração da SorteX</p>
            <h1 className="sx-premium-title" id="admin-lottery-title">
              Resultados da Loteria Federal
            </h1>
            <p className={styles.muted}>
              Cadastro manual ou importação da CAIXA, com revisão
              administrativa.
            </p>
          </div>
        </header>
        <div className={styles.forms}>{forms}</div>
        {message && (
          <p role="status" className={styles.notice}>
            {message}
          </p>
        )}
        <section
          className={styles.history}
          aria-labelledby="admin-lottery-history-title"
        >
          <h2 className={styles.heading} id="admin-lottery-history-title">
            <History aria-hidden="true" size={20} /> Registros
          </h2>
          {items.length ? (
            <ul className={styles.list} aria-label="Histórico de extrações">
              {items.map((item, index) => {
                const status = text(item.status);
                const originals = Array.isArray(item.sourcePrizes)
                  ? item.sourcePrizes.filter(
                      (value): value is string => typeof value === "string",
                    )
                  : [];
                return (
                  <li key={String(item.id ?? index)} className={styles.row}>
                    <div className={styles.rowHead}>
                      <h3>
                        {text(item.extractionNumber)
                          ? `Extração ${text(item.extractionNumber)}`
                          : "Extração sem número informado"}
                      </h3>
                      <span className={styles.status} data-status={status}>
                        {label(statuses, status)}
                      </span>
                    </div>
                    <dl className={styles.metadata}>
                      <div>
                        <dt>Data da extração</dt>
                        <dd>{drawDate(item.drawDate)}</dd>
                      </div>
                      <div>
                        <dt>Origem registrada</dt>
                        <dd>{label(sources, item.sourceType)}</dd>
                      </div>
                    </dl>
                    <dl
                      className={styles.prizes}
                      aria-label="Cinco prêmios da extração"
                    >
                      {prizeFields.map((key, index) => (
                        <div key={key}>
                          <dt>{index + 1}º prêmio</dt>
                          <dd>{text(item[key]) || "Não informado"}</dd>
                        </div>
                      ))}
                    </dl>
                    {!!originals.length && (
                      <div className={styles.originals}>
                        <h4>Valores originais da fonte</h4>
                        <ol>
                          {originals.map((value, index) => (
                            <li key={index}>{value}</li>
                          ))}
                        </ol>
                      </div>
                    )}
                    <details className={styles.audit}>
                      <summary>
                        <ShieldCheck aria-hidden="true" size={17} /> Dados para
                        auditoria
                      </summary>
                      <pre>{JSON.stringify(item, null, 2)}</pre>
                    </details>
                    <div className={styles.review}>{renderReview(item)}</div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className={styles.muted}>Nenhum registro disponível.</p>
          )}
        </section>
      </section>
    </PremiumScope>
  );
}
