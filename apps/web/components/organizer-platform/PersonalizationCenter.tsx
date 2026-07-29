"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ExternalLink,
  Globe2,
  ImagePlus,
  Palette,
  RotateCcw,
  Save,
  Trash2,
} from "lucide-react";
import { getMyCampaigns } from "@/lib/campaigns/client";
import type { Campaign } from "@/lib/campaigns/types";
import {
  addCommunity,
  addDomain,
  addSocial,
  completeOnboarding,
  createTemplate,
  deleteCommunity,
  deleteDomain,
  deleteSocial,
  deleteTemplate,
  getPersonalization,
  removeBrandAsset,
  updateBrand,
  updateCommunity,
  updateSocial,
  uploadBrandAsset,
  verifyDomain,
  type Brand,
  type Personalization,
} from "@/lib/organizer-platform/client";
import { PersonalizationPreview } from "@/components/organizer-platform/PersonalizationPreview";

const tabs = [
  ["site", "Identidade"],
  ["aparencia", "Aparência"],
  ["redes", "Redes sociais"],
  ["dominio", "Domínio"],
  ["tipografia", "Tipografia"],
  ["layout", "Layout da campanha"],
  ["elementos", "Elementos da campanha"],
  ["templates", "Templates"],
  ["preview", "Pré-visualização"],
] as const;
const input =
  "mt-2 h-11 w-full rounded-xl border border-zinc-200 bg-white px-3 outline-none focus:border-violet-500";
const socialLabels: Record<string, string> = {
  INSTAGRAM: "Instagram",
  FACEBOOK: "Facebook",
  TIKTOK: "TikTok",
  YOUTUBE: "YouTube",
  X_TWITTER: "X/Twitter",
  WEBSITE: "Site",
  WHATSAPP: "WhatsApp",
  TELEGRAM: "Telegram",
  DISCORD: "Discord",
};
const communityLabels: Record<string, string> = {
  WHATSAPP_GROUP: "Grupo do WhatsApp",
  WHATSAPP_COMMUNITY: "Comunidade do WhatsApp",
  INSTAGRAM_CHANNEL: "Canal do Instagram",
  TELEGRAM_CHANNEL: "Canal do Telegram",
  TELEGRAM_GROUP: "Grupo do Telegram",
  DISCORD: "Discord",
};
const statusLabels: Record<string, string> = {
  NOT_CONFIGURED: "Não configurado",
  AWAITING_DNS: "Aguardando DNS",
  VERIFYING: "Em verificação",
  ACTIVE: "Ativo",
  ERROR: "Erro",
  SUSPENDED: "Suspenso",
};

export function PersonalizationCenter({
  initialTab = "site",
}: {
  initialTab?: string;
}) {
  const router = useRouter();
  const search = useSearchParams();
  const onboarding = search.get("onboarding") === "1";
  const [tab, setTab] = useState(initialTab);
  const [data, setData] = useState<Personalization | null>(null);
  const [brand, setBrand] = useState<Brand | null>(null);
  const [savedBrand, setSavedBrand] = useState<Brand | null>(null);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [previewCampaignId, setPreviewCampaignId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("Tudo salvo");
  const [social, setSocial] = useState({
    id: "",
    type: "INSTAGRAM",
    label: "",
    url: "",
    isActive: true,
    sortOrder: 0,
  });
  const [community, setCommunity] = useState({
    id: "",
    type: "WHATSAPP_GROUP",
    name: "",
    description: "",
    url: "",
    isActive: true,
    sortOrder: 0,
  });
  const [domain, setDomain] = useState({
    type: "SUBDOMAIN",
    domain: "",
    isPrimary: true,
  });
  const [template, setTemplate] = useState({
    name: "",
    description: "",
    sourceCampaignId: "",
  });
  const [pendingAssets, setPendingAssets] = useState<
    Partial<Record<"logo" | "profile" | "banner", File>>
  >({});
  const [removedAssets, setRemovedAssets] = useState<
    Array<"logo" | "profile" | "banner">
  >([]);
  const logoPreview = brand?.primaryLogoUrl;
  const profilePreview = brand?.profileImageUrl;
  const bannerPreview = brand?.bannerUrl;
  useEffect(
    () => () => {
      for (const preview of [logoPreview, profilePreview, bannerPreview])
        if (preview?.startsWith("blob:")) URL.revokeObjectURL(preview);
    },
    [logoPreview, profilePreview, bannerPreview],
  );
  const load = async () => {
    const [personalization, ownedCampaigns] = await Promise.all([
      getPersonalization(),
      getMyCampaigns(),
    ]);
    setData(personalization);
    setBrand(personalization.brand);
    setSavedBrand(personalization.brand);
    setCampaigns(ownedCampaigns);
    setPreviewCampaignId(
      (current) =>
        current ||
        ownedCampaigns.find((item) => item.status === "PUBLISHED")?.id ||
        ownedCampaigns[0]?.id ||
        "",
    );
    setSaved("Tudo salvo");
  };
  useEffect(() => {
    const timer = window.setTimeout(
      () =>
        void load().catch(() =>
          setError("Não foi possível carregar sua personalização."),
        ),
      0,
    );
    return () => window.clearTimeout(timer);
  }, []);
  const appearance = useMemo<Record<string, unknown>>(
    () => ({
      showParticipants: true,
      showProgress: true,
      showDescription: true,
      showRegulation: true,
      showInstantPrizes: true,
      showWinnerList: true,
      showSocialLinks: true,
      showOrganizerLogo: true,
      logoSize: 100,
      showSlogan: true,
      showCountdown: true,
      buttonText: "Participar agora",
      buttonFixed: true,
      mediaMode: "AUTO_CAROUSEL",
      autoSlideSeconds: 5,
      ...(brand?.appearanceConfig || {}),
    }),
    [brand],
  );
  const dirty = Boolean(
    brand && savedBrand && JSON.stringify(brand) !== JSON.stringify(savedBrand),
  );
  useEffect(() => {
    const warn = (event: BeforeUnloadEvent) => {
      if (!dirty) return;
      event.preventDefault();
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);
  if (!data || !brand || !savedBrand)
    return (
      <div className="min-h-72">
        {error ? (
          <div className="rounded-2xl border border-red-100 bg-red-50 p-5 text-red-700">
            <b>Não foi possível carregar sua personalização.</b>
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                onClick={() => void load()}
                className="rounded-xl bg-red-700 px-4 py-2 font-bold text-white"
              >
                Tentar novamente
              </button>
              <button
                onClick={() => location.reload()}
                className="rounded-xl border border-red-200 px-4 py-2 font-bold"
              >
                Usar configuração padrão temporariamente
              </button>
            </div>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            <div className="h-72 animate-pulse rounded-3xl bg-zinc-100" />
            <div className="h-72 animate-pulse rounded-3xl bg-zinc-100" />
          </div>
        )}
      </div>
    );
  const selectedCampaign =
    campaigns.find((item) => item.id === previewCampaignId) ||
    campaigns[0] ||
    demoPreviewCampaign(brand);
  const logoSize = normalizeLogoSize(appearance.logoSize);
  function changeBrand<K extends keyof Brand>(key: K, value: Brand[K]) {
    setBrand((current) => (current ? { ...current, [key]: value } : current));
    setSaved("Alterações não salvas");
  }
  function changeAppearance(key: string, value: unknown) {
    changeBrand("appearanceConfig", { ...appearance, [key]: value });
  }
  async function finishOnboarding(skipPersonalization = false) {
    if (!brand) return;
    setBusy(true);
    setError("");
    setSaved("Salvando...");
    try {
      const cleanBrand = {
        ...brand,
        primaryLogoUrl: savedBrand?.primaryLogoUrl ?? null,
        profileImageUrl: savedBrand?.profileImageUrl ?? null,
        bannerUrl: savedBrand?.bannerUrl ?? null,
      };
      await completeOnboarding(skipPersonalization ? {} : cleanBrand);
      if (!skipPersonalization) {
        for (const [kind, file] of Object.entries(pendingAssets))
          if (file)
            await uploadBrandAsset(kind as "logo" | "profile" | "banner", file);
        for (const kind of removedAssets) await removeBrandAsset(kind);
      }
      setSaved("Configuração concluída");
      router.replace("/dashboard");
      router.refresh();
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Erro ao concluir configuração.",
      );
      setSaved("Erro ao concluir configuração");
    } finally {
      setBusy(false);
    }
  }
  async function saveBrand() {
    if (!brand || !savedBrand) return;
    if (onboarding) return finishOnboarding();
    if (!dirty) return;
    setBusy(true);
    setError("");
    setSaved("Salvando...");
    try {
      const cleanBrand = {
        ...brand,
        primaryLogoUrl: savedBrand.primaryLogoUrl,
        profileImageUrl: savedBrand.profileImageUrl,
        bannerUrl: savedBrand.bannerUrl,
      };
      await updateBrand(cleanBrand);
      for (const [kind, file] of Object.entries(pendingAssets))
        if (file)
          await uploadBrandAsset(kind as "logo" | "profile" | "banner", file);
      for (const kind of removedAssets) await removeBrandAsset(kind);
      setPendingAssets({});
      setRemovedAssets([]);
      await load();
      setSaved("Personalização salva com sucesso.");
      window.setTimeout(() => setSaved("Tudo salvo"), 2500);
    } catch {
      setError("Não foi possível salvar a personalização. Tente novamente.");
      setSaved("Alterações não salvas");
    } finally {
      setBusy(false);
    }
  }
  function upload(kind: "logo" | "profile" | "banner", file?: File) {
    if (!file) return;
    const field =
      kind === "logo"
        ? "primaryLogoUrl"
        : kind === "profile"
          ? "profileImageUrl"
          : "bannerUrl";
    changeBrand(field, URL.createObjectURL(file));
    setPendingAssets((current) => ({ ...current, [kind]: file }));
    setRemovedAssets((current) => current.filter((item) => item !== kind));
  }
  function removeAsset(kind: "logo" | "profile" | "banner") {
    const field =
      kind === "logo"
        ? "primaryLogoUrl"
        : kind === "profile"
          ? "profileImageUrl"
          : "bannerUrl";
    changeBrand(field, null);
    setPendingAssets((current) => {
      const next = { ...current };
      delete next[kind];
      return next;
    });
    setRemovedAssets((current) =>
      current.includes(kind) ? current : [...current, kind],
    );
  }
  function discard() {
    if (!dirty || !savedBrand) return;
    if (!confirm("Deseja descartar as alterações não salvas?")) return;
    setBrand(structuredClone(savedBrand));
    setPendingAssets({});
    setRemovedAssets([]);
    setSaved("Alterações descartadas.");
    window.setTimeout(() => setSaved("Tudo salvo"), 2200);
  }
  function restore() {
    if (
      !confirm(
        "Deseja restaurar a aparência padrão da SorteX?\n\nAs alterações aparecerão na prévia, mas só serão aplicadas depois que você clicar em Salvar alterações.",
      )
    )
      return;
    setBrand((current) =>
      current
        ? {
            ...current,
            primaryColor: "#6D28D9",
            secondaryColor: "#111827",
            accentColor: "#22C55E",
            textColor: "#111827",
            buttonColor: "#2563EB",
            progressColor: "#22C55E",
            backgroundColor: "#FFFFFF",
            cardColor: "#FFFFFF",
            themeMode: "LIGHT",
            layoutStyle: "MODERN",
            appearanceConfig: null,
          }
        : current,
    );
    setSaved("Padrão aplicado à prévia.");
    window.setTimeout(() => setSaved("Alterações não salvas"), 2200);
  }
  async function saveSocial(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const body = {
        type: social.type,
        label: social.label || null,
        url: social.url,
        isActive: social.isActive,
        sortOrder: social.sortOrder,
      };
      if (social.id) await updateSocial(social.id, body);
      else await addSocial(body);
      setSocial({
        id: "",
        type: "INSTAGRAM",
        label: "",
        url: "",
        isActive: true,
        sortOrder: 0,
      });
      await load();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Erro ao salvar rede social.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function saveCommunity(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      const body = {
        type: community.type,
        name: community.name,
        description: community.description || null,
        url: community.url,
        isActive: community.isActive,
        sortOrder: community.sortOrder,
      };
      if (community.id) await updateCommunity(community.id, body);
      else await addCommunity(body);
      setCommunity({
        id: "",
        type: "WHATSAPP_GROUP",
        name: "",
        description: "",
        url: "",
        isActive: true,
        sortOrder: 0,
      });
      await load();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Erro ao salvar comunidade.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function saveDomain(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await addDomain(domain);
      setDomain({ type: "SUBDOMAIN", domain: "", isPrimary: true });
      await load();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Erro ao salvar domínio.",
      );
    } finally {
      setBusy(false);
    }
  }
  async function saveTemplate(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    try {
      await createTemplate({
        ...template,
        sourceCampaignId: template.sourceCampaignId || undefined,
        configuration: { brand, appearance },
      });
      setTemplate({ name: "", description: "", sourceCampaignId: "" });
      await load();
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Erro ao salvar template.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="mx-auto w-full min-w-0 max-w-[1700px] overflow-x-hidden">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-black uppercase tracking-[.2em] text-violet-600">
            Identidade e experiência
          </p>
          <h1 className="mt-2 text-3xl font-black">Personalização</h1>
          <p className="mt-2 text-zinc-500">
            Defina a identidade global herdada por todas as suas campanhas.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-3">
          <span
            aria-live="polite"
            className={`flex items-center gap-2 text-sm font-semibold ${dirty ? "text-amber-700" : "text-emerald-700"}`}
          >
            <span
              className={`h-2 w-2 rounded-full ${dirty ? "bg-amber-500" : "bg-emerald-500"}`}
            />
            {dirty && saved === "Tudo salvo" ? "Alterações não salvas" : saved}
          </span>
          {!onboarding && (
            <>
              <button
                onClick={discard}
                disabled={busy || !dirty}
                className="h-11 rounded-xl border px-4 text-sm font-bold text-zinc-600 hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Descartar alterações
              </button>
              <button
                onClick={restore}
                disabled={busy}
                className="flex h-11 items-center gap-2 rounded-xl border px-4 text-sm font-bold"
              >
                <RotateCcw size={17} />
                Restaurar padrão
              </button>
            </>
          )}
          {onboarding && (
            <button
              onClick={() => void finishOnboarding(true)}
              disabled={busy}
              className="h-11 rounded-xl px-4 text-sm font-bold text-zinc-600 hover:bg-zinc-100 disabled:opacity-50"
            >
              Pular por agora
            </button>
          )}
          <button
            onClick={() => void saveBrand()}
            disabled={busy || (!dirty && !onboarding)}
            className="flex h-11 items-center gap-2 rounded-xl bg-violet-600 px-5 font-bold text-white disabled:cursor-not-allowed disabled:opacity-45"
          >
            <Save size={18} />
            {busy
              ? "Salvando..."
              : onboarding
                ? "Salvar e abrir painel"
                : "Salvar alterações"}
          </button>
        </div>
      </div>
      {error && (
        <p
          role="alert"
          className="mt-5 rounded-2xl bg-red-50 p-4 text-sm text-red-700"
        >
          {error}
        </p>
      )}
      <select
        aria-label="Seção de personalização"
        value={tab}
        onChange={(e) => setTab(e.target.value)}
        className="mt-6 h-12 w-full rounded-xl border bg-white px-3 font-bold md:hidden"
      >
        {tabs.map(([key, label]) => (
          <option key={key} value={key}>
            {label}
          </option>
        ))}
      </select>
      <div className="mt-6 grid min-w-0 gap-4 md:grid-cols-[210px_minmax(0,1fr)] xl:grid-cols-[210px_minmax(0,1fr)_minmax(390px,520px)]">
        <nav className="hidden content-start gap-2 md:grid">
          {tabs.map(([key, label]) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              className={`rounded-xl px-4 py-3 text-left text-sm font-bold ${tab === key ? "bg-violet-600 text-white" : "border bg-white text-zinc-600"}`}
            >
              {label}
            </button>
          ))}
        </nav>
        <section className="min-w-0 max-w-full overflow-hidden rounded-3xl border bg-white p-5 shadow-sm sm:p-7">
          {tab === "site" && (
            <div>
              <SectionTitle
                icon={<ImagePlus />}
                title="Identidade do organizador"
                subtitle="Marca e perfil pessoal permanecem separados e atualizam todas as campanhas que usam a identidade padrão."
              />
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <Field label="Nome público">
                  <input
                    className={input}
                    value={brand.publicName}
                    onChange={(e) => changeBrand("publicName", e.target.value)}
                  />
                </Field>
                <Field label="Nome fantasia">
                  <input
                    className={input}
                    value={brand.fantasyName || ""}
                    onChange={(e) => changeBrand("fantasyName", e.target.value)}
                  />
                </Field>
                <Field label="Slogan">
                  <input
                    maxLength={60}
                    className={input}
                    value={brand.slogan || ""}
                    onChange={(e) => changeBrand("slogan", e.target.value)}
                  />
                </Field>
                <Field label="Telefone público">
                  <input
                    className={input}
                    value={brand.publicPhone || ""}
                    onChange={(e) => changeBrand("publicPhone", e.target.value)}
                  />
                </Field>
                <Field label="E-mail público">
                  <input
                    type="email"
                    className={input}
                    value={brand.publicEmail || ""}
                    onChange={(e) => changeBrand("publicEmail", e.target.value)}
                  />
                </Field>
              </div>
              <h3 className="mt-7 font-black">Identidade da marca</h3>
              <div className="mt-3 grid gap-4 md:grid-cols-2">
                <Upload
                  label="Logo"
                  src={
                    brand.primaryLogoUrl?.startsWith("blob:")
                      ? brand.primaryLogoUrl
                      : brand.primaryLogoUrl
                        ? `/api/brand-assets/${brand.organizerId}/logo`
                        : undefined
                  }
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(file) => void upload("logo", file)}
                  onRemove={() => removeAsset("logo")}
                />
                <Upload
                  label="Banner geral"
                  src={
                    brand.bannerUrl?.startsWith("blob:")
                      ? brand.bannerUrl
                      : brand.bannerUrl
                        ? `/api/brand-assets/${brand.organizerId}/banner`
                        : undefined
                  }
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(file) => void upload("banner", file)}
                  onRemove={() => removeAsset("banner")}
                />
              </div>
              <fieldset className="mt-5 rounded-2xl border bg-zinc-50 p-4">
                <legend className="px-2 text-sm font-black">
                  Posição da logo na página pública
                </legend>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  {([
                    ["LEFT", "Esquerda"],
                    ["CENTER", "Centro"],
                    ["RIGHT", "Direita"],
                  ] as const).map(([value, label]) => (
                    <label
                      key={value}
                      className={`flex min-h-12 cursor-pointer items-center justify-center rounded-xl border px-2 text-center text-xs font-bold transition sm:text-sm ${String(appearance.logoPosition || "LEFT") === value ? "border-violet-700 bg-violet-700 text-white shadow-sm" : "bg-white hover:border-violet-300"}`}
                    >
                      <input
                        type="radio"
                        name="logoPosition"
                        value={value}
                        checked={
                          String(appearance.logoPosition || "LEFT") === value
                        }
                        onChange={() => changeAppearance("logoPosition", value)}
                        className="sr-only"
                      />
                      {label}
                    </label>
                  ))}
                </div>
                <div className="mt-4 rounded-xl border bg-white p-3">
                  <p className="text-[10px] font-black uppercase tracking-wide text-zinc-500">
                    Prévia
                  </p>
                  <div
                    data-testid="logo-position-preview"
                    data-logo-size={logoSize}
                    className={`mt-2 flex min-h-16 w-full items-center ${String(appearance.logoPosition || "LEFT") === "CENTER" ? "justify-center" : String(appearance.logoPosition || "LEFT") === "RIGHT" ? "justify-end" : "justify-start"}`}
                  >
                    {brand.primaryLogoUrl ? (
                      <div
                        className="relative max-w-[70%]"
                        style={{
                          width: `${150 * (logoSize / 100)}px`,
                          height: `${60 * (logoSize / 100)}px`,
                        }}
                      >
                        <Image
                          src={
                            brand.primaryLogoUrl.startsWith("blob:")
                              ? brand.primaryLogoUrl
                              : `/api/brand-assets/${brand.organizerId}/logo`
                          }
                          alt="Prévia da logo do organizador"
                          fill
                          unoptimized
                          sizes="270px"
                          className="object-contain"
                        />
                      </div>
                    ) : (
                      <span className="grid h-12 w-12 place-items-center rounded-xl bg-violet-100 text-lg font-black text-violet-700">
                        {brand.publicName.trim().charAt(0).toUpperCase() || "S"}
                      </span>
                    )}
                  </div>
                </div>
                <div className="mt-4 rounded-xl border bg-white p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <label
                        htmlFor="organizer-logo-size"
                        className="text-sm font-black text-zinc-900"
                      >
                        Tamanho da logo
                      </label>
                      <p className="mt-1 text-xs text-zinc-500">
                        Ajuste como sua logo será exibida na página pública.
                      </p>
                    </div>
                    <output
                      htmlFor="organizer-logo-size"
                      className="rounded-full bg-violet-50 px-3 py-1 text-xs font-black text-violet-700"
                    >
                      {logoSize}%
                    </output>
                  </div>
                  <div className="mt-4 flex items-center gap-2">
                    <button
                      type="button"
                      aria-label="Diminuir tamanho da logo"
                      disabled={!brand.primaryLogoUrl || logoSize <= 60}
                      onClick={() =>
                        changeAppearance("logoSize", Math.max(60, logoSize - 5))
                      }
                      className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border font-black disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      −
                    </button>
                    <input
                      id="organizer-logo-size"
                      aria-label="Tamanho da logo"
                      type="range"
                      min={60}
                      max={180}
                      step={5}
                      value={logoSize}
                      disabled={!brand.primaryLogoUrl}
                      onChange={(event) =>
                        changeAppearance(
                          "logoSize",
                          normalizeLogoSize(event.target.value),
                        )
                      }
                      className="h-2 w-full cursor-pointer accent-violet-700 disabled:cursor-not-allowed disabled:opacity-40"
                    />
                    <button
                      type="button"
                      aria-label="Aumentar tamanho da logo"
                      disabled={!brand.primaryLogoUrl || logoSize >= 180}
                      onClick={() =>
                        changeAppearance(
                          "logoSize",
                          Math.min(180, logoSize + 5),
                        )
                      }
                      className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border font-black disabled:cursor-not-allowed disabled:opacity-40"
                    >
                      +
                    </button>
                  </div>
                  {!brand.primaryLogoUrl ? (
                    <p className="mt-3 text-xs font-semibold text-amber-700">
                      Adicione uma logo para ajustar o tamanho.
                    </p>
                  ) : (
                    <button
                      type="button"
                      disabled={logoSize === 100}
                      onClick={() => changeAppearance("logoSize", 100)}
                      className="mt-3 min-h-10 rounded-xl px-3 text-xs font-black text-violet-700 hover:bg-violet-50 disabled:cursor-not-allowed disabled:text-zinc-400"
                    >
                      Restaurar tamanho padrão
                    </button>
                  )}
                </div>
              </fieldset>
              <h3 className="mt-7 font-black">Perfil pessoal</h3>
              <div className="mt-3 max-w-sm">
                <Upload
                  label="Foto do perfil"
                  src={
                    brand.profileImageUrl?.startsWith("blob:")
                      ? brand.profileImageUrl
                      : brand.profileImageUrl
                        ? `/api/brand-assets/${brand.organizerId}/profile`
                        : undefined
                  }
                  accept="image/png,image/jpeg,image/webp"
                  onChange={(file) => void upload("profile", file)}
                  onRemove={() => removeAsset("profile")}
                />
              </div>
            </div>
          )}
          {tab === "aparencia" && (
            <div>
              <SectionTitle
                icon={<Palette />}
                title="Aparência"
                subtitle="Escolha qualquer cor hexadecimal válida e acompanhe a prévia."
              />
              <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {(
                  [
                    ["primaryColor", "Cor principal"],
                    ["secondaryColor", "Cor secundária"],
                    ["accentColor", "Cor de destaque"],
                    ["buttonColor", "Cor dos botões"],
                    ["progressColor", "Barra de progresso"],
                    ["textColor", "Cor dos títulos"],
                    ["backgroundColor", "Cor do fundo"],
                    ["cardColor", "Cor dos cards"],
                  ] as const
                ).map(([key, label]) => (
                  <ColorField
                    key={key}
                    label={label}
                    value={brand[key]}
                    onChange={(value) => changeBrand(key, value)}
                  />
                ))}
              </div>
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <Field label="Tema">
                  <select
                    className={input}
                    value={brand.themeMode}
                    onChange={(e) => changeBrand("themeMode", e.target.value)}
                  >
                    <option value="LIGHT">Claro</option>
                    <option value="DARK">Escuro</option>
                    <option value="AUTOMATIC">Automático</option>
                    <option value="CUSTOM">Personalizado</option>
                  </select>
                </Field>
                <Field label="Tema inicial">
                  <select
                    className={input}
                    value={String(appearance.preset || "MODERN")}
                    onChange={(e) => changeAppearance("preset", e.target.value)}
                  >
                    <option value="MINIMAL">Minimalista</option>
                    <option value="LUXURY">Luxo</option>
                    <option value="SPORT">Esportivo</option>
                    <option value="MODERN">Moderno</option>
                    <option value="PREMIUM">Premium</option>
                  </select>
                </Field>
              </div>
            </div>
          )}
          {tab === "tipografia" && (
            <div>
              <SectionTitle
                title="Tipografia"
                subtitle="Defina a leitura dos títulos e textos da campanha."
              />
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <Field label="Família tipográfica">
                  <select
                    className={input}
                    value={String(appearance.fontFamily || "Inter")}
                    onChange={(e) =>
                      changeAppearance("fontFamily", e.target.value)
                    }
                  >
                    <option value="Inter">Inter</option>
                    <option value="Arial">Arial</option>
                    <option value="Georgia">Georgia</option>
                    <option value="system-ui">Sistema do dispositivo</option>
                  </select>
                </Field>
                <Field label="Escala dos textos">
                  <select
                    className={input}
                    value={String(appearance.fontScale || "NORMAL")}
                    onChange={(e) =>
                      changeAppearance("fontScale", e.target.value)
                    }
                  >
                    <option value="COMPACT">Compacta</option>
                    <option value="NORMAL">Normal</option>
                    <option value="LARGE">Ampliada</option>
                  </select>
                </Field>
                <Field label="Peso dos títulos">
                  <select
                    className={input}
                    value={String(appearance.headingWeight || "800")}
                    onChange={(e) =>
                      changeAppearance("headingWeight", e.target.value)
                    }
                  >
                    <option value="700">Forte</option>
                    <option value="800">Extra forte</option>
                    <option value="900">Máximo destaque</option>
                  </select>
                </Field>
              </div>
            </div>
          )}
          {tab === "redes" && (
            <Networks
              data={data}
              social={social}
              setSocial={setSocial}
              community={community}
              setCommunity={setCommunity}
              saveSocial={saveSocial}
              saveCommunity={saveCommunity}
              reload={load}
            />
          )}
          {tab === "dominio" && (
            <Domains
              data={data}
              domain={domain}
              setDomain={setDomain}
              saveDomain={saveDomain}
              reload={load}
            />
          )}
          {tab === "layout" && (
            <div>
              <SectionTitle
                title="Layout da campanha"
                subtitle="O modelo atual continua como padrão; a campanha pode sobrescrever depois."
              />
              <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {[
                  ["CLASSIC", "Clássico"],
                  ["MODERN", "Moderno"],
                  ["IMAGE_FOCUS", "Destaque de imagem"],
                  ["WIDE", "Tela ampla"],
                  ["COMPACT", "Compacto"],
                  ["PREMIUM", "Premium"],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    onClick={() => changeBrand("layoutStyle", value)}
                    className={`rounded-2xl border p-5 text-left ${brand.layoutStyle === value ? "border-violet-600 bg-violet-50 ring-2 ring-violet-100" : "bg-white"}`}
                  >
                    <div className="h-24 rounded-xl bg-gradient-to-br from-zinc-100 to-violet-100" />
                    <strong className="mt-3 block">{label}</strong>
                    <span className="text-xs text-zinc-500">
                      Layout responsivo com informações obrigatórias
                      preservadas.
                    </span>
                  </button>
                ))}
              </div>
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <Field label="Mídia principal">
                  <select
                    className={input}
                    value={String(appearance.mediaMode)}
                    onChange={(e) =>
                      changeAppearance("mediaMode", e.target.value)
                    }
                  >
                    <option value="SINGLE_IMAGE">Imagem única</option>
                    <option value="AUTO_CAROUSEL">Carrossel automático</option>
                    <option value="MANUAL_CAROUSEL">Carrossel manual</option>
                    <option value="MAIN_VIDEO">Vídeo principal</option>
                    <option value="WIDE_IMAGE">Imagem ampla</option>
                    <option value="COMPACT_IMAGE">Imagem compacta</option>
                  </select>
                </Field>
                <Field label="Intervalo do carrossel (segundos)">
                  <input
                    type="number"
                    min={3}
                    max={15}
                    className={input}
                    value={Number(appearance.autoSlideSeconds)}
                    onChange={(e) =>
                      changeAppearance(
                        "autoSlideSeconds",
                        Number(e.target.value),
                      )
                    }
                  />
                </Field>
              </div>
            </div>
          )}
          {tab === "elementos" && (
            <div>
              <SectionTitle
                title="Elementos da campanha"
                subtitle="Itens obrigatórios de transparência permanecem visíveis."
              />
              <div className="mt-6 grid gap-3 md:grid-cols-2">
                {[
                  ["showParticipants", "Participantes"],
                  ["showProgress", "Percentual vendido e progresso"],
                  ["showDescription", "Descrição"],
                  ["showRegulation", "Regulamento"],
                  ["showInstantPrizes", "Cotas premiadas"],
                  ["showWinnerList", "Cotas encontradas e ganhadores"],
                  ["showSocialLinks", "Redes sociais"],
                  ["showOrganizerLogo", "Logo do organizador"],
                  ["showSlogan", "Slogan"],
                  ["showCountdown", "Contador"],
                ].map(([key, label]) => (
                  <label
                    key={key}
                    className="flex items-center justify-between rounded-xl border p-4 text-sm font-bold"
                  >
                    <span>{label}</span>
                    <input
                      type="checkbox"
                      checked={Boolean(appearance[key])}
                      onChange={(e) => changeAppearance(key, e.target.checked)}
                    />
                  </label>
                ))}
              </div>
              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <Field label="Texto do botão principal">
                  <select
                    className={input}
                    value={String(appearance.buttonText)}
                    onChange={(e) =>
                      changeAppearance("buttonText", e.target.value)
                    }
                  >
                    <option>Participar agora</option>
                    <option>Comprar títulos</option>
                    <option>Reservar títulos</option>
                    <option>Quero participar</option>
                  </select>
                </Field>
                <label className="flex items-center gap-3 rounded-xl border p-4 font-bold">
                  <input
                    type="checkbox"
                    checked={Boolean(appearance.buttonFixed)}
                    onChange={(e) =>
                      changeAppearance("buttonFixed", e.target.checked)
                    }
                  />{" "}
                  Botão fixo no rodapé
                </label>
              </div>
            </div>
          )}
          {tab === "templates" && (
            <div>
              <SectionTitle
                title="Templates de campanha"
                subtitle="Salve somente configurações; compradores, pagamentos e métricas nunca são copiados."
              />
              <form
                onSubmit={saveTemplate}
                className="mt-6 grid gap-3 md:grid-cols-4"
              >
                <input
                  required
                  className={input}
                  placeholder="Nome do template"
                  value={template.name}
                  onChange={(e) =>
                    setTemplate({ ...template, name: e.target.value })
                  }
                />
                <input
                  className={input}
                  placeholder="Descrição"
                  value={template.description}
                  onChange={(e) =>
                    setTemplate({ ...template, description: e.target.value })
                  }
                />
                <select
                  className={input}
                  value={template.sourceCampaignId}
                  onChange={(e) =>
                    setTemplate({
                      ...template,
                      sourceCampaignId: e.target.value,
                    })
                  }
                >
                  <option value="">Configuração atual</option>
                  {campaigns.map((campaign) => (
                    <option key={campaign.id} value={campaign.id}>
                      {campaign.title}
                    </option>
                  ))}
                </select>
                <button
                  disabled={busy}
                  className="mt-2 h-11 rounded-xl bg-violet-600 font-bold text-white"
                >
                  Salvar template
                </button>
              </form>
              <div className="mt-6 grid gap-3 md:grid-cols-2">
                {data.templates.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between rounded-2xl border p-4"
                  >
                    <div>
                      <strong>{item.name}</strong>
                      <p className="text-xs text-zinc-500">
                        {item.description || "Sem descrição"}
                      </p>
                    </div>
                    <button
                      aria-label="Excluir template"
                      onClick={() => void deleteTemplate(item.id).then(load)}
                      className="rounded-lg p-2 text-red-600"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
          {tab === "preview" && (
            <div className="xl:hidden">
              <PersonalizationPreview
                payload={{ campaign: selectedCampaign, brand, appearance }}
                campaignId={previewCampaignId}
                campaigns={campaigns}
                changeCampaign={setPreviewCampaignId}
              />
            </div>
          )}
        </section>
        <aside className="hidden min-w-0 self-start rounded-3xl border bg-white p-5 shadow-sm xl:sticky xl:top-5 xl:block">
          <PersonalizationPreview
            payload={{ campaign: selectedCampaign, brand, appearance }}
            campaignId={previewCampaignId}
            campaigns={campaigns}
            changeCampaign={setPreviewCampaignId}
          />
        </aside>
      </div>
    </div>
  );
}

function Networks({
  data,
  social,
  setSocial,
  community,
  setCommunity,
  saveSocial,
  saveCommunity,
  reload,
}: {
  data: Personalization;
  social: {
    id: string;
    type: string;
    label: string;
    url: string;
    isActive: boolean;
    sortOrder: number;
  };
  setSocial: (v: typeof social) => void;
  community: {
    id: string;
    type: string;
    name: string;
    description: string;
    url: string;
    isActive: boolean;
    sortOrder: number;
  };
  setCommunity: (v: typeof community) => void;
  saveSocial: (e: FormEvent) => void;
  saveCommunity: (e: FormEvent) => void;
  reload: () => Promise<void>;
}) {
  return (
    <div>
      <SectionTitle
        title="Redes sociais e comunidades"
        subtitle="Somente links ativos aparecem publicamente."
      />
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <form onSubmit={saveSocial} className="rounded-2xl bg-zinc-50 p-4">
          <h3 className="font-black">Rede social</h3>
          <select
            className={input}
            value={social.type}
            onChange={(e) => setSocial({ ...social, type: e.target.value })}
          >
            {Object.entries(socialLabels).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
          <input
            required
            type="url"
            className={input}
            placeholder="https://..."
            value={social.url}
            onChange={(e) => setSocial({ ...social, url: e.target.value })}
          />
          <input
            className={input}
            placeholder="Rótulo opcional"
            value={social.label}
            onChange={(e) => setSocial({ ...social, label: e.target.value })}
          />
          <label className="mt-3 flex gap-2 text-sm">
            <input
              type="checkbox"
              checked={social.isActive}
              onChange={(e) =>
                setSocial({ ...social, isActive: e.target.checked })
              }
            />{" "}
            Ativo
          </label>
          <button className="mt-4 h-10 w-full rounded-xl bg-violet-600 font-bold text-white">
            {social.id ? "Atualizar" : "Adicionar"}
          </button>
          <div className="mt-4 space-y-2">
            {data.socialLinks.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between rounded-xl bg-white p-3 text-sm"
              >
                <button
                  type="button"
                  onClick={() =>
                    setSocial({ ...item, label: item.label || "" })
                  }
                  className="min-w-0 text-left"
                >
                  <b>{socialLabels[item.type] || item.type}</b>
                  <span className="block truncate text-xs text-zinc-500">
                    {item.url}
                  </span>
                </button>
                <div className="flex gap-1">
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noreferrer"
                    className="p-2"
                  >
                    <ExternalLink size={16} />
                  </a>
                  <button
                    type="button"
                    onClick={() => void deleteSocial(item.id).then(reload)}
                    className="p-2 text-red-600"
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </form>
        <form onSubmit={saveCommunity} className="rounded-2xl bg-zinc-50 p-4">
          <h3 className="font-black">Comunidade</h3>
          <select
            className={input}
            value={community.type}
            onChange={(e) =>
              setCommunity({ ...community, type: e.target.value })
            }
          >
            {Object.entries(communityLabels).map(([v, l]) => (
              <option key={v} value={v}>
                {l}
              </option>
            ))}
          </select>
          <input
            required
            className={input}
            placeholder="Nome"
            value={community.name}
            onChange={(e) =>
              setCommunity({ ...community, name: e.target.value })
            }
          />
          <input
            required
            type="url"
            className={input}
            placeholder="https://..."
            value={community.url}
            onChange={(e) =>
              setCommunity({ ...community, url: e.target.value })
            }
          />
          <input
            className={input}
            placeholder="Descrição opcional"
            value={community.description}
            onChange={(e) =>
              setCommunity({ ...community, description: e.target.value })
            }
          />
          <label className="mt-3 flex gap-2 text-sm">
            <input
              type="checkbox"
              checked={community.isActive}
              onChange={(e) =>
                setCommunity({ ...community, isActive: e.target.checked })
              }
            />{" "}
            Ativa
          </label>
          <button className="mt-4 h-10 w-full rounded-xl bg-violet-600 font-bold text-white">
            {community.id ? "Atualizar" : "Adicionar"}
          </button>
          <div className="mt-4 space-y-2">
            {data.communities.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between rounded-xl bg-white p-3 text-sm"
              >
                <button
                  type="button"
                  onClick={() =>
                    setCommunity({
                      ...item,
                      description: item.description || "",
                    })
                  }
                  className="min-w-0 text-left"
                >
                  <b>{item.name}</b>
                  <span className="block truncate text-xs text-zinc-500">
                    {communityLabels[item.type] || item.type}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => void deleteCommunity(item.id).then(reload)}
                  className="p-2 text-red-600"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        </form>
      </div>
    </div>
  );
}
function Domains({
  data,
  domain,
  setDomain,
  saveDomain,
  reload,
}: {
  data: Personalization;
  domain: { type: string; domain: string; isPrimary: boolean };
  setDomain: (v: typeof domain) => void;
  saveDomain: (e: FormEvent) => void;
  reload: () => Promise<void>;
}) {
  return (
    <div>
      <SectionTitle
        icon={<Globe2 />}
        title="Domínio próprio"
        subtitle="O modo local salva a intenção e gera instruções; não altera DNS nem ativa SSL automaticamente."
      />
      <form
        onSubmit={saveDomain}
        className="mt-6 grid gap-3 md:grid-cols-[180px_1fr_auto]"
      >
        <select
          className={input}
          value={domain.type}
          onChange={(e) => setDomain({ ...domain, type: e.target.value })}
        >
          <option value="ROOT">Domínio raiz</option>
          <option value="SUBDOMAIN">Subdomínio</option>
          <option value="CAMPAIGN">Domínio de campanha</option>
        </select>
        <input
          required
          className={input}
          placeholder="premiosfulano.com.br"
          value={domain.domain}
          onChange={(e) => setDomain({ ...domain, domain: e.target.value })}
        />
        <button className="mt-2 h-11 rounded-xl bg-violet-600 px-5 font-bold text-white">
          Cadastrar
        </button>
      </form>
      <div className="mt-6 space-y-3">
        {data.domains.map((item) => (
          <article key={item.id} className="rounded-2xl border p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h3 className="font-black">{item.domain}</h3>
                <span className="mt-1 inline-block rounded-full bg-amber-50 px-3 py-1 text-xs font-bold text-amber-700">
                  {statusLabels[item.status] || item.status}
                </span>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => void verifyDomain(item.id).then(reload)}
                  className="rounded-xl bg-violet-50 px-3 py-2 text-sm font-bold text-violet-700"
                >
                  Verificar configuração
                </button>
                <button
                  onClick={() => void deleteDomain(item.id).then(reload)}
                  className="rounded-xl p-2 text-red-600"
                >
                  <Trash2 size={18} />
                </button>
              </div>
            </div>
            <div className="mt-4 rounded-xl bg-zinc-50 p-4 text-xs text-zinc-600">
              <b>Instruções DNS (sandbox)</b>
              <pre className="mt-2 overflow-auto whitespace-pre-wrap">
                {JSON.stringify(item.dnsInstructions, null, 2)}
              </pre>
            </div>
            <p className="mt-3 text-xs text-zinc-500">
              HTTPS:{" "}
              {item.httpsActive ? "Ativo" : "Aguardando verificação real"} ·
              SSL: {item.sslActive ? "Ativo" : "Não confirmado"}
            </p>
          </article>
        ))}
      </div>
    </div>
  );
}
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="text-sm font-bold text-zinc-700">
      {label}
      {children}
    </label>
  );
}
function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <Field label={label}>
      <div className="mt-2 flex h-11 items-center gap-2 rounded-xl border px-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="h-8 w-10 rounded border-0"
        />
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          pattern="^#[0-9A-Fa-f]{6}$"
          className="min-w-0 flex-1 font-mono text-sm outline-none"
        />
      </div>
    </Field>
  );
}
function Upload({
  label,
  accept,
  src,
  onChange,
  onRemove,
}: {
  label: string;
  accept: string;
  src?: string;
  onChange: (file?: File) => void;
  onRemove: () => void;
}) {
  const status = src?.startsWith("blob:")
    ? "Pronta para salvar"
    : src
      ? "Salva"
      : "Sem imagem";
  return (
    <div className="rounded-2xl border border-dashed border-violet-200 bg-violet-50/40 p-4 text-sm">
      {src ? (
        <Image
          src={src}
          width={640}
          height={256}
          unoptimized
          alt={`Prévia de ${label}`}
          className="mb-3 h-32 w-full rounded-xl bg-white object-contain"
        />
      ) : (
        <div className="mb-3 grid h-32 place-items-center rounded-xl bg-white text-zinc-400">
          Sem imagem
        </div>
      )}
      <div className="flex items-center justify-between gap-2">
        <b>{label}</b>
        <span
          className={`text-[10px] font-black ${status === "Pronta para salvar" ? "text-amber-700" : status === "Salva" ? "text-emerald-700" : "text-zinc-500"}`}
        >
          {status}
        </span>
      </div>
      <span className="mt-1 block text-xs text-zinc-500">
        PNG, JPG ou WebP · até 5 MB
      </span>
      <input
        type="file"
        aria-label={`Selecionar ${label}`}
        accept={accept}
        className="mt-3 w-full text-xs"
        onChange={(e) => {
          const file = e.target.files?.[0];
          onChange(file);
        }}
      />
      {src && (
        <button
          type="button"
          onClick={() => {
            onRemove();
          }}
          className="mt-3 text-xs font-bold text-red-600"
        >
          Remover imagem
        </button>
      )}
    </div>
  );
}
function SectionTitle({
  icon,
  title,
  subtitle,
}: {
  icon?: React.ReactNode;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="flex gap-3">
      {icon && (
        <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-violet-50 text-violet-600">
          {icon}
        </span>
      )}
      <div>
        <h2 className="text-xl font-black">{title}</h2>
        <p className="mt-1 text-sm text-zinc-500">{subtitle}</p>
      </div>
    </div>
  );
}
function normalizeLogoSize(value: unknown) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return 100;
  return Math.min(180, Math.max(60, Math.round(parsed / 5) * 5));
}
function demoPreviewCampaign(brand: Brand) {
  return {
    id: "preview-demo",
    organizerId: brand.organizerId,
    title: "Sua campanha em destaque",
    slug: "preview-demo",
    status: "DRAFT",
    category: "OTHER",
    mainPrizeName: "Prêmio principal",
    mainPrizeDescription: "Uma prévia demonstrativa da sua futura campanha.",
    shortDescription: "Veja em tempo real como sua identidade será aplicada.",
    description: "",
    regulation: "Regulamento da campanha",
    totalNumbers: 100000,
    numberPrice: 0.1,
    minimumPurchase: 10,
    maximumPurchasePerBuyer: 10000,
    numberSelectionMode: "RANDOM",
    drawBasis: "CUSTOM",
    drawDate: new Date(Date.now() + 7 * 86400000).toISOString(),
    drawTime: "20:00",
    coverImageUrl: null,
    promotionalVideoUrl: null,
    mainPrizeImageUrl: null,
    soldNumbers: 68000,
    reservedNumbers: 1200,
    grossRevenue: 6800,
    participantsCount: 1240,
    showParticipants: true,
    publishedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    galleryImages: [],
    instantPrizes: [],
    promotions: [],
    drawRuleTemplate: null,
    customization: null,
    organizer: {
      id: brand.organizerId,
      name: brand.publicName,
      verified: true,
      logoUrl: brand.primaryLogoUrl,
      slogan: brand.slogan,
      brand,
      socialLinks: [],
      communities: [],
      platformFee: 0,
    },
  } as unknown as Campaign;
}
