import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Boxes,
  CalendarDays,
  ExternalLink,
  Ticket,
  Trophy,
} from "lucide-react";
import { MiniCampaignReserve } from "@/components/organizer-platform/MiniCampaignReserve";
import PremiumScope from "@/components/premium/PremiumScope";
import { resolveApiUpstream } from "@/lib/api-upstream";
import styles from "./public-mini-campaign.module.css";

const money = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});
type Item = {
  name: string;
  description: string | null;
  imageUrl: string | null;
  prizeDescription: string;
  maxTickets: number;
  soldTickets: number;
  availableTickets: number;
  ticketPrice: number;
  drawAt: string | null;
  rules: string;
  mainCampaign: { title: string; slug: string };
  organizer: { publicName: string; primaryColor: string } | null;
  result: null | { winningNumber: number; winner: null | { name: string } };
};

async function load(slug: string) {
  const response = await fetch(
    `${resolveApiUpstream()}/public/mini-campaigns/${encodeURIComponent(slug)}`,
    { cache: "no-store" },
  );
  if (response.status === 404) notFound();
  if (!response.ok)
    throw new Error("Não foi possível carregar esta Mini Campanha.");
  return response.json() as Promise<Item>;
}

export default async function Page({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const item = await load(slug);
  const percentage = item.maxTickets
    ? Math.min(100, Math.round((item.soldTickets / item.maxTickets) * 100))
    : 0;
  return (
    <PremiumScope className={styles.scope}>
      <main className={styles.content} aria-label="Mini Campanha pública">
        <header className={styles.top}>
          <Link href="/" className={styles.brand}>
            SorteX
          </Link>
          {item.organizer?.publicName && (
            <span>{item.organizer.publicName}</span>
          )}
        </header>

        <article className={styles.panel}>
          {item.imageUrl && (
            // Preserve existing uploaded and remote Mini Campaign image sources.
            // eslint-disable-next-line @next/next/no-img-element
            <img src={item.imageUrl} alt={item.name} className={styles.cover} />
          )}
          <div className={styles.body}>
            <header className={styles.intro}>
              <span className={styles.icon}>
                <Boxes size={23} aria-hidden="true" />
              </span>
              <div>
                <p className={styles.eyebrow}>Mini Campanha</p>
                <h1 className="sx-premium-title">{item.name}</h1>
                <p className={styles.muted}>
                  {item.description || item.prizeDescription}
                </p>
              </div>
            </header>
            <dl className={styles.metrics}>
              <div>
                <Trophy aria-hidden="true" size={19} />
                <dt>Prêmio</dt>
                <dd>{item.prizeDescription}</dd>
              </div>
              <div>
                <Ticket aria-hidden="true" size={19} />
                <dt>Valor do título</dt>
                <dd>{money.format(item.ticketPrice)}</dd>
              </div>
              <div>
                <CalendarDays aria-hidden="true" size={19} />
                <dt>Sorteio</dt>
                <dd>
                  {item.drawAt
                    ? new Date(item.drawAt).toLocaleString("pt-BR")
                    : "A definir"}
                </dd>
              </div>
            </dl>
            <div className={styles.progress}>
              <div className={styles.progressLabels}>
                <span>{percentage}% reservado</span>
                <span>{item.availableTickets} disponíveis</span>
              </div>
              <div
                className={styles.track}
                role="progressbar"
                aria-label="Percentual reservado"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={percentage}
              >
                <div
                  className={styles.fill}
                  style={{
                    width: `${percentage}%`,
                    backgroundColor: item.organizer?.primaryColor,
                  }}
                />
              </div>
            </div>

            {item.result ? (
              <div className={styles.result}>
                <b>Resultado registrado</b>
                <p>
                  Número vencedor: {item.result.winningNumber}.{" "}
                  {item.result.winner &&
                    `Ganhador: ${item.result.winner.name}.`}
                </p>
              </div>
            ) : (
              <>
                <div className={styles.testNotice}>
                  <b>Ambiente de teste</b>
                  <p>Nenhum pagamento real é processado nesta etapa.</p>
                </div>
                <div className={styles.reserve}>
                  <MiniCampaignReserve
                    slug={slug}
                    available={item.availableTickets}
                  />
                </div>
              </>
            )}

            <details className={styles.rules}>
              <summary>Regras</summary>
              <p>{item.rules}</p>
            </details>
            <Link
              href={`/campanha/${item.mainCampaign.slug}`}
              className="sx-premium-button"
              data-variant="primary"
            >
              Ver campanha principal{" "}
              <ExternalLink size={16} aria-hidden="true" />
            </Link>
          </div>
        </article>
      </main>
    </PremiumScope>
  );
}
