"use client";

import Image from "next/image";
import Link from "next/link";
import type { CSSProperties } from "react";
import { memo, useEffect, useMemo, useRef, useState } from "react";
import {
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  Gift,
  ImageIcon,
  Info,
  LoaderCircle,
  LockKeyhole,
  Sparkles,
  Ticket,
  Trophy,
} from "lucide-react";
import Card from "@/components/ui/Card";
import PurchasePanel from "@/components/purchases/PurchasePanel";
import type { Campaign, RewardSection } from "@/lib/campaigns/types";
import { mediaUrl } from "./CampaignDashboard";
import { cleanTitle } from "./CampaignShare";
import {
  CampaignBuyerTitlesPanel,
  CampaignPublicFooter,
  CampaignPublicHeader,
} from "./CampaignPublicChrome";

type FoundPrize = {
  winningNumber: string;
  status: string;
  identifiedAt: string;
  buyer: { name?: string; city: string | null; state: string | null };
  instantPrize: { description: string; value: number; type: string };
};
const money = (value: number) =>
  value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

export default function PublicCampaignView({
  slug,
  previewCampaign,
  previewMode = false,
}: {
  slug?: string;
  previewCampaign?: Campaign;
  previewMode?: boolean;
}) {
  const [campaign, setCampaign] = useState<Campaign | null>(
    previewCampaign ?? null,
  );
  const [foundResults, setFoundResults] = useState<FoundPrize[]>([]);
  const [error, setError] = useState("");
  const [selectedImage, setSelectedImage] = useState(0);
  const [showAllAvailable, setShowAllAvailable] = useState(false);
  const [showAllFound, setShowAllFound] = useState(false);
  const [selectedRouletteCombo, setSelectedRouletteCombo] = useState<
    string | null
  >(null);
  const [buyerRounds, setBuyerRounds] = useState<number | null>(null);
  const [showBuyerTitles, setShowBuyerTitles] = useState(false);
  const [autoTitleColor, setAutoTitleColor] = useState("#FFFFFF");
  const dragStart = useRef<number | null>(null);
  useEffect(() => {
    if (previewCampaign) {
      queueMicrotask(() => {
        setCampaign(previewCampaign);
        setFoundResults([]);
      });
      return;
    }
    if (!slug) {
      queueMicrotask(() => setError("Campanha não encontrada."));
      return;
    }
    let active = true;
    fetch(`/api/public/campaigns/${slug}`, { cache: "no-store" })
      .then(async (response) => {
        const payload = await response.json();
        if (!response.ok)
          throw new Error(payload.message || "Campanha não encontrada.");
        return payload as Campaign;
      })
      .then((item) => {
        if (active) setCampaign(item);
      })
      .catch((cause) => {
        if (active)
          setError(
            cause instanceof Error ? cause.message : "Campanha não encontrada.",
          );
      });
    fetch(`/api/draws/public/campaigns/${slug}/instant-prizes`, {
      cache: "no-store",
    })
      .then((response) => (response.ok ? response.json() : []))
      .then((results) => {
        if (active) setFoundResults(results as FoundPrize[]);
      })
      .catch(() => {
        if (active) setFoundResults([]);
      });
    return () => {
      active = false;
    };
  }, [slug, previewCampaign]);
  useEffect(() => {
    if (!slug || previewCampaign) return;
    let active = true;
    const timer = window.setInterval(() => {
      if (document.hidden) return;
      fetch(`/api/public/campaigns/${slug}`, { cache: "no-store" })
        .then(async (response) => (response.ok ? response.json() : null))
        .then((payload) => {
          if (active && payload) setCampaign(payload as Campaign);
        })
        .catch(() => undefined);
    }, 15000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [slug, previewCampaign]);
  const images = useMemo(
    () =>
      campaign
        ? [
            ...(campaign.coverImageUrl
              ? [{ id: "cover", url: campaign.coverImageUrl }]
              : []),
            ...campaign.galleryImages,
          ]
        : [],
    [campaign],
  );
  const selected = images[selectedImage];
  useEffect(() => {
    if (
      images.length < 2 ||
      window.matchMedia("(prefers-reduced-motion: reduce)").matches
    )
      return;
    let timer: number | undefined;
    const stop = () => {
      if (timer !== undefined) {
        window.clearInterval(timer);
        timer = undefined;
      }
    };
    const start = () => {
      stop();
      if (!document.hidden)
        timer = window.setInterval(
          () => setSelectedImage((current) => (current + 1) % images.length),
          5000,
        );
    };
    const onVisibilityChange = () => (document.hidden ? stop() : start());
    start();
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [images.length]);
  useEffect(() => {
    if (!selected || campaign?.titleColorMode !== "AUTO") return;
    const image = new window.Image();
    image.crossOrigin = "anonymous";
    image.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = 48;
        canvas.height = 20;
        const context = canvas.getContext("2d", { willReadFrequently: true });
        if (!context) return;
        context.drawImage(
          image,
          0,
          image.height * 0.55,
          image.width,
          image.height * 0.45,
          0,
          0,
          48,
          20,
        );
        const data = context.getImageData(0, 0, 48, 20).data;
        let light = 0;
        for (let index = 0; index < data.length; index += 4)
          light +=
            data[index] * 0.299 +
            data[index + 1] * 0.587 +
            data[index + 2] * 0.114;
        setAutoTitleColor(
          light / (data.length / 4) > 145 ? "#111111" : "#FFFFFF",
        );
      } catch {
        setAutoTitleColor("#FFFFFF");
      }
    };
    image.src = mediaUrl(selected.url);
  }, [selected, campaign?.titleColorMode]);
  useEffect(() => {
    if (!campaign?.id || previewMode) return;
    let active = true;
    const load = () =>
      fetch(`/api/draws/roulette/campaigns/${campaign.id}/status`, {
        credentials: "include",
        cache: "no-store",
      })
        .then((response) => (response.ok ? response.json() : null))
        .then((value) => {
          if (active)
            setBuyerRounds(
              value && Number(value.availableRounds) > 0
                ? Number(value.availableRounds)
                : null,
            );
        })
        .catch(() => {
          if (active) setBuyerRounds(null);
        });
    void load();
    const timer = window.setInterval(() => {
      if (!document.hidden) void load();
    }, 10000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, [campaign?.id, previewMode]);
  useEffect(() => {
    if (!campaign?.slug || previewMode) return;
    const key = `sortex:campaign-scroll:${campaign.slug}`;
    const stored = sessionStorage.getItem(key);
    if (stored === null) return;
    sessionStorage.removeItem(key);
    const top = Number(stored);
    const timer = window.setTimeout(
      () =>
        window.scrollTo({
          top: Number.isFinite(top) ? top : 0,
          behavior: "auto",
        }),
      80,
    );
    return () => window.clearTimeout(timer);
  }, [campaign?.slug, previewMode]);
  if (error)
    return (
      <main className="flex min-h-screen items-center justify-center bg-zinc-50 p-6 text-center text-red-700">
        {error}
      </main>
    );
  if (!campaign)
    return (
      <main className="flex min-h-screen items-center justify-center">
        <LoaderCircle className="animate-spin text-violet-700" />
      </main>
    );

  const percent = campaign.totalNumbers
    ? Math.min(100, (campaign.soldNumbers / campaign.totalNumbers) * 100)
    : 0;
  const available = campaign.instantPrizes.filter(
    (prize) => prize.status === "AVAILABLE",
  );
  const shownAvailable = available.slice(0, 5);
  const additionalAvailable = available.slice(5);
  const roulette = publicRoulette(campaign.customization?.configuration);
  const rouletteCombos =
    roulette?.rules.map((rule) => {
      const promotion = campaign.promotions.find(
        (item) => item.isActive && item.numberQuantity === rule.minQuantity,
      );
      return {
        ...rule,
        price:
          promotion?.packagePrice ?? rule.minQuantity * campaign.numberPrice,
      };
    }) ?? [];
  const shownFound = showAllFound ? foundResults : foundResults.slice(0, 5);
  const drawRule =
    campaign.drawRuleTemplate?.description ||
    "Regra personalizada registrada na campanha.";
  const accent = campaignAccent(campaign);
  const campaignPreferences = campaign.customization?.configuration;
  const rewardOrder = publicRewardSectionsOrder(campaign.rewardSectionsOrder);
  const titleColor =
    campaign.titleColorMode === "WHITE"
      ? "#FFFFFF"
      : campaign.titleColorMode === "BLACK"
        ? "#111111"
        : campaign.titleColorMode === "BLUE"
          ? "#2563EB"
          : campaign.titleColorMode === "CUSTOM" &&
              validColor(campaign.customTitleColor || "")
            ? campaign.customTitleColor!
            : autoTitleColor;

  return (
    <main
      className="min-h-screen overflow-x-hidden pb-28 text-zinc-950"
      style={{
        backgroundColor: campaign.organizer.brand?.backgroundColor || "#F4F4F5",
        color: campaign.organizer.brand?.textColor || "#18181B",
        fontFamily: String(
          campaignPreferences?.fontFamily || "Inter, system-ui, sans-serif",
        ),
        fontSize:
          campaignPreferences?.fontScale === "LARGE"
            ? "112.5%"
            : campaignPreferences?.fontScale === "COMPACT"
              ? "93.75%"
              : "100%",
      }}
    >
      {previewMode && (
        <div className="sticky top-0 z-[90] bg-amber-400 px-4 py-2 text-center text-xs font-black text-amber-950">
          Modo de pré-visualização — alterações ainda não publicadas.
        </div>
      )}
      <CampaignPublicHeader
        campaign={campaign}
        onOpenTitles={() => setShowBuyerTitles(true)}
      />

      <section className="mx-auto max-w-[1500px] px-2 pt-3 sm:px-4 lg:px-6">
        <div className="overflow-hidden rounded-2xl border bg-white shadow-sm sm:rounded-[26px]">
          <div
            data-testid="campaign-hero"
            className="relative h-[255px] touch-pan-y select-none overflow-hidden bg-zinc-100 sm:h-[360px] lg:h-[500px]"
            onPointerDown={(event) => {
              dragStart.current = event.clientX;
              event.currentTarget.setPointerCapture(event.pointerId);
            }}
            onPointerCancel={() => {
              dragStart.current = null;
            }}
            onPointerUp={(event) => {
              if (dragStart.current === null || images.length < 2) return;
              const distance = event.clientX - dragStart.current;
              if (Math.abs(distance) > 45)
                setSelectedImage(
                  (current) =>
                    (current + (distance < 0 ? 1 : -1) + images.length) %
                    images.length,
                );
              dragStart.current = null;
            }}
          >
            {selected ? (
              <Image
                key={selected.id}
                src={mediaUrl(selected.url)}
                alt={cleanTitle(campaign.title)}
                fill
                priority={selectedImage === 0}
                sizes="(max-width: 640px) 100vw, (max-width: 1536px) 96vw, 1500px"
                className="object-cover [object-position:var(--hero-mobile-position)] [transform:scale(var(--hero-mobile-zoom))] [transform-origin:var(--hero-mobile-position)] transition-[opacity,transform] duration-500 motion-reduce:transition-none sm:[object-position:var(--hero-desktop-position)] sm:[transform:scale(var(--hero-desktop-zoom))] sm:[transform-origin:var(--hero-desktop-position)]"
                style={publicHeroImageStyle(
                  campaign.customization?.configuration,
                )}
                draggable={false}
              />
            ) : (
              <div className="flex h-full items-center justify-center">
                <ImageIcon size={64} className="text-violet-300" />
              </div>
            )}
            <div className="absolute left-3 top-3 w-[34%] sm:left-6 sm:top-6 sm:w-[28%] lg:left-10 lg:top-9 lg:w-[22%]">
              <CampaignCountdown
                drawDate={campaign.drawDate}
                drawTime={campaign.drawTime}
              />
            </div>
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/35 via-black/10 to-transparent px-4 pb-5 pt-20 text-white sm:px-7 sm:pb-7 lg:px-10">
              <div style={{ color: titleColor }}>
                {campaign.titleDisplayMode === "HIGHLIGHT" ? (
                  <div className="max-w-5xl">
                    <p className="text-[9px] font-black uppercase tracking-[0.2em] sm:text-xs">
                      Campanha em destaque
                    </p>
                    <h1 className="mt-1 text-2xl font-black uppercase leading-[.95] tracking-tight drop-shadow sm:text-5xl lg:text-6xl">
                      <PublicCampaignTitle campaign={campaign} />
                    </h1>
                  </div>
                ) : (
                  <h1 className="max-w-4xl text-xl font-bold leading-tight sm:text-4xl lg:text-5xl">
                    <PublicCampaignTitle campaign={campaign} />
                  </h1>
                )}
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2 text-[10px] font-bold sm:text-sm">
                <span className="inline-flex items-center gap-1 rounded-lg bg-black/40 px-2 py-1 sm:backdrop-blur-sm">
                  <CalendarDays size={14} />
                  {campaign.drawDate
                    ? new Date(campaign.drawDate).toLocaleDateString("pt-BR")
                    : "A definir"}{" "}
                  às {campaign.drawTime || "--:--"}
                </span>
                <span className="inline-flex items-center gap-1 rounded-lg bg-black/40 px-2 py-1 sm:backdrop-blur-sm">
                  <Trophy size={14} />
                  {drawBasisLabel(campaign.drawBasis)}
                </span>
              </div>
            </div>
            {images.length > 1 && (
              <div className="absolute bottom-2 right-3 z-10 flex gap-1.5 sm:bottom-4 sm:right-5">
                {images.map((image, index) => (
                  <button
                    key={image.id}
                    aria-label={`Mostrar imagem ${index + 1}`}
                    onClick={() => setSelectedImage(index)}
                    className={`h-1.5 rounded-full transition-all ${selectedImage === index ? "w-6 bg-white" : "w-1.5 bg-white/55"}`}
                  />
                ))}
              </div>
            )}
            {campaign.organizer.verified && (
              <div className="absolute right-3 top-3 flex items-center gap-1.5 rounded-xl bg-black/40 px-3 py-2 text-[9px] font-bold text-white sm:right-5 sm:top-5 sm:text-xs sm:backdrop-blur-sm">
                <CheckCircle2 className="text-green-300" size={15} />{" "}
                Organizador verificado
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-[1500px] px-2 py-3 sm:px-4 lg:px-6">
        <div
          className={`grid overflow-hidden rounded-2xl border bg-white shadow-sm transition-shadow duration-300 hover:shadow-md ${campaign.showParticipants !== false ? "grid-cols-3" : "grid-cols-2"}`}
        >
          <div
            className="p-3 sm:p-5"
            style={{ backgroundColor: hexWithAlpha(accent, "38") }}
          >
            <p className="text-[8px] font-black uppercase text-zinc-800 sm:text-xs">
              Valor da cota
            </p>
            <p className="mt-1 text-lg font-black text-zinc-950 sm:text-3xl">
              {money(campaign.numberPrice)}
            </p>
          </div>
          <div className="border-l p-3 sm:p-5">
            <div className="flex items-center justify-between">
              <p className="text-[8px] font-black uppercase text-zinc-800 sm:text-xs">
                Vendido
              </p>
              <strong className="text-xs sm:text-xl">
                {percent.toFixed(0)}%
              </strong>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-zinc-100 sm:h-3">
              <div
                className="h-full rounded-full bg-green-500 transition-all duration-700"
                style={{ width: `${percent}%` }}
              />
            </div>
          </div>
          {campaign.showParticipants !== false && (
            <div className="border-l p-3 sm:p-5">
              <p className="text-[8px] font-black uppercase text-zinc-800 sm:text-xs">
                Participantes
              </p>
              <p className="mt-1 text-lg font-black sm:text-3xl">
                {(campaign.participantsCount ?? 0).toLocaleString("pt-BR")}
              </p>
            </div>
          )}
        </div>
      </section>

      <section className="mx-auto max-w-[1500px] space-y-3 px-2 sm:space-y-4 sm:px-4 lg:px-6">
        <div id="participar">
          <Card className="p-4 sm:p-7">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-black uppercase tracking-wider text-violet-700 sm:text-xs">
                  Participar
                </p>
                <h2 className="mt-1 text-xl font-black sm:text-2xl">
                  Escolha quantos títulos deseja
                </h2>
              </div>
              <Ticket className="text-violet-600" size={32} />
            </div>
            <div className="mt-5">
              {previewMode ? (
                <div className="rounded-2xl border border-dashed bg-zinc-50 p-5 text-center">
                  <p className="font-black">Área de compra da campanha</p>
                  <p className="mt-1 text-xs text-zinc-500">
                    As ações de compra ficam desativadas durante a
                    pré-visualização.
                  </p>
                  <button
                    type="button"
                    disabled
                    className="mt-4 w-full rounded-xl py-3 font-black text-white opacity-80"
                    style={{ backgroundColor: campaignButtonColor(campaign) }}
                  >
                    {String(
                      campaignPreferences?.buttonText || "Participar agora",
                    )}
                  </button>
                </div>
              ) : (
                <PurchasePanel campaign={campaign} />
              )}
            </div>
          </Card>
        </div>

        <div
          data-testid="reward-sections"
          className="flex flex-col gap-3 sm:gap-4"
        >
          {available.length > 0 && (
            <div
              data-reward-section="INSTANT_WIN"
              style={{ order: rewardOrder.indexOf("INSTANT_WIN") }}
            >
              <Card className="p-4 sm:p-7">
                <div className="flex items-start justify-between gap-3">
                  <SectionTitle
                    icon={<Sparkles />}
                    title="Cotas premiadas disponíveis"
                    subtitle="Confira os números que ainda podem ser premiados."
                  />
                  <SoldBadge percent={percent} />
                </div>
                <div className="mt-4 grid grid-cols-5 gap-1 sm:gap-2">
                  {shownAvailable.map((prize, index) => (
                    <article
                      key={prize.id}
                      className="min-w-0 rounded-lg border bg-white px-1 py-2 text-center shadow-sm sm:rounded-2xl sm:p-4"
                      style={{ borderColor: hexWithAlpha(accent, "66") }}
                    >
                      {prize.imageUrl && (
                        <div className="relative mb-2 hidden h-20 w-full overflow-hidden rounded-lg bg-white sm:block lg:h-28">
                          <Image
                            src={mediaUrl(prize.imageUrl)}
                            alt={prize.description}
                            fill
                            sizes="(max-width: 1024px) 18vw, 270px"
                            className="object-contain"
                          />
                        </div>
                      )}
                      <div className="text-sm sm:text-xl">👑</div>
                      <p
                        className="mt-1 overflow-hidden text-ellipsis rounded border border-dashed px-0.5 py-1 font-mono text-[8px] font-black sm:rounded-lg sm:text-base lg:text-xl"
                        style={{ borderColor: accent }}
                      >
                        {prize.exactNumber}
                      </p>
                      <p className="mt-1 truncate text-[7px] font-black text-green-700 sm:mt-2 sm:text-sm lg:text-lg">
                        {money(prize.value)}
                      </p>
                      <p className="mt-1 text-[6px] font-black uppercase leading-tight text-zinc-600 sm:text-[9px] lg:text-xs">
                        Pode sair
                      </p>
                      <span
                        className="mt-1 inline-flex h-4 w-4 items-center justify-center rounded-full border text-[7px] font-black sm:mt-2 sm:h-6 sm:w-6 sm:text-[10px]"
                        style={{ borderColor: accent, color: accent }}
                      >
                        {index + 1}
                      </span>
                    </article>
                  ))}
                </div>
                {showAllAvailable && additionalAvailable.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {additionalAvailable.map((prize, index) => (
                      <article
                        key={prize.id}
                        className="flex items-center justify-between gap-3 rounded-xl border bg-white p-3 shadow-sm"
                        style={{ borderColor: hexWithAlpha(accent, "66") }}
                      >
                        <div className="min-w-0">
                          <p className="font-mono text-sm font-black sm:text-base">
                            {prize.exactNumber}
                          </p>
                          <p className="text-[10px] font-black uppercase text-zinc-500">
                            Pode sair
                          </p>
                        </div>
                        <p className="ml-auto shrink-0 text-sm font-black text-green-700 sm:text-base">
                          {money(prize.value)}
                        </p>
                        <span
                          className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[10px] font-black"
                          style={{ borderColor: accent, color: accent }}
                        >
                          {index + 6}
                        </span>
                      </article>
                    ))}
                  </div>
                )}
                {additionalAvailable.length > 0 && (
                  <button
                    onClick={() => setShowAllAvailable((value) => !value)}
                    className="mx-auto mt-3 block rounded-xl px-4 py-2 text-sm font-bold"
                    style={{ color: accent }}
                  >
                    {showAllAvailable
                      ? "Mostrar menos"
                      : "Ver mais cotas disponíveis"}
                  </button>
                )}
              </Card>
            </div>
          )}

          {campaign.milestonePrizes.length > 0 && (
            <div
              data-reward-section="MILESTONES"
              style={{ order: rewardOrder.indexOf("MILESTONES") }}
            >
              <CampaignMilestoneTimeline campaign={campaign} />
            </div>
          )}

          {roulette && (
            <div
              data-testid="roulette-combos"
              data-reward-section="ROULETTE"
              style={{ order: rewardOrder.indexOf("ROULETTE") }}
            >
              <Card className="overflow-hidden border-violet-200">
                <div className="bg-gradient-to-br from-violet-50 via-white to-fuchsia-50 p-4 sm:p-7">
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <SectionTitle
                      icon={<span aria-hidden>🎯</span>}
                      title="Roletas instantâneas"
                      subtitle="Escolha um pacote e ganhe giros após a confirmação do pagamento."
                    />
                    <span
                      data-testid="roulette-combos-badge"
                      className="rounded-full px-4 py-2 text-xs font-black uppercase tracking-wide"
                      style={{
                        backgroundColor: campaignButtonColor(campaign),
                        color: readableTextColor(campaignButtonColor(campaign)),
                      }}
                    >
                      Combos
                    </span>
                  </div>
                  {buyerRounds !== null && buyerRounds > 0 && (
                    <div className="mt-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-violet-200 bg-white p-4">
                      <div>
                        <p className="font-black">
                          Você possui {buyerRounds}{" "}
                          {buyerRounds === 1
                            ? "giro disponível"
                            : "giros disponíveis"}
                          .
                        </p>
                        <p className="mt-1 text-xs text-zinc-500">
                          Seus giros ficam separados dos combos de compra.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          window.location.href = "/comprador/meus-premios";
                        }}
                        className="min-h-11 rounded-xl bg-violet-700 px-5 font-black text-white"
                      >
                        Girar agora
                      </button>
                    </div>
                  )}
                  <div className="mt-5 grid gap-3 lg:grid-cols-2">
                    {rouletteCombos.map((combo, index) => {
                      const selectedCombo = selectedRouletteCombo === combo.id;
                      const intensity = [
                        "from-violet-500 to-violet-700",
                        "from-violet-600 to-fuchsia-700",
                        "from-violet-700 to-indigo-950",
                      ][Math.min(index, 2)];
                      return (
                        <button
                          type="button"
                          key={combo.id}
                          disabled={previewMode}
                          aria-label={`Combo de ${combo.minQuantity} títulos com ${combo.rounds} ${combo.rounds === 1 ? "giro" : "giros"}`}
                          aria-pressed={selectedCombo}
                          onClick={() => {
                            setSelectedRouletteCombo(combo.id);
                            window.dispatchEvent(
                              new CustomEvent("sortex:select-roulette-combo", {
                                detail: { quantity: combo.minQuantity },
                              }),
                            );
                            window.setTimeout(
                              () =>
                                document
                                  .getElementById("participar")
                                  ?.scrollIntoView({
                                    behavior: "smooth",
                                    block: "center",
                                  }),
                              80,
                            );
                          }}
                          className={`relative overflow-hidden rounded-2xl border-2 bg-gradient-to-br ${intensity} p-0 text-left text-white shadow-md transition hover:-translate-y-0.5 hover:shadow-lg active:scale-[.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-600 focus-visible:ring-offset-2 disabled:cursor-default ${selectedCombo ? "border-emerald-300 ring-2 ring-emerald-300" : "border-transparent"}`}
                        >
                          <div className="flex items-center justify-between gap-4 p-4 sm:p-5">
                            <div>
                              <strong className="block text-xl font-black">
                                {combo.minQuantity.toLocaleString("pt-BR")}{" "}
                                títulos
                              </strong>
                              <span className="mt-1 block text-sm text-white/85">
                                por{" "}
                                <b className="text-base text-white">
                                  {money(combo.price)}
                                </b>
                              </span>
                            </div>
                            <div className="text-right">
                              <span className="block text-sm font-bold text-white/85">
                                Recebe
                              </span>
                              <strong className="mt-1 block text-lg font-black">
                                {combo.rounds}{" "}
                                {combo.rounds === 1 ? "giro" : "giros"} 🎯
                              </strong>
                            </div>
                          </div>
                          <div className="flex items-center justify-between gap-3 border-t border-white/20 bg-black/10 px-4 py-3 text-sm font-bold sm:px-5">
                            <span>
                              {combo.rounds}{" "}
                              {combo.rounds === 1
                                ? "chance de contemplação"
                                : "chances de contemplação"}
                            </span>
                            {selectedCombo && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-white px-2 py-1 text-[10px] font-black uppercase text-violet-800">
                                <CheckCircle2 size={13} />
                                Selecionado
                              </span>
                            )}
                          </div>
                        </button>
                      );
                    })}
                  </div>
                  <p className="mt-4 text-xs text-zinc-600">
                    Concorra a prêmios instantâneos. Os giros são concedidos
                    somente após o pagamento aprovado.
                  </p>
                </div>
              </Card>
            </div>
          )}
        </div>

        {(campaign.shortDescription ||
          campaign.mainPrizeDescription ||
          campaign.regulation ||
          drawRule) && (
          <div id="regulamento" className="scroll-mt-24">
            <Card className="overflow-hidden">
              <details className="group p-5 sm:p-7">
                <summary className="flex cursor-pointer list-none items-center justify-between text-xl font-black">
                  Descrição e regulamento{" "}
                  <ChevronDown className="transition group-open:rotate-180" />
                </summary>
                <div className="mt-6 grid gap-5 md:grid-cols-2">
                  {campaign.shortDescription && (
                    <TextBlock
                      title="Sobre a campanha"
                      text={campaign.shortDescription}
                    />
                  )}{" "}
                  {campaign.mainPrizeDescription && (
                    <TextBlock
                      title="Descrição do prêmio"
                      text={campaign.mainPrizeDescription}
                    />
                  )}{" "}
                  {campaign.regulation && (
                    <TextBlock title="Regulamento" text={campaign.regulation} />
                  )}
                  <TextBlock title="Regra do sorteio" text={drawRule} />
                </div>
              </details>
            </Card>
          </div>
        )}

        {foundResults.length > 0 && (
          <Card className="p-4 sm:p-7">
            <SectionTitle
              icon={<Trophy />}
              title="Cotas premiadas"
              subtitle="Confira as cotas que já foram encontradas."
            />
            <div className="mt-4 overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead>
                  <tr className="border-b text-xs uppercase text-zinc-500">
                    <th className="p-3">Número</th>
                    <th>Ganhador</th>
                    <th>Cidade</th>
                    <th>Valor recebido</th>
                    <th>Data</th>
                    <th>Hora</th>
                  </tr>
                </thead>
                <tbody>
                  {shownFound.map((result, index) => {
                    const date = new Date(result.identifiedAt);
                    return (
                      <tr
                        key={`${result.winningNumber}-${index}`}
                        className="border-b last:border-0"
                      >
                        <td
                          className="p-3 font-mono font-black"
                          style={{ color: accent }}
                        >
                          {result.winningNumber}
                        </td>
                        <td className="font-bold">{result.buyer.name}</td>
                        <td>
                          {[result.buyer.city, result.buyer.state]
                            .filter(Boolean)
                            .join(" - ") || "Não informado"}
                        </td>
                        <td className="font-black text-green-700">
                          {money(result.instantPrize.value)}
                        </td>
                        <td>{date.toLocaleDateString("pt-BR")}</td>
                        <td>
                          {date.toLocaleTimeString("pt-BR", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {foundResults.length > 5 && (
              <button
                onClick={() => setShowAllFound((value) => !value)}
                className="mx-auto mt-4 block rounded-xl px-4 py-2 text-sm font-bold"
                style={{ color: accent }}
              >
                {showAllFound ? "Mostrar menos" : "Ver mais cotas premiadas"}
              </button>
            )}
          </Card>
        )}
      </section>
      <CampaignPublicFooter
        campaign={campaign}
        onOpenTitles={() => setShowBuyerTitles(true)}
      />
      {!previewMode && (
        <CampaignBuyerTitlesPanel
          campaign={campaign}
          open={showBuyerTitles}
          onClose={() => setShowBuyerTitles(false)}
          onParticipate={() =>
            document
              .getElementById("participar")
              ?.scrollIntoView({ behavior: "smooth", block: "start" })
          }
        />
      )}
      {campaignPreferences?.stickyButton !== false && (
        <div className="fixed inset-x-0 bottom-0 z-[70] border-t bg-white/95 px-3 pt-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] md:hidden">
          <button
            type="button"
            disabled={previewMode}
            onClick={() => {
              const panel = document.querySelector("[data-purchase-panel]");
              if (!panel) return;
              const rect = panel.getBoundingClientRect();
              if (
                selectedRouletteCombo ||
                rect.top < 0 ||
                rect.top > window.innerHeight * 0.72
              ) {
                panel.scrollIntoView({ behavior: "smooth", block: "start" });
                return;
              }
              window.dispatchEvent(new Event("sortex:start-purchase"));
            }}
            style={{ backgroundColor: campaignButtonColor(campaign) }}
            className="block w-full touch-manipulation rounded-2xl py-4 text-center font-black text-white shadow-lg disabled:cursor-default"
          >
            {selectedRouletteCombo
              ? `Continuar — ${money(rouletteCombos.find((combo) => combo.id === selectedRouletteCombo)?.price ?? 0)}`
              : String(campaignPreferences?.buttonText || "Participar agora")}
          </button>
        </div>
      )}
    </main>
  );
}

function TextBlock({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-2xl bg-zinc-50 p-5">
      <h3 className="font-black">{title}</h3>
      <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-zinc-600">
        {text}
      </p>
    </div>
  );
}
function SectionTitle({
  icon,
  title,
  subtitle,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="rounded-xl bg-violet-100 p-2 text-violet-700">
        {icon}
      </span>
      <div>
        <h2 className="text-xl font-black">{title}</h2>
        <p className="mt-1 text-sm text-zinc-500">{subtitle}</p>
      </div>
    </div>
  );
}
function SoldBadge({ percent }: { percent: number }) {
  return (
    <div className="flex shrink-0 items-center gap-2">
      <div className="flex h-11 w-11 items-center justify-center rounded-full border-4 border-green-500 text-xs font-black text-green-700 sm:h-14 sm:w-14 sm:text-sm">
        {percent.toFixed(0)}%
      </div>
      <div className="hidden sm:block">
        <p className="text-xs font-black uppercase">Vendido</p>
        <p className="text-[10px] text-zinc-500">do total</p>
      </div>
    </div>
  );
}
function CampaignMilestoneTimeline({ campaign }: { campaign: Campaign }) {
  const soldPercentage =
    campaign.totalNumbers > 0
      ? Math.min(
          100,
          Math.max(0, (campaign.soldNumbers / campaign.totalNumbers) * 100),
        )
      : 0;
  const milestones = [...campaign.milestonePrizes].sort(
    (first, second) => first.percentage - second.percentage,
  );
  const nextId = milestones.find(
    (item) =>
      item.status === "WAITING" &&
      !(item.scheduledAt && soldPercentage >= item.percentage),
  )?.id;
  return (
    <Card
      className="overflow-hidden border-violet-100 bg-white"
      data-testid="campaign-milestones"
    >
      <div className="p-4 sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <SectionTitle
            icon={<Trophy />}
            title="Prêmios por Meta"
            subtitle="Novos prêmios são liberados conforme a campanha avança."
          />
          <span className="rounded-full bg-violet-50 px-3 py-1.5 text-[10px] font-black uppercase tracking-[.12em] text-violet-700">
            Premiação progressiva
          </span>
        </div>
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {milestones.map((milestone) => (
            <MilestoneCard
              key={milestone.id}
              campaign={campaign}
              milestone={milestone}
              soldPercentage={soldPercentage}
              isNext={milestone.id === nextId}
            />
          ))}
        </div>
        <div className="mt-5 flex items-start gap-2 rounded-2xl bg-violet-50 p-4 text-xs leading-5 text-violet-950 sm:text-sm">
          <Info
            className="mt-0.5 shrink-0 text-violet-700"
            size={17}
            aria-hidden
          />
          <p>
            {campaign.milestoneWinnersRemainEligible !== false
              ? "Os títulos continuam concorrendo às próximas metas, mesmo após uma premiação."
              : "Após uma premiação, o título contemplado deixa de concorrer às próximas metas."}
          </p>
        </div>
      </div>
    </Card>
  );
}
function MilestoneCard({
  campaign,
  milestone,
  soldPercentage,
  isNext,
}: {
  campaign: Campaign;
  milestone: Campaign["milestonePrizes"][number];
  soldPercentage: number;
  isNext: boolean;
}) {
  const target = Math.max(1, milestone.percentage);
  const barPercentage = Math.min(
    100,
    Math.max(0, (soldPercentage / target) * 100),
  );
  const remaining = Math.max(0, target - soldPercentage);
  const scheduled =
    milestone.status === "WAITING" &&
    Boolean(milestone.scheduledAt) &&
    soldPercentage >= target;
  const finished =
    milestone.status === "DRAWN" || milestone.status === "COMPLETED";
  const released = milestone.status === "RELEASED";
  const state = finished
    ? "DRAWN"
    : released
      ? "RELEASED"
      : scheduled
        ? "SCHEDULED"
        : isNext
          ? "NEXT"
          : "LOCKED";
  const primaryColor = campaignButtonColor(campaign);
  const styles = {
    DRAWN: {
      label: "SORTEADO",
      className: "border-emerald-200 bg-emerald-50 text-emerald-800",
      icon: <CheckCircle2 size={15} aria-hidden />,
      text: "Meta concluída e prêmio sorteado.",
    },
    RELEASED: {
      label: "LIBERADO",
      className: "border-emerald-200 bg-emerald-50 text-emerald-800",
      icon: <CheckCircle2 size={15} aria-hidden />,
      text: "Meta alcançada. Sorteio liberado.",
    },
    SCHEDULED: {
      label: "SORTEIO AGENDADO",
      className: "border-sky-200 bg-sky-50 text-sky-800",
      icon: <CalendarDays size={15} aria-hidden />,
      text: "Meta alcançada. Sorteio agendado.",
    },
    NEXT: {
      label: "PRÓXIMO PRÊMIO",
      className: "border-zinc-200 bg-white text-zinc-800",
      icon: <Trophy size={15} aria-hidden />,
      text:
        remaining > 0
          ? `Faltam ${formatPercentage(remaining)} para liberar este prêmio.`
          : "Meta alcançada. Prêmio liberado.",
    },
    LOCKED: {
      label: "BLOQUEADO",
      className: "border-zinc-200 bg-zinc-100 text-zinc-700",
      icon: <LockKeyhole size={15} aria-hidden />,
      text: `Disponível ao atingir ${formatPercentage(target)}.`,
    },
  }[state];
  const progressColor =
    state === "DRAWN" || state === "RELEASED"
      ? "#10B981"
      : state === "SCHEDULED"
        ? "#0284C7"
        : state === "LOCKED"
          ? "#A1A1AA"
          : primaryColor;
  return (
    <article
      data-testid="milestone-card"
      data-milestone-state={state}
      data-milestone-percentage={target}
      className={`overflow-hidden rounded-3xl border bg-white shadow-sm transition-shadow hover:shadow-md ${isNext ? "border-violet-400 ring-2 ring-violet-100" : "border-zinc-200"}`}
    >
      <MilestoneImage
        imageUrl={milestone.imageUrl}
        imageCrop={milestone.imageCrop}
        title={milestone.name}
      />
      <div className="p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <span className="rounded-full bg-violet-700 px-3 py-1 text-[10px] font-black uppercase tracking-wide text-white">
            {formatPercentage(target)} da campanha
          </span>
          <span
            className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[9px] font-black ${styles.className}`}
          >
            {styles.icon}
            {styles.label}
          </span>
        </div>
        <h3 className="mt-4 text-xl font-black tracking-tight text-zinc-950">
          {milestone.name}
        </h3>
        {milestone.description && (
          <p className="mt-1 line-clamp-2 text-sm leading-6 text-zinc-600">
            {milestone.description}
          </p>
        )}
        {milestone.estimatedValue !== undefined &&
          milestone.estimatedValue !== null && (
            <p className="mt-2 text-sm font-bold text-violet-700">
              Valor estimado: {money(milestone.estimatedValue)}
            </p>
          )}
        <div
          className="mt-5"
          aria-label={`Progresso: ${formatPercentage(soldPercentage)} de ${formatPercentage(target)}`}
        >
          <div className="flex items-center justify-between gap-3 text-xs">
            <span className="font-black text-zinc-700">
              {isNext ? "Próximo prêmio" : "Progresso do prêmio"}
            </span>
            <strong className="shrink-0 text-zinc-950">
              Meta {formatPercentage(target)}
            </strong>
          </div>
          <div className="relative mt-2 h-3 overflow-hidden rounded-full bg-zinc-100">
            <div
              data-testid="milestone-progress"
              className="h-full rounded-full transition-[width] duration-700 motion-reduce:transition-none"
              style={{
                width: `${barPercentage}%`,
                backgroundColor: progressColor,
              }}
            />
            <span
              className="absolute inset-y-0 right-0 w-0.5 bg-zinc-500/35"
              aria-hidden
            />
          </div>
          <div className="mt-2 flex items-center justify-between gap-3 text-[11px] font-semibold text-zinc-500">
            <span>{formatPercentage(soldPercentage)} vendido</span>
            <span>{Math.round(barPercentage)}% do caminho</span>
          </div>
          <p className="mt-2 text-xs font-semibold text-zinc-600">
            {styles.text}
          </p>
        </div>
        <div className="mt-4 border-t pt-4 text-xs text-zinc-600">
          <span className="font-bold text-zinc-800">Regra do sorteio:</span>{" "}
          {drawBasisLabel(campaign.drawBasis)}
        </div>
        {milestone.scheduledAt && (
          <p className="mt-2 inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-600">
            <CalendarDays size={14} aria-hidden />
            {new Date(milestone.scheduledAt).toLocaleString("pt-BR")}
          </p>
        )}
        {milestone.winner && (
          <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-950">
            <strong className="block">Ganhador: {milestone.winner.name}</strong>
            <span className="mt-1 block text-xs">
              {milestone.winner.city || "Cidade não informada"} · Título{" "}
              {milestone.winner.number}
            </span>
            {milestone.drawnAt && (
              <span className="mt-1 block text-xs">
                Sorteado em{" "}
                {new Date(milestone.drawnAt).toLocaleString("pt-BR")}
              </span>
            )}
            <Link
              href={`/o/${campaign.organizer.id}?view=winners&returnTo=${encodeURIComponent(`/campanha/${campaign.slug}`)}`}
              className="mt-3 inline-flex min-h-10 items-center rounded-xl border border-emerald-300 px-3 text-xs font-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600"
            >
              Ver resultado
            </Link>
          </div>
        )}
        {isNext && !finished && !released && (
          <button
            type="button"
            onClick={() =>
              document
                .getElementById("participar")
                ?.scrollIntoView({ behavior: "smooth", block: "start" })
            }
            className="mt-4 min-h-11 text-sm font-black text-violet-700 underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-600"
          >
            Participar e ajudar a liberar
          </button>
        )}
      </div>
    </article>
  );
}
function MilestoneImage({
  imageUrl,
  imageCrop,
  title,
}: {
  imageUrl?: string;
  imageCrop?: Campaign["milestonePrizes"][number]["imageCrop"];
  title: string;
}) {
  const [failed, setFailed] = useState(false);
  if (!imageUrl || failed)
    return (
      <div className="grid h-36 place-items-center bg-gradient-to-br from-violet-50 to-zinc-100 text-violet-300 sm:h-40">
        <Gift size={48} aria-label={`Prêmio ${title} sem imagem`} />
      </div>
    );
  return (
    <div
      className="relative h-36 overflow-hidden bg-zinc-100 sm:h-40"
      style={milestoneImageStyle(imageCrop)}
    >
      <Image
        src={mediaUrl(imageUrl)}
        alt={`Imagem do prêmio ${title}`}
        fill
        sizes="(max-width: 768px) 100vw, (max-width: 1280px) 50vw, 33vw"
        className="object-cover [object-position:var(--milestone-mobile-position)] [transform:scale(var(--milestone-mobile-zoom))] [transform-origin:var(--milestone-mobile-position)] sm:[object-position:var(--milestone-desktop-position)] sm:[transform:scale(var(--milestone-desktop-zoom))] sm:[transform-origin:var(--milestone-desktop-position)]"
        onError={() => setFailed(true)}
      />
    </div>
  );
}
function PublicCampaignTitle({ campaign }: { campaign: Campaign }) {
  const segments =
    campaign.titleCompositionMode === "SEGMENTS"
      ? [...(campaign.titleSegments || [])]
          .sort((first, second) => first.order - second.order)
          .filter((segment) => segment.text.trim())
      : [];
  if (!segments.length) return <>{cleanTitle(campaign.title)}</>;
  return (
    <>
      {segments.map((segment, index) => (
        <span
          key={`${segment.order}-${index}`}
          style={{
            color: validColor(segment.color) ? segment.color : "#FFFFFF",
          }}
        >
          {index > 0 ? " " : ""}
          {segment.text}
        </span>
      ))}
    </>
  );
}
function milestoneImageStyle(
  crop: Campaign["milestonePrizes"][number]["imageCrop"],
): CSSProperties {
  const viewport = (value: unknown) => {
    const item =
      value && typeof value === "object"
        ? (value as Record<string, unknown>)
        : {};
    return {
      x: bounded(item.x, 0, 100, 50),
      y: bounded(item.y, 0, 100, 50),
      zoom: bounded(item.zoom, 1, 2, 1),
    };
  };
  const desktop = viewport(crop?.desktop);
  const mobile = viewport(crop?.mobile);
  return {
    "--milestone-desktop-position": `${desktop.x}% ${desktop.y}%`,
    "--milestone-mobile-position": `${mobile.x}% ${mobile.y}%`,
    "--milestone-desktop-zoom": desktop.zoom,
    "--milestone-mobile-zoom": mobile.zoom,
  } as CSSProperties;
}
function bounded(
  value: unknown,
  minimum: number,
  maximum: number,
  fallback: number,
) {
  const parsed = Number(value);
  return Number.isFinite(parsed)
    ? Math.min(maximum, Math.max(minimum, parsed))
    : fallback;
}
function publicRewardSectionsOrder(value: unknown): RewardSection[] {
  const fallback: RewardSection[] = ["INSTANT_WIN", "MILESTONES", "ROULETTE"];
  if (
    !Array.isArray(value) ||
    value.length !== fallback.length ||
    new Set(value).size !== fallback.length ||
    value.some(
      (item) =>
        typeof item !== "string" || !fallback.includes(item as RewardSection),
    )
  )
    return fallback;
  return value as RewardSection[];
}
function formatPercentage(value: number) {
  return `${new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 }).format(Math.max(0, value))}%`;
}
function drawBasisLabel(value: Campaign["drawBasis"]) {
  return value === "LOTERIA_FEDERAL"
    ? "Resultado baseado na Loteria Federal"
    : value === "MANUAL_RESULT"
      ? "Resultado manual conforme regra registrada"
      : "Regra personalizada e auditável";
}
function campaignAccent(campaign: Campaign) {
  const custom =
    campaign.customization?.useOrganizerDefaults === false
      ? String(campaign.customization.configuration.primaryColor || "")
      : "";
  if (validColor(custom)) return custom;
  const colors = {
    BLUE: campaign.organizer.brand?.primaryColor || "#2563EB",
    GREEN: "#16A34A",
    RED: "#DC2626",
    PURPLE: "#7C3AED",
    PINK: "#DB2777",
    ORANGE: "#EA580C",
    YELLOW: "#CA8A04",
    BLACK: "#111827",
    CUSTOM:
      campaign.customAccentColor ||
      campaign.organizer.brand?.primaryColor ||
      "#2563EB",
  };
  return colors[campaign.accentColorMode || "BLUE"];
}
function campaignButtonColor(campaign: Campaign) {
  const custom =
    campaign.customization?.useOrganizerDefaults === false
      ? String(campaign.customization.configuration.buttonColor || "")
      : "";
  return validColor(custom) ? custom : campaignAccent(campaign);
}
function readableTextColor(background: string) {
  if (!validColor(background)) return "#FFFFFF";
  const red = parseInt(background.slice(1, 3), 16),
    green = parseInt(background.slice(3, 5), 16),
    blue = parseInt(background.slice(5, 7), 16);
  const luminance = (0.2126 * red + 0.7152 * green + 0.0722 * blue) / 255;
  return luminance > 0.62 ? "#111827" : "#FFFFFF";
}
type PublicRoulette = {
  rules: Array<{ id: string; minQuantity: number; rounds: number }>;
};
function publicRoulette(
  configuration?: Record<string, unknown>,
): PublicRoulette | null {
  const source =
    configuration?.roulette && typeof configuration.roulette === "object"
      ? (configuration.roulette as Record<string, unknown>)
      : null;
  if (!source || source.enabled !== true) return null;
  const now = Date.now();
  if (source.startsAt && new Date(String(source.startsAt)).getTime() > now)
    return null;
  if (source.endsAt && new Date(String(source.endsAt)).getTime() < now)
    return null;
  const rules = (Array.isArray(source.rules) ? source.rules : [])
    .map((entry, index) => {
      const item = entry as Record<string, unknown>;
      return {
        id: String(item.id || index),
        minQuantity: Math.max(1, Number(item.minQuantity) || 1),
        rounds: Math.max(0, Math.floor(Number(item.rounds) || 0)),
      };
    })
    .filter((rule) => rule.rounds > 0)
    .sort((a, b) => a.minQuantity - b.minQuantity);
  return rules.length ? { rules } : null;
}
function publicHeroImageStyle(
  configuration?: Record<string, unknown>,
): CSSProperties {
  const root =
    configuration?.heroImage && typeof configuration.heroImage === "object"
      ? (configuration.heroImage as Record<string, unknown>)
      : {};
  const viewport = (value: unknown) => {
    const item =
      value && typeof value === "object"
        ? (value as Record<string, unknown>)
        : {};
    const bounded = (
      candidate: unknown,
      min: number,
      max: number,
      fallback: number,
    ) => {
      const number = Number(candidate);
      return Number.isFinite(number)
        ? Math.min(max, Math.max(min, number))
        : fallback;
    };
    return {
      x: bounded(item.x, 0, 100, 50),
      y: bounded(item.y, 0, 100, 50),
      zoom: bounded(item.zoom, 1, 2, 1),
    };
  };
  const mobile = viewport(root.mobile),
    desktop = viewport(root.desktop);
  return {
    "--hero-mobile-position": `${mobile.x}% ${mobile.y}%`,
    "--hero-desktop-position": `${desktop.x}% ${desktop.y}%`,
    "--hero-mobile-zoom": String(mobile.zoom),
    "--hero-desktop-zoom": String(desktop.zoom),
  } as CSSProperties;
}
function validColor(value: string) {
  return /^#[0-9A-Fa-f]{6}$/.test(value);
}
function hexWithAlpha(hex: string, alpha: string) {
  return /^#[0-9A-Fa-f]{6}$/.test(hex) ? `${hex}${alpha}` : "#DBEAFE";
}
function countdownParts(value: number) {
  const seconds = Math.max(0, Math.floor(value / 1000));
  return {
    dias: Math.floor(seconds / 86400),
    horas: Math.floor((seconds % 86400) / 3600),
    minutos: Math.floor((seconds % 3600) / 60),
    segundos: seconds % 60,
  };
}
function countdownLabel(label: string) {
  return (
    (
      {
        dias: "Dias",
        horas: "Horas",
        minutos: "Min",
        segundos: "Seg",
      } as Record<string, string>
    )[label] || label
  );
}

const CampaignCountdown = memo(function CampaignCountdown({
  drawDate,
  drawTime,
}: {
  drawDate?: string | null;
  drawTime?: string | null;
}) {
  const target = useMemo(
    () =>
      drawDate
        ? new Date(`${drawDate.slice(0, 10)}T${drawTime || "00:00"}`).getTime()
        : null,
    [drawDate, drawTime],
  );
  const [countdown, setCountdown] = useState(() =>
    target === null ? null : countdownParts(target - Date.now()),
  );
  useEffect(() => {
    if (target === null) return;
    let timer: number | undefined;
    const update = () => setCountdown(countdownParts(target - Date.now()));
    const stop = () => {
      if (timer !== undefined) {
        window.clearInterval(timer);
        timer = undefined;
      }
    };
    const start = () => {
      stop();
      if (!document.hidden) {
        update();
        timer = window.setInterval(update, 1000);
      }
    };
    const onVisibilityChange = () => (document.hidden ? stop() : start());
    start();
    document.addEventListener("visibilitychange", onVisibilityChange);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [target]);
  return (
    <>
      <div className="flex items-center gap-1.5 sm:gap-2">
        <span className="inline-flex min-w-max shrink-0 whitespace-nowrap rounded-lg bg-red-600 px-1.5 py-1 text-[9px] font-black text-white sm:px-3 sm:text-xs">
          🔴 AO VIVO
        </span>
        <span className="whitespace-nowrap text-[9px] font-bold text-white drop-shadow sm:text-sm">
          Faltam para o sorteio
        </span>
      </div>
      {countdown && (
        <div className="mt-1 grid grid-cols-4 overflow-hidden rounded-lg border border-white/70 bg-white/90 shadow-sm sm:mt-1.5">
          {Object.entries(countdown).map(([label, value]) => (
            <div
              key={label}
              className="border-r border-zinc-200 px-0.5 py-0.5 text-center last:border-r-0 sm:px-1 sm:py-1"
            >
              <strong className="block text-[9px] leading-none sm:text-sm lg:text-base">
                {String(value).padStart(2, "0")}
              </strong>
              <span className="mt-px block text-[5px] leading-none text-zinc-500 sm:text-[6px]">
                {countdownLabel(label)}
              </span>
            </div>
          ))}
        </div>
      )}
    </>
  );
});
