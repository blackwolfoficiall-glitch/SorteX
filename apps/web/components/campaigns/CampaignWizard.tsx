"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import {
  ArrowLeft,
  ArrowRight,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  LoaderCircle,
  Plus,
  Rocket,
  Save,
  Trash2,
  UploadCloud,
  Palette,
  Sparkles,
  MousePointerClick,
  Shuffle,
  Bot,
  Monitor,
  Minus,
  RefreshCw,
  Smartphone,
  ZoomIn,
  GripVertical,
  Trophy,
  Target,
} from "lucide-react";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/textarea";
import ProgressSteps from "@/components/organizador/ProgressSteps";
import {
  createCampaign,
  deleteCampaignImage,
  drawCampaignMilestone,
  evaluateCampaignMilestones,
  getCampaign,
  publishCampaign,
  updateCampaign,
  updateCampaignImage,
  uploadCampaignMedia,
  uploadCampaignMilestoneImage,
} from "@/lib/campaigns/client";
import type {
  Campaign,
  CampaignDraft,
  CampaignInstantPrizeInput,
  CampaignMilestone,
  CampaignMilestoneInput,
  CampaignPromotionInput,
  DrawBasis,
  RewardSection,
  RouletteConfigInput,
} from "@/lib/campaigns/types";
import DrawRuleBuilder from "./DrawRuleBuilder";
import FinancialSimulator from "./FinancialSimulator";
import {
  getCurrentPlan,
  getPersonalization,
  type Personalization,
} from "@/lib/organizer-platform/client";
import { getPaymentConfig } from "@/lib/payments/client";

const steps = [
  "Dados da campanha",
  "Configuração",
  "Prêmios",
  "Promoções",
  "Regra do sorteio",
  "Personalização",
  "Revisão",
];
const inputClass = "h-12 rounded-xl bg-white px-4";
const quantities = [
  100, 500, 1000, 5000, 10000, 50000, 100000, 500000, 1000000,
];
const prices = [0.1, 0.25, 0.5, 1, 2, 5, 10];
const emptyPromotion = (): CampaignPromotionInput => ({
  name: "Pacote promocional",
  numberQuantity: 400,
  packagePrice: 7,
  isPopular: false,
  isActive: true,
});
const emptyPrize = (): CampaignInstantPrizeInput => ({
  exactNumber: "",
  value: 100,
  description: "PIX premiado",
  type: "PIX",
  quantity: 1,
});
const initial: CampaignDraft = {
  showParticipants: true,
  titleDisplayMode: "SIMPLE",
  titleColorMode: "AUTO",
  customTitleColor: "#7C00FF",
  titleCompositionMode: "SINGLE",
  titleSegments: [],
  rewardSectionsOrder: ["INSTANT_WIN", "MILESTONES", "ROULETTE"],
  accentColorMode: "BLUE",
  customAccentColor: "#2563EB",
  popularQuickQuantity: 1000,
  title: "",
  slug: "",
  category: "OTHER",
  shortDescription: "",
  description: "",
  regulation: "",
  mainPrizeName: "",
  mainPrizeDescription: "",
  mainPrizeQuantity: 1,
  cashAlternative: 0,
  estimatedPrizeValue: 0,
  totalNumbers: 100000,
  numberPrice: 0.1,
  minimumPurchase: 1,
  maximumPurchasePerBuyer: 50000,
  numberSelectionMode: "RANDOM",
  customization: {
    useOrganizerDefaults: true,
    showSocialLinks: true,
    showWatermark: true,
    stickyButton: true,
  },
  drawDate: "",
  drawTime: "20:00",
  drawBasis: "LOTERIA_FEDERAL",
  salesStartAt: "",
  salesEndAt: "",
  promotions: [],
  instantPrizes: [],
  milestones: [],
  milestoneWinnersRemainEligible: true,
  customDrawRule: {
    digits: [
      { prize: 1, position: 0, order: 0 },
      { prize: 1, position: 1, order: 1 },
      { prize: 1, position: 2, order: 2 },
      { prize: 1, position: 3, order: 3 },
      { prize: 1, position: 4, order: 4 },
    ],
  },
};

export default function CampaignWizard({
  campaignId,
}: {
  campaignId?: string;
}) {
  const router = useRouter();
  const [id, setId] = useState(campaignId);
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [personalization, setPersonalization] =
    useState<Personalization | null>(null);
  const [gateway, setGateway] = useState({ name: "Mercado Pago", fee: 0 });
  const [planFee, setPlanFee] = useState(0);
  const [form, setForm] = useState<CampaignDraft>(initial);
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(Boolean(campaignId));
  const [saving, setSaving] = useState(false);
  const [milestoneBusy, setMilestoneBusy] = useState<string | null>(null);
  const [priceReductionOpen, setPriceReductionOpen] = useState(false);
  const priceReductionConfirmed = useRef(false);
  const [error, setError] = useState("");
  const [previewMode, setPreviewMode] = useState<"MOBILE" | "DESKTOP">(
    "MOBILE",
  );
  const [aiGeneration, setAiGeneration] = useState({
    description: 0,
    regulation: 0,
  });
  const [prizeCount, setPrizeCount] = useState(1);
  const [prizeMode, setPrizeMode] = useState<"MANUAL" | "AUTOMATIC">(
    "AUTOMATIC",
  );
  const [files, setFiles] = useState<{
    prizeImages: File[];
    video?: File;
  }>({ prizeImages: [] });

  useEffect(() => {
    getPersonalization()
      .then(setPersonalization)
      .catch(() => undefined);
  }, []);
  useEffect(() => {
    getCurrentPlan()
      .then((current) => setPlanFee(Number(current.plan?.platformFeeRate || 0)))
      .catch(() => undefined);
  }, []);
  useEffect(() => {
    getPaymentConfig()
      .then((config) =>
        setGateway({
          name:
            config.provider === "MERCADO_PAGO"
              ? "Mercado Pago"
              : config.provider,
          fee: config.estimatedFeePercent || 0,
        }),
      )
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    if (!campaignId) return;
    getCampaign(campaignId)
      .then((data) => {
        setCampaign(data);
        setForm(fromCampaign(data));
      })
      .catch((cause) =>
        setError(
          cause instanceof Error
            ? cause.message
            : "Não foi possível carregar o rascunho.",
        ),
      )
      .finally(() => setLoading(false));
  }, [campaignId]);
  const instantPrizeTotal = useMemo(
    () =>
      (form.instantPrizes || []).reduce(
        (total, prize) =>
          total + Number(prize.value || 0) * Number(prize.quantity || 0),
        0,
      ),
    [form.instantPrizes],
  );
  const platformFee = campaign?.organizer.platformFee ?? planFee;
  const isPublished = campaign?.status === "PUBLISHED" || campaign?.status === "PAUSED";

  function set<K extends keyof CampaignDraft>(key: K, value: CampaignDraft[K]) {
    setForm((current) => ({ ...current, [key]: value }));
  }
  function title(value: string) {
    setForm((current) => ({
      ...current,
      title: value,
      slug: current.slug || slugify(value),
    }));
  }

  function generateWithAi(target: "description" | "regulation") {
    const next = aiGeneration[target] + 1;
    const campaignTitle = form.title?.trim() || "esta campanha";
    const prize = form.mainPrizeName?.trim() || "o prêmio principal";
    if (target === "description") {
      const suggestions = [
        `Participe da campanha ${campaignTitle} e concorra a ${prize}. Escolha seus títulos, acompanhe todas as etapas pela SorteX e consulte o resultado conforme a regra registrada na campanha.`,
        `${campaignTitle} foi preparada para quem quer concorrer a ${prize} com praticidade e transparência. Crie sua participação, acompanhe seus títulos e confira o resultado diretamente na plataforma.`,
        `Sua próxima oportunidade pode estar em ${campaignTitle}. Garanta seus títulos para concorrer a ${prize} e acompanhe datas, regras e resultado na sua conta SorteX.`,
      ];
      set("mainPrizeDescription", suggestions[(next - 1) % suggestions.length]);
    } else {
      const draw =
        form.drawBasis === "LOTERIA_FEDERAL"
          ? "O resultado utilizará a extração da Loteria Federal indicada nesta campanha, aplicando a regra registrada antes do sorteio."
          : "O resultado seguirá integralmente a regra de apuração registrada nesta campanha antes da publicação.";
      const suggestions = [
        `1. A participação será confirmada após a aprovação do pagamento.\n2. Cada título confirmado permanecerá vinculado ao comprador em sua conta.\n3. ${draw}\n4. A apuração e o histórico ficarão disponíveis para consulta na SorteX.\n5. A entrega de ${prize} seguirá os dados e prazos informados pelo organizador.`,
        `Ao participar de ${campaignTitle}, o comprador declara ciência das condições desta campanha. Somente títulos com pagamento aprovado concorrem. ${draw} O ganhador será identificado pelos dados cadastrados e deverá seguir o processo de validação e entrega do prêmio.`,
      ];
      set("regulation", suggestions[(next - 1) % suggestions.length]);
    }
    setAiGeneration((current) => ({ ...current, [target]: next }));
  }

  async function persist(goNext = false) {
    if (goNext && !validateCurrentStep()) return null;
    if (
      isPublished &&
      campaign &&
      form.numberPrice !== undefined &&
      form.numberPrice < campaign.numberPrice &&
      !priceReductionConfirmed.current
    ) {
      setPriceReductionOpen(true);
      return null;
    }
    setSaving(true);
    setError("");
    try {
      validateMediaSelection(files);
      if (
        form.titleColorMode === "CUSTOM" &&
        !validHexColor(form.customTitleColor)
      )
        throw new Error("Informe uma cor hexadecimal válida para o título.");
      const payload = clean({
        ...form,
        titleSegments:
          form.titleCompositionMode === "SEGMENTS"
            ? (form.titleSegments || [])
                .filter((segment) => segment.text.trim())
                .slice(0, 3)
                .map((segment, order) => ({
                  text: segment.text.trim(),
                  color: validHexColor(segment.color)
                    ? segment.color.toUpperCase()
                    : "#FFFFFF",
                  order,
                }))
            : [],
        salesStartAt: toApiDateTime(form.salesStartAt),
        salesEndAt: toApiDateTime(form.salesEndAt),
        instantPrizes: form.instantPrizes,
        milestones: (form.milestones || []).map(
          ({ scheduledAt, ...milestone }) => {
            const normalizedScheduledAt = toOptionalApiDateTime(
              scheduledAt,
              "Revise a data do prêmio adicional antes de continuar.",
            );
            return {
              ...milestone,
              ...(normalizedScheduledAt
                ? { scheduledAt: normalizedScheduledAt }
                : {}),
            };
          },
        ),
        promotions: (form.promotions || [])
          .filter((item) => !isLegacyPopularPromotion(item))
          .map((item) => ({ ...item, isPopular: false })),
      });
      let saved = id
        ? await updateCampaign(id, payload)
        : await createCampaign(payload);
      if (!id) {
        setId(saved.id);
        router.replace(`/dashboard/campanhas/${saved.id}/editar`);
      }
      if (files.prizeImages.length) {
        saved = await uploadCampaignMedia(saved.id, "COVER", [
          files.prizeImages[0],
        ]);
        if (files.prizeImages.length > 1)
          saved = await uploadCampaignMedia(
            saved.id,
            "GALLERY",
            files.prizeImages.slice(1),
          );
      }
      if (files.video)
        saved = await uploadCampaignMedia(saved.id, "VIDEO", [files.video]);
      setFiles({ prizeImages: [] });
      setCampaign(saved);
      priceReductionConfirmed.current = false;
      setForm(fromCampaign(saved));
      if (goNext) setStep((current) => Math.min(steps.length, current + 1));
      return saved;
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível salvar o rascunho.",
      );
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function refreshMilestones(action?: {
    milestoneId: string;
    draw: boolean;
  }) {
    if (!id || milestoneBusy) return;
    setMilestoneBusy(action?.milestoneId || "evaluate");
    setError("");
    try {
      if (action?.draw) await drawCampaignMilestone(id, action.milestoneId);
      else await evaluateCampaignMilestones(id);
      const refreshed = await getCampaign(id);
      setCampaign(refreshed);
      setForm(fromCampaign(refreshed));
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível atualizar as metas.",
      );
    } finally {
      setMilestoneBusy(null);
    }
  }

  async function saveDraft() {
    const saved = await persist(false);
    if (saved) router.push(`/dashboard/campanhas?status=${isPublished?"PUBLISHED":"DRAFT"}`);
  }

  async function confirmPriceReduction(createPromotion: boolean) {
    setPriceReductionOpen(false);
    priceReductionConfirmed.current = true;
    const previousPrice = campaign?.numberPrice;
    const saved = await persist(false);
    if (saved && createPromotion)
      router.push(`/dashboard/promocoes?action=create&campaignId=${saved.id}&strategy=price-reduction&price=${form.numberPrice}&previousPrice=${previousPrice}`);
  }

  async function removeGalleryImage(imageId: string) {
    if (!id || saving) return;
    setSaving(true);setError("");
    try { const saved=await deleteCampaignImage(id,imageId);setCampaign(saved);setForm(fromCampaign(saved)); }
    catch(cause){setError(cause instanceof Error?cause.message:"Não foi possível remover a imagem.")}
    finally{setSaving(false)}
  }

  async function updateGalleryCaption(imageId:string,caption:string){if(!id||saving)return;setSaving(true);setError("");try{const saved=await updateCampaignImage(id,imageId,{caption});setCampaign(saved);setForm(fromCampaign(saved))}catch(cause){setError(cause instanceof Error?cause.message:"Não foi possível atualizar a legenda.")}finally{setSaving(false)}}
  async function moveGalleryImage(index:number,direction:-1|1){if(!id||!campaign||saving)return;const target=index+direction;if(target<0||target>=campaign.galleryImages.length)return;setSaving(true);setError("");try{await updateCampaignImage(id,campaign.galleryImages[index].id,{sortOrder:target});const saved=await updateCampaignImage(id,campaign.galleryImages[target].id,{sortOrder:index});setCampaign(saved);setForm(fromCampaign(saved))}catch(cause){setError(cause instanceof Error?cause.message:"Não foi possível reordenar as imagens.")}finally{setSaving(false)}}

  function validateCurrentStep() {
    if (step === 1) {
      if (!form.title?.trim()) {
        setError("Informe o título da campanha.");
        return false;
      }
      if (!form.mainPrizeName?.trim()) {
        setError("Informe o nome do prêmio principal.");
        return false;
      }
      if (!form.mainPrizeDescription?.trim()) {
        setError("Informe a descrição do prêmio.");
        return false;
      }
      if (!form.regulation?.trim()) {
        setError("Informe o regulamento da campanha.");
        return false;
      }
      if (!files.prizeImages.length && !campaign?.coverImageUrl) {
        setError("Adicione pelo menos uma imagem do prêmio.");
        return false;
      }
    }
    if (step === 2) {
      if (
        !form.totalNumbers ||
        form.totalNumbers < 1 ||
        form.totalNumbers > 10000000
      ) {
        setError("A quantidade deve estar entre 1 e 10.000.000 de números.");
        return false;
      }
      if (!form.numberPrice || form.numberPrice < 0.01) {
        setError("O preço por título deve ser de pelo menos R$ 0,01.");
        return false;
      }
      if (!form.numberSelectionMode) {
        setError("Escolha o modelo da campanha.");
        return false;
      }
      if (
        (form.minimumPurchase || 1) >
        (form.maximumPurchasePerBuyer || form.totalNumbers)
      ) {
        setError("A compra mínima não pode superar a compra máxima.");
        return false;
      }
    }
    if (step === 3 && !form.mainPrizeName?.trim()) {
      setError("Informe o nome do prêmio.");
      return false;
    }
    if (step === 4) {
      const roulette = rouletteFromCustomization(form.customization);
      if (roulette.enabled) {
        if (!roulette.name.trim()) {
          setError("Informe o nome da Roleta Instantânea.");
          return false;
        }
        if (
          !roulette.rules.length ||
          roulette.rules.some((rule) => rule.minQuantity < 1 || rule.rounds < 1)
        ) {
          setError("Cadastre regras válidas de quantidade e rodadas.");
          return false;
        }
        if (
          !roulette.items.some((item) => item.isActive && item.probability > 0)
        ) {
          setError(
            "Adicione ao menos um item ativo com probabilidade maior que zero.",
          );
          return false;
        }
        if (
          roulette.startsAt &&
          roulette.endsAt &&
          new Date(roulette.startsAt) >= new Date(roulette.endsAt)
        ) {
          setError("O término da roleta deve ocorrer depois do início.");
          return false;
        }
      }
    }
    setError("");
    return true;
  }

  async function publish() {
    const saved = await persist(false);
    if (!saved) return;
    setSaving(true);
    try {
      const published = await publishCampaign(saved.id);
      setCampaign(published);
      router.push(`/dashboard/campanhas/${published.id}/publicada`);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "Não foi possível publicar.",
      );
    } finally {
      setSaving(false);
    }
  }

  function createPrizeSlots() {
    const total = Math.max(1, form.totalNumbers || 1);
    const width = String(Math.max(0, total - 1)).length;
    const used = new Set(
      (form.instantPrizes || [])
        .map((prize) => prize.exactNumber)
        .filter(Boolean),
    );
    const slots = Array.from({ length: prizeCount }, () => {
      const prize = emptyPrize();
      if (prizeMode === "AUTOMATIC") {
        let number = "";
        do {
          const buffer = new Uint32Array(1);
          crypto.getRandomValues(buffer);
          number = String(buffer[0] % total).padStart(width, "0");
        } while (used.has(number));
        used.add(number);
        prize.exactNumber = number;
      }
      return prize;
    });
    set("instantPrizes", slots);
  }

  function applyFirstPrizeToAll() {
    const [source, ...rest] = form.instantPrizes || [];
    if (!source) return;
    set("instantPrizes", [
      source,
      ...rest.map((prize) => ({
        ...prize,
        description: source.description,
        type: source.type,
        value: source.value,
        quantity: 1,
      })),
    ]);
  }

  if (loading)
    return (
      <div className="flex min-h-96 items-center justify-center">
        <LoaderCircle className="animate-spin text-violet-700" />
      </div>
    );
  return (
    <main className="min-h-screen bg-zinc-50 px-4 py-7 md:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-sm font-bold uppercase tracking-wider text-violet-600">
              Módulo de campanhas
            </p>
            <h1 className="mt-2 text-3xl font-black">
              {id ? "Editar rifa" : "Criar nova rifa"}
            </h1>
            <p className="mt-2 text-zinc-500">
              {isPublished?"Atualize informações públicas sem alterar títulos emitidos ou regras do sorteio.":"Salve como rascunho e continue quando quiser."}
            </p>
          </div>
          <Button
            variant="outline"
            onClick={() => void saveDraft()}
            disabled={saving}
          >
            <Save size={17} /> {isPublished?"Salvar alterações":"Salvar rascunho"}
          </Button>
        </div>
        <ProgressSteps etapa={step} etapas={steps} />
        {error && (
          <p className="rounded-2xl bg-red-50 p-4 text-sm text-red-700">
            {error}
          </p>
        )}
        {isPublished&&<div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900"><strong>Campanha publicada:</strong> preço, conteúdo, mídias, promoções e identidade visual continuam editáveis. Quantidade emitida e regra do sorteio permanecem protegidas.</div>}

        {step === 1 && (
          <Step
            title="Dados da rifa"
            description="Apresentação, prêmio principal, datas e mídias."
          >
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Título">
                <Input
                  className={inputClass}
                  value={form.title}
                  onChange={(e) => title(e.target.value)}
                />
              </Field>
              <Field label="Slug">
                <Input
                  className={inputClass}
                  value={form.slug}
                  onChange={(e) => set("slug", slugify(e.target.value))}
                />
              </Field>
              <Field label="Categoria">
                <Select
                  value={form.category}
                  onChange={(value) =>
                    set("category", value as CampaignDraft["category"])
                  }
                  options={[
                    "AUTOMOBILE",
                    "MOTORCYCLE",
                    "ELECTRONICS",
                    "CASH",
                    "TRAVEL",
                    "OTHER",
                  ]}
                />
              </Field>
              <Field label="Descrição curta (opcional)">
                <Input
                  className={inputClass}
                  value={form.shortDescription}
                  onChange={(e) => set("shortDescription", e.target.value)}
                />
              </Field>
            </div>
            <AiFieldActions
              generated={aiGeneration.regulation > 0}
              onGenerate={() => generateWithAi("regulation")}
            />
            <Field label="Regulamento">
              <Textarea
                className="mt-2 min-h-32"
                value={form.regulation}
                onChange={(e) => set("regulation", e.target.value)}
              />
            </Field>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Nome do prêmio principal">
                <Input
                  className={inputClass}
                  value={form.mainPrizeName}
                  onChange={(e) => set("mainPrizeName", e.target.value)}
                />
              </Field>
              <Field label="Valor estimado do prêmio (opcional)">
                <NumberInput
                  value={form.estimatedPrizeValue}
                  onChange={(value) => set("estimatedPrizeValue", value)}
                />
              </Field>
              <Field label="Alternativa em PIX (opcional)">
                <NumberInput
                  value={form.cashAlternative}
                  onChange={(value) => set("cashAlternative", value)}
                />
              </Field>
              <Field label="Quantidade do prêmio">
                <NumberInput
                  value={form.mainPrizeQuantity}
                  onChange={(value) => set("mainPrizeQuantity", value)}
                />
              </Field>
            </div>
            <AiFieldActions
              generated={aiGeneration.description > 0}
              onGenerate={() => generateWithAi("description")}
            />
            <Field label="Descrição do prêmio">
              <Textarea
                className="mt-2"
                value={form.mainPrizeDescription}
                onChange={(e) => set("mainPrizeDescription", e.target.value)}
              />
            </Field>
            <Field label="Modo de exibição do título">
              <select
                className="h-12 w-full rounded-xl border bg-white px-4"
                value={form.titleDisplayMode || "SIMPLE"}
                onChange={(event) =>
                  set(
                    "titleDisplayMode",
                    event.target.value as "SIMPLE" | "HIGHLIGHT",
                  )
                }
              >
                <option value="SIMPLE">Nome simples — texto normal</option>
                <option value="HIGHLIGHT">
                  Nome em destaque — maior, mais forte e em evidência
                </option>
              </select>
            </Field>
            <div className="grid gap-4 md:grid-cols-2">
              <TitleColorEditor
                form={form}
                onChange={(patch) =>
                  setForm((current) => ({ ...current, ...patch }))
                }
              />
              <Field label="Cor de destaque da campanha">
                <Select
                  value={form.accentColorMode || "BLUE"}
                  onChange={(value) =>
                    set(
                      "accentColorMode",
                      value as CampaignDraft["accentColorMode"],
                    )
                  }
                  options={[
                    "BLUE",
                    "GREEN",
                    "RED",
                    "PURPLE",
                    "PINK",
                    "ORANGE",
                    "YELLOW",
                    "BLACK",
                    "CUSTOM",
                  ]}
                />
              </Field>
              {form.accentColorMode === "CUSTOM" && (
                <Field label="Cor personalizada">
                  <Input
                    type="color"
                    className="h-12 w-full rounded-xl"
                    value={form.customAccentColor || "#2563EB"}
                    onChange={(event) =>
                      set("customAccentColor", event.target.value.toUpperCase())
                    }
                  />
                </Field>
              )}
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Data do sorteio">
                <Input
                  className={inputClass}
                  type="date"
                  value={form.drawDate}
                  onChange={(e) => set("drawDate", e.target.value)}
                />
              </Field>
              <Field label="Horário">
                <Input
                  className={inputClass}
                  type="time"
                  value={form.drawTime}
                  onChange={(e) => set("drawTime", e.target.value)}
                />
              </Field>
              <Field label="Início das vendas">
                <Input
                  className={inputClass}
                  type="datetime-local"
                  value={form.salesStartAt}
                  onChange={(e) => set("salesStartAt", e.target.value)}
                />
              </Field>
              <Field label="Fim das vendas (opcional)">
                <Input
                  className={inputClass}
                  type="datetime-local"
                  value={form.salesEndAt}
                  onChange={(e) => set("salesEndAt", e.target.value)}
                />
              </Field>
            </div>
            <div className="rounded-3xl border bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h3 className="font-black">Mídias do prêmio</h3>
                  <p className="mt-1 text-sm text-zinc-500">
                    A primeira imagem será a principal. Arraste para reorganizar
                    antes de salvar.
                  </p>
                </div>
                <span className="rounded-full bg-violet-50 px-3 py-1 text-xs font-black text-violet-700">
                  {files.prizeImages.length +
                    (campaign?.coverImageUrl ? 1 : 0) +
                    (campaign?.galleryImages.length || 0)}{" "}
                  imagens
                </span>
              </div>
              <PrizeImageManager
                files={files.prizeImages}
                onChange={(prizeImages) =>
                  setFiles((current) => ({ ...current, prizeImages }))
                }
              />
              {campaign?.galleryImages.length? <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">{campaign.galleryImages.map((image,index)=><article key={image.id} className="overflow-hidden rounded-2xl border bg-white"><div className="relative aspect-square bg-zinc-100"><Image src={campaignMediaUrl(image.url)} alt={image.originalName||`Imagem ${index+2}`} fill sizes="180px" className="object-cover"/></div><div className="space-y-2 p-2"><Input aria-label={`Legenda da imagem ${index+2}`} defaultValue={image.originalName||""} onBlur={event=>{if(event.target.value!==image.originalName)void updateGalleryCaption(image.id,event.target.value)}} className="h-9 text-xs"/><div className="flex items-center justify-between"><div className="flex gap-1"><button type="button" disabled={saving||index===0} onClick={()=>void moveGalleryImage(index,-1)} aria-label={`Mover imagem ${index+2} para trás`} className="rounded-lg border px-2 py-1 text-xs disabled:opacity-30">←</button><button type="button" disabled={saving||index===campaign.galleryImages.length-1} onClick={()=>void moveGalleryImage(index,1)} aria-label={`Mover imagem ${index+2} para frente`} className="rounded-lg border px-2 py-1 text-xs disabled:opacity-30">→</button></div><button type="button" disabled={saving} onClick={()=>void removeGalleryImage(image.id)} aria-label={`Excluir imagem ${index+2}`} className="rounded-lg p-2 text-red-700 hover:bg-red-50 disabled:opacity-50"><Trash2 size={16}/></button></div></div></article>)}</div>:null}
              {(files.prizeImages[0] || campaign?.coverImageUrl) && (
                <HeroImageCropEditor
                  file={files.prizeImages[0]}
                  savedUrl={campaign?.coverImageUrl || null}
                  value={heroImageCrop(form.customization)}
                  onChange={(heroImage) => set("customization", { ...(form.customization || {}), heroImage })}
                />
              )}
            </div>
            <div className="grid gap-3">
              {files.video && (
                <LocalVideoPreview
                  file={files.video}
                  onRemove={() =>
                    setFiles((current) => ({ ...current, video: undefined }))
                  }
                />
              )}
              <FileBox
                title="Vídeo do prêmio"
                accept="video/mp4,video/webm"
                current={Boolean(campaign?.promotionalVideoUrl)}
                onFiles={(value) =>
                  setFiles((current) => ({ ...current, video: value[0] }))
                }
              />
            </div>
            <Actions step={step} saving={saving} next={() => persist(true)} />
          </Step>
        )}

        {step === 2 && (
          <Step
            title="Configuração"
            description="Quantidade, preço e forma de escolha dos números."
          >
            <fieldset disabled={isPublished} className={isPublished?"opacity-60":""}>
              <QuickChoices title="Quantidade de números" values={quantities} selected={form.totalNumbers || 0} format={(value) => value.toLocaleString("pt-BR")} onSelect={(value) => set("totalNumbers", value)}/>
              <div className="mt-5"><Field label="Quantidade personalizada"><NumberInput value={form.totalNumbers} onChange={(value) => set("totalNumbers", value)}/></Field></div>
              {isPublished&&<p className="mt-2 text-xs font-bold text-zinc-600">A quantidade emitida não pode ser alterada após a publicação.</p>}
            </fieldset>
            <QuickChoices
              title="Preço por número"
              values={prices}
              selected={form.numberPrice || 0}
              format={(value) => `R$ ${value.toFixed(2).replace(".", ",")}`}
              onSelect={(value) => set("numberPrice", value)}
            />
            <Field label="Preço personalizado por título">
              <NumberInput
                value={form.numberPrice}
                onChange={(value) => set("numberPrice", value)}
              />
            </Field>
            <fieldset disabled={isPublished} className={isPublished?"opacity-60":""}>
              <div className="flex items-center gap-2">
                <Sparkles className="text-violet-600" size={20} />
                <h3 className="font-black">Modelo da campanha</h3>
              </div>
              <div className="mt-3 grid gap-4 md:grid-cols-2">
                <ModelCard
                  selected={form.numberSelectionMode === "RANDOM"}
                  icon={<Shuffle />}
                  title="Automático"
                  badge="Mais utilizado"
                  description="O comprador escolhe apenas a quantidade de títulos e o sistema gera automaticamente os números."
                  onClick={() => set("numberSelectionMode", "RANDOM")}
                />
                <ModelCard
                  selected={form.numberSelectionMode === "MANUAL"}
                  icon={<MousePointerClick />}
                  title="Escolha dos números"
                  description="O comprador visualiza os números disponíveis e escolhe exatamente quais deseja comprar."
                  onClick={() => set("numberSelectionMode", "MANUAL")}
                />
              </div>
              {isPublished&&<p className="mt-2 text-xs font-bold text-zinc-600">O modelo de seleção fica protegido após a publicação.</p>}
            </fieldset>
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Compra mínima">
                <NumberInput
                  value={form.minimumPurchase}
                  onChange={(value) => set("minimumPurchase", value)}
                />
              </Field>
              <Field label="Compra máxima por pessoa">
                <NumberInput
                  value={form.maximumPurchasePerBuyer}
                  onChange={(value) => set("maximumPurchasePerBuyer", value)}
                />
              </Field>
            </div>
            <label className="flex items-center gap-3 rounded-2xl border bg-white p-4 text-sm font-bold">
              <input
                type="checkbox"
                checked={form.showParticipants !== false}
                onChange={(event) =>
                  set("showParticipants", event.target.checked)
                }
                className="h-5 w-5 accent-violet-700"
              />
              Mostrar quantidade de participantes na página da campanha
            </label>
            <FinancialSimulator
              totalNumbers={form.totalNumbers || 0}
              numberPrice={form.numberPrice || 0}
              prizeValue={form.estimatedPrizeValue || 0}
              instantPrizeTotal={instantPrizeTotal}
              platformFee={platformFee}
              gatewayName={gateway.name}
              gatewayFee={gateway.fee}
            />
            <Actions
              step={step}
              saving={saving}
              back={() => setStep(1)}
              next={() => persist(true)}
            />
          </Step>
        )}

        {step === 3 && (
          <Step
            title="Prêmios"
            description="Configure o prêmio principal e as cotas premiadas instantâneas."
          >
            <div className="rounded-2xl bg-violet-50 p-5">
              <h3 className="font-black">Prêmio principal</h3>
              <p className="mt-2 text-sm text-zinc-600">
                {form.mainPrizeName || "Ainda não informado"} · Valor estimado
                R$ {(form.estimatedPrizeValue || 0).toFixed(2)}
              </p>
            </div>
            <div className="mt-6 rounded-2xl border border-violet-100 bg-white p-5">
              <h3 className="text-xl font-black">Cotas premiadas</h3>
              <p className="mt-1 text-sm text-zinc-500">
                Crie cotas independentes manualmente ou gere números únicos
                automaticamente.
              </p>
              <div className="mt-5 grid gap-4 md:grid-cols-[1fr_180px_auto]">
                <Field label="Forma de escolha">
                  <Select
                    value={prizeMode}
                    onChange={(value) =>
                      setPrizeMode(value as "MANUAL" | "AUTOMATIC")
                    }
                    options={["AUTOMATIC", "MANUAL"]}
                  />
                </Field>
                <Field label="Quantidade de cotas">
                  <NumberInput
                    value={prizeCount}
                    onChange={(value) =>
                      setPrizeCount(
                        value === undefined
                          ? 1
                          : Math.max(1, Math.floor(value)),
                      )
                    }
                  />
                </Field>
                <div className="flex items-end">
                  <Button onClick={createPrizeSlots} className="w-full">
                    <Plus size={16} />{" "}
                    {prizeMode === "AUTOMATIC"
                      ? "Gerar todas automaticamente"
                      : "Criar cotas"}
                  </Button>
                </div>
              </div>
              {(form.instantPrizes || []).length > 1 && (
                <Button
                  className="mt-4"
                  size="sm"
                  variant="outline"
                  onClick={applyFirstPrizeToAll}
                >
                  Aplicar configuração para todas
                </Button>
              )}
            </div>
            <div className="mt-4 space-y-4">
              {(form.instantPrizes || []).map((prize, index) => (
                <Card key={index} className="p-5">
                  <div className="mb-4 flex items-center justify-between">
                    <h4 className="font-black text-violet-800">
                      Cota {index + 1}
                    </h4>
                    <span className="rounded-full bg-zinc-100 px-3 py-1 text-xs font-bold">
                      {prize.exactNumber ? "Configurada" : "Pendente"}
                    </span>
                  </div>
                  <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
                    <Field label="Número">
                      <Input
                        className={inputClass}
                        inputMode="numeric"
                        value={prize.exactNumber || ""}
                        onChange={(e) =>
                          updatePrize(index, {
                            exactNumber: e.target.value.replace(/\D/g, ""),
                            generationRule: undefined,
                          })
                        }
                      />
                    </Field>
                    <Field label="Nome do prêmio">
                      <Input
                        className={inputClass}
                        value={prize.description}
                        onChange={(e) =>
                          updatePrize(index, { description: e.target.value })
                        }
                      />
                    </Field>
                    <Field label="Valor">
                      <NumberInput
                        value={prize.value}
                        onChange={(value) => updatePrize(index, { value })}
                      />
                    </Field>
                    <Field label="Tipo">
                      <Select
                        value={prize.type}
                        onChange={(value) =>
                          updatePrize(index, {
                            type: value as CampaignInstantPrizeInput["type"],
                          })
                        }
                        options={["PIX", "PRODUCT", "GIFT_CARD", "OTHER"]}
                      />
                    </Field>
                  </div>
                  <Button
                    className="mt-3"
                    size="sm"
                    variant="ghost"
                    onClick={() =>
                      set(
                        "instantPrizes",
                        (form.instantPrizes || []).filter(
                          (_, itemIndex) => itemIndex !== index,
                        ),
                      )
                    }
                  >
                    <Trash2 size={15} /> Remover
                  </Button>
                </Card>
              ))}
            </div>
            {campaign&&campaign.milestonePrizes.length>0&&<MilestoneManager
              campaign={campaign}
              busy={milestoneBusy}
              onEvaluate={() => void refreshMilestones()}
              onDraw={(milestoneId) =>
                void refreshMilestones({ milestoneId, draw: true })
              }
            />}
            <MilestoneEditor
              campaignId={id}
              milestones={form.milestones || []}
              winnersRemainEligible={
                form.milestoneWinnersRemainEligible !== false
              }
              onChange={(milestones) => set("milestones", milestones)}
              onEligibilityChange={(value) =>
                set("milestoneWinnersRemainEligible", value)
              }
            />
            <Actions
              step={step}
              saving={saving}
              back={() => setStep(2)}
              next={() => persist(true)}
            />
          </Step>
        )}

        {step === 4 && (
          <Step
            title="Promoções"
            description="Crie pacotes; o desconto será calculado automaticamente."
          >
            {isPublished ? (
              <div className="rounded-2xl border border-violet-200 bg-violet-50 p-5">
                <h3 className="font-black text-violet-950">
                  Promoções gerenciadas com segurança
                </h3>
                <p className="mt-2 text-sm text-violet-800">
                  Para preservar utilizações e histórico, os pacotes desta
                  campanha publicada são editados no Centro de Estratégias.
                  As configurações da roleta continuam disponíveis abaixo.
                </p>
                <Button
                  className="mt-4"
                  size="sm"
                  onClick={() =>
                    router.push(`/dashboard/promocoes?campaignId=${campaign?.id}`)
                  }
                >
                  Gerenciar promoções
                </Button>
              </div>
            ) : (
              <>
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    onClick={() =>
                      set("promotions", [
                        ...(form.promotions || []),
                        emptyPromotion(),
                      ])
                    }
                  >
                    <Plus size={16} /> Promoção personalizada
                  </Button>
                </div>
                <div className="mt-4 rounded-2xl border bg-white p-5">
              <h3 className="font-black">⭐ Mais popular</h3>
              <p className="mt-1 text-sm text-zinc-500">
                Escolha uma quantidade rápida. O preço é calculado
                automaticamente pelo valor da cota.
              </p>
              <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-6">
                {[50, 100, 250, 500, 1000, 2000].map((value) => (
                  <button
                    type="button"
                    key={value}
                    onClick={() =>
                      set(
                        "popularQuickQuantity",
                        value as CampaignDraft["popularQuickQuantity"],
                      )
                    }
                    className={`rounded-xl border p-3 text-sm font-black ${form.popularQuickQuantity === value ? "border-violet-700 bg-violet-700 text-white" : "bg-white"}`}
                  >
                    +{value.toLocaleString("pt-BR")}
                    <span className="mt-1 block text-[10px] font-semibold">
                      {moneyPreview(value * (form.numberPrice || 0))}
                    </span>
                  </button>
                ))}
              </div>
                </div>
              </>
            )}
            <RouletteEditor
              campaignId={campaign?.id}
              value={rouletteFromCustomization(form.customization)}
              onChange={(roulette) =>
                set("customization", {
                  ...(form.customization || {}),
                  roulette,
                })
              }
            />
            {!isPublished && <div className="mt-4 space-y-4">
              {(form.promotions || []).map((promotion, index) => {
                const regular =
                  promotion.numberQuantity * (form.numberPrice || 0);
                const discount =
                  regular > 0
                    ? ((regular - promotion.packagePrice) / regular) * 100
                    : 0;
                return (
                  <Card key={index} className="p-5">
                    <div className="grid gap-3 md:grid-cols-4">
                      <Field label="Nome">
                        <Input
                          className={inputClass}
                          value={promotion.name}
                          onChange={(e) =>
                            updatePromotion(index, { name: e.target.value })
                          }
                        />
                      </Field>
                      <Field label="Quantidade">
                        <NumberInput
                          value={promotion.numberQuantity}
                          onChange={(value) =>
                            updatePromotion(index, { numberQuantity: value })
                          }
                        />
                      </Field>
                      <Field label="Preço do pacote">
                        <NumberInput
                          value={promotion.packagePrice}
                          onChange={(value) =>
                            updatePromotion(index, { packagePrice: value })
                          }
                        />
                      </Field>
                      <div className="rounded-xl bg-green-50 p-3">
                        <p className="text-xs text-green-700">
                          Desconto calculado
                        </p>
                        <p className="mt-1 text-xl font-black text-green-700">
                          {Math.max(0, discount).toFixed(1)}%
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 flex flex-wrap gap-4">
                      <label className="text-sm">
                        <input
                          type="checkbox"
                          checked={promotion.isActive}
                          onChange={(e) =>
                            updatePromotion(index, {
                              isActive: e.target.checked,
                            })
                          }
                        />{" "}
                        Ativa
                      </label>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          set(
                            "promotions",
                            (form.promotions || []).filter(
                              (_, itemIndex) => itemIndex !== index,
                            ),
                          )
                        }
                      >
                        <Trash2 size={15} /> Remover
                      </Button>
                    </div>
                  </Card>
                );
              })}
            </div>}
            <Actions
              step={step}
              saving={saving}
              back={() => setStep(3)}
              next={() => persist(true)}
            />
          </Step>
        )}

        {step === 5 && (
          <Step
            title="Regra do sorteio"
            description="Escolha a base e simule uma regra com dados fictícios."
          >
            {isPublished?<div className="rounded-2xl border bg-zinc-50 p-5"><p className="font-black">Regra protegida após a publicação</p><p className="mt-2 text-sm text-zinc-600">A base, o tipo e a regra do sorteio permanecem exatamente como foram publicados.</p></div>:<><Field label="Base do sorteio">
              <Select value={form.drawBasis} onChange={(value) => set("drawBasis", value as DrawBasis)} options={["LOTERIA_FEDERAL", "CUSTOM", "MANUAL_RESULT"]}/>
            </Field>
            {form.drawBasis !== "MANUAL_RESULT" ? (
              <DrawRuleBuilder
                templateId={form.drawRuleTemplateId}
                customRule={form.customDrawRule}
                onTemplate={(value) => set("drawRuleTemplateId", value)}
                onCustom={(value) => set("customDrawRule", value)}
              />
            ) : (
              <div className="rounded-2xl bg-amber-50 p-5 text-sm text-amber-800">
                O resultado será informado manualmente em um módulo futuro.
                Nenhum sorteio real será executado agora.
              </div>
            )}</>}
            <Actions
              step={step}
              saving={saving}
              back={() => setStep(4)}
              next={() => persist(true)}
            />
          </Step>
        )}

        {step === 6 && (
          <Step
            title="Personalização"
            description="Use a identidade global ou personalize somente esta campanha."
          >
            <label className="flex items-center gap-3 rounded-2xl border bg-white p-4 font-bold">
              <input
                type="checkbox"
                checked={form.customization?.useOrganizerDefaults !== false}
                onChange={(event) =>
                  set("customization", {
                    ...(form.customization || {}),
                    useOrganizerDefaults: event.target.checked,
                  })
                }
                className="h-5 w-5 accent-violet-700"
              />
              Usar identidade padrão do organizador
            </label>
            <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
              <div className="space-y-5 rounded-3xl border bg-white p-5">
                <div className="flex items-center gap-2">
                  <Palette className="text-violet-600" />
                  <h3 className="font-black">Aparência desta campanha</h3>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <ColorField
                    label="Cor principal"
                    value={String(
                      form.customization?.primaryColor ||
                        personalization?.brand.primaryColor ||
                        "#6D28D9",
                    )}
                    onChange={(value) =>
                      set("customization", {
                        ...(form.customization || {}),
                        useOrganizerDefaults: false,
                        primaryColor: value,
                      })
                    }
                  />
                  <ColorField
                    label="Cor dos botões"
                    value={String(
                      form.customization?.buttonColor ||
                        personalization?.brand.buttonColor ||
                        "#2563EB",
                    )}
                    onChange={(value) =>
                      set("customization", {
                        ...(form.customization || {}),
                        useOrganizerDefaults: false,
                        buttonColor: value,
                      })
                    }
                  />
                </div>
                <Field label="Layout">
                  <Select
                    value={String(
                      form.customization?.layoutStyle ||
                        personalization?.brand.layoutStyle ||
                        "MODERN",
                    )}
                    onChange={(value) =>
                      set("customization", {
                        ...(form.customization || {}),
                        useOrganizerDefaults: false,
                        layoutStyle: value,
                      })
                    }
                    options={[
                      "CLASSIC",
                      "MODERN",
                      "IMAGE_FOCUS",
                      "COMPACT",
                      "PREMIUM",
                    ]}
                  />
                </Field>
                <Field label="Tema">
                  <Select
                    value={String(
                      form.customization?.themeMode ||
                        personalization?.brand.themeMode ||
                        "LIGHT",
                    )}
                    onChange={(value) =>
                      set("customization", {
                        ...(form.customization || {}),
                        useOrganizerDefaults: false,
                        themeMode: value,
                      })
                    }
                    options={["LIGHT", "DARK", "AUTO", "CUSTOM"]}
                  />
                </Field>
                <RewardSectionsOrderEditor
                  value={rewardSectionsOrder(form.rewardSectionsOrder)}
                  onChange={(rewardSectionsOrder) =>
                    set("rewardSectionsOrder", rewardSectionsOrder)
                  }
                />
                <div className="grid gap-3 sm:grid-cols-2">
                  <Toggle
                    label="Mostrar redes sociais"
                    checked={form.customization?.showSocialLinks !== false}
                    onChange={(value) =>
                      set("customization", {
                        ...(form.customization || {}),
                        showSocialLinks: value,
                      })
                    }
                  />
                  <Toggle
                    label="Mostrar marca d'água SorteX"
                    checked={form.customization?.showWatermark !== false}
                    onChange={(value) =>
                      set("customization", {
                        ...(form.customization || {}),
                        showWatermark: value,
                      })
                    }
                  />
                  <Toggle
                    label="Mostrar participantes"
                    checked={form.showParticipants !== false}
                    onChange={(value) => set("showParticipants", value)}
                  />
                  <Toggle
                    label="Botão fixo no rodapé"
                    checked={form.customization?.stickyButton !== false}
                    onChange={(value) =>
                      set("customization", {
                        ...(form.customization || {}),
                        stickyButton: value,
                      })
                    }
                  />
                </div>
              </div>
              <div className="rounded-3xl border bg-zinc-950 p-4 text-white shadow-xl lg:sticky lg:top-5 lg:self-start">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-black uppercase tracking-wider text-violet-300">
                      Prévia em tempo real
                    </p>
                    <p className="mt-1 text-xs text-zinc-400">
                      Atualizada enquanto você edita.
                    </p>
                  </div>
                  <div className="flex rounded-xl bg-white/10 p-1">
                    <PreviewModeButton
                      active={previewMode === "MOBILE"}
                      onClick={() => setPreviewMode("MOBILE")}
                      icon={<Smartphone size={14} />}
                      label="Celular"
                    />
                    <PreviewModeButton
                      active={previewMode === "DESKTOP"}
                      onClick={() => setPreviewMode("DESKTOP")}
                      icon={<Monitor size={14} />}
                      label="Desktop"
                    />
                  </div>
                </div>
                <CampaignLivePreview
                  mode={previewMode}
                  form={form}
                  files={files.prizeImages}
                  campaign={campaign}
                  personalization={personalization}
                />
                <p className="mt-4 text-xs text-zinc-400">
                  A logo e as redes sociais são herdadas automaticamente da
                  identidade do organizador.
                </p>
              </div>
            </div>
            <Actions
              step={step}
              saving={saving}
              back={() => setStep(5)}
              next={() => persist(true)}
            />
          </Step>
        )}

        {step === 7 && (
          <Step
            title="Revisão e publicação"
            description="Confira o resumo e envie a campanha."
          >
            <div className="grid gap-4 md:grid-cols-2">
              <Summary
                title="Campanha"
                lines={[
                  form.title || "Sem título",
                  form.shortDescription || "Sem descrição",
                  optionLabel(form.category || "OTHER"),
                ]}
              />
              <Summary
                title="Prêmio"
                lines={[
                  form.mainPrizeName || "Não informado",
                  `R$ ${(form.estimatedPrizeValue || 0).toFixed(2)}`,
                  form.cashAlternative
                    ? `PIX alternativo: R$ ${form.cashAlternative.toFixed(2)}`
                    : "Sem alternativa",
                ]}
              />
              <Summary
                title="Configuração"
                lines={[
                  `${(form.totalNumbers || 0).toLocaleString("pt-BR")} números`,
                  `R$ ${(form.numberPrice || 0).toFixed(2)} por número`,
                  `Compra mínima: ${form.minimumPurchase || 0}`,
                ]}
              />
              <Summary
                title="Recursos"
                lines={[
                  `${form.promotions?.length || 0} promoções`,
                  `${form.instantPrizes?.length || 0} cotas premiadas`,
                  form.drawRuleTemplateId
                    ? "Modelo de regra selecionado"
                    : "Regra personalizada",
                ]}
              />
            </div>
            <div className="mt-6 rounded-2xl bg-zinc-50 p-5">
              <h3 className="font-black">Identidade do organizador</h3>
              <p className="mt-2 text-sm text-zinc-600">
                {campaign?.organizer.name || "Será carregada após salvar"}{" "}
                {campaign?.organizer.verified
                  ? "· Organizador verificado"
                  : "· Publicação imediata"}
              </p>
            </div>
            <div className="mt-8 flex flex-wrap justify-between gap-3">
              <Button variant="outline" onClick={() => setStep(6)}>
                <ArrowLeft size={17} /> Voltar
              </Button>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={() => void saveDraft()}
                  disabled={saving}
                >
                  <Save size={17} /> {isPublished?"Salvar alterações":"Salvar rascunho"}
                </Button>
                {!isPublished&&<Button onClick={publish} disabled={saving}><Rocket size={17} /> Publicar campanha</Button>}
              </div>
            </div>
          </Step>
        )}
      </div>
      {priceReductionOpen&&<div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/50 p-4" role="presentation"><section role="dialog" aria-modal="true" aria-labelledby="price-reduction-title" className="w-full max-w-lg rounded-3xl bg-white p-6 shadow-2xl"><h2 id="price-reduction-title" className="text-2xl font-black">O valor da cota foi reduzido.</h2><p className="mt-3 text-zinc-600">Deseja criar uma promoção oficial utilizando esse novo valor?</p><div className="mt-6 grid gap-2 sm:grid-cols-3"><Button onClick={()=>void confirmPriceReduction(true)} disabled={saving}>Criar promoção</Button><Button variant="outline" onClick={()=>void confirmPriceReduction(false)} disabled={saving}>Somente atualizar preço</Button><Button variant="ghost" onClick={()=>setPriceReductionOpen(false)} disabled={saving}>Cancelar</Button></div></section></div>}
    </main>
  );

  function updatePrize(
    index: number,
    value: Partial<CampaignInstantPrizeInput>,
  ) {
    set(
      "instantPrizes",
      (form.instantPrizes || []).map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...value } : item,
      ),
    );
  }
  function updatePromotion(
    index: number,
    value: Partial<CampaignPromotionInput>,
  ) {
    set(
      "promotions",
      (form.promotions || []).map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...value } : item,
      ),
    );
  }
}

function Step({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="p-6 md:p-8">
      <h2 className="text-2xl font-black">{title}</h2>
      <p className="mt-1 text-sm text-zinc-500">{description}</p>
      <div className="mt-7 space-y-5">{children}</div>
    </Card>
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
    <label className="block text-sm font-semibold text-zinc-700">
      {label}
      <div className="mt-2">{children}</div>
    </label>
  );
}
function NumberInput({
  value,
  onChange,
}: {
  value?: number;
  onChange: (value: number | undefined) => void;
}) {
  const [draft, setDraft] = useState(value == null ? "" : String(value));
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (document.activeElement !== inputRef.current)
      setDraft(value == null ? "" : String(value));
  }, [value]);
  return (
    <Input
      ref={inputRef}
      className={inputClass}
      type="number"
      min="0"
      step="0.01"
      value={draft}
      onChange={(e) => {
        const next = e.target.value;
        setDraft(next);
        if (next !== "") onChange(Number(next));
      }}
      onBlur={() => {
        if (draft === "") onChange(undefined);
      }}
    />
  );
}
function Select({
  value,
  options,
  onChange,
}: {
  value?: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <select
      className="h-12 w-full rounded-xl border bg-white px-4"
      value={value}
      onChange={(e) => onChange(e.target.value)}
    >
      {options.map((option) => (
        <option key={option} value={option}>
          {optionLabel(option)}
        </option>
      ))}
    </select>
  );
}
function Actions({
  saving,
  back,
  next,
}: {
  step: number;
  saving: boolean;
  back?: () => void;
  next: () => void;
}) {
  return (
    <div className="mt-8 flex justify-between">
      {back ? (
        <Button variant="outline" onClick={back}>
          <ArrowLeft size={17} /> Voltar
        </Button>
      ) : (
        <span />
      )}
      <Button onClick={next} disabled={saving}>
        {saving ? (
          <LoaderCircle className="animate-spin" size={17} />
        ) : (
          <ArrowRight size={17} />
        )}{" "}
        Salvar e continuar
      </Button>
    </div>
  );
}
function QuickChoices({
  title,
  values,
  selected,
  format,
  onSelect,
}: {
  title: string;
  values: number[];
  selected: number;
  format: (value: number) => string;
  onSelect: (value: number) => void;
}) {
  return (
    <div>
      <p className="text-sm font-bold">{title}</p>
      <div className="mt-3 flex flex-wrap gap-2">
        {values.map((value) => (
          <button
            key={value}
            onClick={() => onSelect(value)}
            className={`rounded-xl border px-3 py-2 text-sm font-semibold ${selected === value ? "border-violet-600 bg-violet-50 text-violet-700" : "bg-white"}`}
          >
            {format(value)}
          </button>
        ))}
      </div>
    </div>
  );
}

function ModelCard({
  selected,
  icon,
  title,
  description,
  badge,
  onClick,
}: {
  selected: boolean;
  icon: React.ReactNode;
  title: string;
  description: string;
  badge?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative rounded-3xl border-2 p-6 text-left transition duration-200 hover:-translate-y-0.5 hover:shadow-md ${selected ? "border-violet-600 bg-violet-50 shadow-sm" : "border-zinc-200 bg-white"}`}
    >
      {badge && (
        <span className="absolute right-4 top-4 rounded-full bg-violet-700 px-3 py-1 text-[10px] font-black uppercase text-white">
          {badge}
        </span>
      )}
      <span
        className={`grid h-12 w-12 place-items-center rounded-2xl ${selected ? "bg-violet-700 text-white" : "bg-zinc-100 text-zinc-500"}`}
      >
        {icon}
      </span>
      <h4 className="mt-5 text-lg font-black">
        {title}
        {title === "Automático" && (
          <span className="ml-2 text-xs text-violet-600">Recomendado</span>
        )}
      </h4>
      <p className="mt-2 text-sm leading-6 text-zinc-500">{description}</p>
    </button>
  );
}

function AiFieldActions({
  generated,
  onGenerate,
}: {
  generated: boolean;
  onGenerate: () => void;
}) {
  return (
    <div className="flex justify-end">
      <button
        type="button"
        onClick={onGenerate}
        className="mb-2 inline-flex items-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-black text-violet-700 transition hover:-translate-y-0.5 hover:shadow-sm"
      >
        {generated ? <RefreshCw size={15} /> : <Bot size={15} />}{" "}
        {generated ? "Gerar novamente" : "Gerar com IA"}
      </button>
    </div>
  );
}

function PreviewModeButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1 rounded-lg px-2 py-1.5 text-[10px] font-black transition ${active ? "bg-white text-zinc-950" : "text-zinc-300"}`}
    >
      {icon}
      {label}
    </button>
  );
}

type HeroViewport = { x: number; y: number; zoom: number };
type HeroImageCrop = { desktop: HeroViewport; mobile: HeroViewport };
const defaultHeroCrop: HeroImageCrop = {
  desktop: { x: 50, y: 50, zoom: 1 },
  mobile: { x: 50, y: 50, zoom: 1 },
};

const rewardSectionMeta: Record<
  RewardSection,
  { label: string; icon: React.ReactNode }
> = {
  INSTANT_WIN: {
    label: "Cotas premiadas",
    icon: <Sparkles size={18} aria-hidden />,
  },
  MILESTONES: {
    label: "Prêmios por Meta",
    icon: <Trophy size={18} aria-hidden />,
  },
  ROULETTE: {
    label: "Roletas instantâneas",
    icon: <Target size={18} aria-hidden />,
  },
};

function rewardSectionsOrder(value: unknown): RewardSection[] {
  const fallback: RewardSection[] = [
    "INSTANT_WIN",
    "MILESTONES",
    "ROULETTE",
  ];
  if (
    !Array.isArray(value) ||
    value.length !== fallback.length ||
    new Set(value).size !== fallback.length ||
    value.some(
      (item) =>
        typeof item !== "string" ||
        !fallback.includes(item as RewardSection),
    )
  )
    return fallback;
  return value as RewardSection[];
}

function RewardSectionsOrderEditor({
  value,
  onChange,
}: {
  value: RewardSection[];
  onChange: (value: RewardSection[]) => void;
}) {
  const [dragged, setDragged] = useState<RewardSection | null>(null);
  const move = (index: number, direction: -1 | 1) => {
    const destination = index + direction;
    if (destination < 0 || destination >= value.length) return;
    const next = [...value];
    [next[index], next[destination]] = [next[destination], next[index]];
    onChange(next);
  };
  const drop = (target: RewardSection) => {
    if (!dragged || dragged === target) return setDragged(null);
    const next = value.filter((section) => section !== dragged);
    next.splice(next.indexOf(target), 0, dragged);
    onChange(next);
    setDragged(null);
  };
  return (
    <section className="rounded-2xl border border-violet-100 bg-violet-50/50 p-4 sm:col-span-2">
      <h4 className="font-black text-zinc-900">Ordem das premiações</h4>
      <p className="mt-1 text-xs leading-5 text-zinc-600">
        Arraste os blocos para escolher a ordem em que aparecerão na página
        pública.
      </p>
      <ol className="mt-4 space-y-2">
        {value.map((section, index) => (
          <li
            key={section}
            draggable
            onDragStart={() => setDragged(section)}
            onDragEnd={() => setDragged(null)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={() => drop(section)}
            className={`flex min-h-14 items-center gap-3 rounded-xl border bg-white p-2 shadow-sm transition ${dragged === section ? "opacity-50 ring-2 ring-violet-300" : ""}`}
          >
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-violet-100 font-black text-violet-800">
              {index + 1}
            </span>
            <span className="text-violet-700">
              {rewardSectionMeta[section].icon}
            </span>
            <span className="min-w-0 flex-1 text-sm font-bold">
              {rewardSectionMeta[section].label}
            </span>
            <button
              type="button"
              aria-label={`Mover ${rewardSectionMeta[section].label} para cima`}
              disabled={index === 0}
              onClick={() => move(index, -1)}
              className="grid h-10 w-10 place-items-center rounded-lg border disabled:opacity-30"
            >
              <ArrowUp size={17} />
            </button>
            <button
              type="button"
              aria-label={`Mover ${rewardSectionMeta[section].label} para baixo`}
              disabled={index === value.length - 1}
              onClick={() => move(index, 1)}
              className="grid h-10 w-10 place-items-center rounded-lg border disabled:opacity-30"
            >
              <ArrowDown size={17} />
            </button>
            <span
              className="grid h-10 w-8 cursor-grab place-items-center text-zinc-400"
              aria-label={`Arrastar ${rewardSectionMeta[section].label}`}
            >
              <GripVertical size={19} />
            </span>
          </li>
        ))}
      </ol>
      <div className="mt-4 rounded-xl border border-dashed border-violet-200 bg-white p-3">
        <p className="text-[10px] font-black uppercase tracking-wider text-violet-700">
          Prévia da ordem
        </p>
        <div className="mt-2 space-y-1.5">
          {value.map((section) => (
            <div
              key={section}
              className="rounded-lg bg-zinc-100 px-3 py-2 text-xs font-bold text-zinc-700"
            >
              {rewardSectionMeta[section].label}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function TitleColorEditor({
  form,
  onChange,
}: {
  form: CampaignDraft;
  onChange: (patch: Partial<CampaignDraft>) => void;
}) {
  const composition = form.titleCompositionMode || "SINGLE";
  const customColor = form.customTitleColor || "#7C00FF";
  const segments = form.titleSegments || [];
  const addSegment = () => {
    if (segments.length >= 3) return;
    const remaining =
      segments.length === 0 ? form.title || "" : "";
    onChange({
      titleSegments: [
        ...segments,
        { text: remaining, color: customColor, order: segments.length },
      ],
    });
  };
  const updateSegment = (
    index: number,
    patch: Partial<(typeof segments)[number]>,
  ) =>
    onChange({
      titleSegments: segments.map((segment, itemIndex) =>
        itemIndex === index ? { ...segment, ...patch } : segment,
      ),
    });
  const moveSegment = (index: number, direction: -1 | 1) => {
    const destination = index + direction;
    if (destination < 0 || destination >= segments.length) return;
    const reordered = [...segments];
    [reordered[index], reordered[destination]] = [
      reordered[destination],
      reordered[index],
    ];
    onChange({
      titleSegments: reordered.map((segment, order) => ({ ...segment, order })),
    });
  };
  return (
    <div className="md:col-span-2 rounded-2xl border bg-zinc-50 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-black text-zinc-800">Cor do título</p>
          <p className="mt-1 text-xs text-zinc-500">
            Use uma cor única ou divida o título em até três partes.
          </p>
        </div>
        <div className="inline-flex rounded-xl bg-white p-1 shadow-sm" role="group" aria-label="Modo de cor do título">
          {(["SINGLE", "SEGMENTS"] as const).map((mode) => (
            <button
              key={mode}
              type="button"
              aria-pressed={composition === mode}
              onClick={() =>
                onChange({
                  titleCompositionMode: mode,
                  ...(mode === "SEGMENTS" && segments.length === 0
                    ? {
                        titleSegments: [
                          {
                            text: form.title || "",
                            color: customColor,
                            order: 0,
                          },
                        ],
                      }
                    : {}),
                })
              }
              className={`min-h-10 rounded-lg px-3 text-xs font-black ${composition === mode ? "bg-violet-700 text-white" : "text-zinc-600"}`}
            >
              {mode === "SINGLE" ? "Cor única" : "Cores por partes"}
            </button>
          ))}
        </div>
      </div>
      {composition === "SINGLE" ? (
        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_180px]">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              ["AUTO", "Automático", "#71717A"],
              ["WHITE", "Branco", "#FFFFFF"],
              ["BLACK", "Preto", "#111111"],
              ["BLUE", "Azul SorteX", "#2563EB"],
            ].map(([value, label, color]) => (
              <button
                key={value}
                type="button"
                aria-pressed={form.titleColorMode === value}
                onClick={() =>
                  onChange({
                    titleColorMode: value as CampaignDraft["titleColorMode"],
                  })
                }
                className={`flex min-h-11 items-center gap-2 rounded-xl border px-3 text-left text-xs font-bold ${form.titleColorMode === value ? "border-violet-600 ring-2 ring-violet-100" : "bg-white"}`}
              >
                <span
                  className="h-5 w-5 shrink-0 rounded-full border"
                  style={{ backgroundColor: color }}
                />
                {label}
              </button>
            ))}
          </div>
          <label className="relative flex min-h-11 cursor-pointer items-center justify-between overflow-hidden rounded-xl border bg-white px-3 text-xs font-black">
            <span>Escolher outra cor</span>
            <span
              className="h-7 w-12 rounded-lg border border-white/70"
              style={{
                background:
                  "linear-gradient(90deg,#ef4444,#f59e0b,#22c55e,#3b82f6,#8b5cf6,#ec4899)",
              }}
            />
            <input
              type="color"
              aria-label="Escolher outra cor para o título"
              className="absolute inset-0 cursor-pointer opacity-0"
              value={customColor}
              onChange={(event) =>
                onChange({
                  titleColorMode: "CUSTOM",
                  customTitleColor: event.target.value.toUpperCase(),
                })
              }
            />
          </label>
          {form.titleColorMode === "CUSTOM" && (
            <label className="sm:col-span-2 text-xs font-bold text-zinc-700">
              Cor hexadecimal
              <Input
                className="mt-1 h-10 bg-white font-mono uppercase"
                value={customColor}
                onChange={(event) => {
                  const value = event.target.value.toUpperCase();
                  onChange({ customTitleColor: value });
                }}
                onBlur={() => {
                  if (!validHexColor(customColor))
                    onChange({ customTitleColor: "#7C00FF" });
                }}
                aria-invalid={!validHexColor(customColor)}
              />
            </label>
          )}
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {segments.map((segment, index) => (
            <div
              key={`${index}-${segment.order}`}
              className="grid gap-2 rounded-xl border bg-white p-3 sm:grid-cols-[1fr_110px_auto]"
            >
              <Input
                aria-label={`Texto da parte ${index + 1}`}
                value={segment.text}
                maxLength={120}
                onChange={(event) =>
                  updateSegment(index, { text: event.target.value })
                }
                placeholder={`Parte ${index + 1}`}
              />
              <label className="flex min-h-10 items-center gap-2 rounded-xl border px-2 text-xs font-bold">
                <input
                  type="color"
                  aria-label={`Cor da parte ${index + 1}`}
                  value={validHexColor(segment.color) ? segment.color : "#FFFFFF"}
                  onChange={(event) =>
                    updateSegment(index, {
                      color: event.target.value.toUpperCase(),
                    })
                  }
                />
                {segment.color}
              </label>
              <div className="flex gap-1">
                <button type="button" aria-label={`Mover parte ${index + 1} para cima`} disabled={index === 0} onClick={() => moveSegment(index, -1)} className="rounded-lg border px-2 disabled:opacity-30">↑</button>
                <button type="button" aria-label={`Mover parte ${index + 1} para baixo`} disabled={index === segments.length - 1} onClick={() => moveSegment(index, 1)} className="rounded-lg border px-2 disabled:opacity-30">↓</button>
                <button type="button" aria-label={`Remover parte ${index + 1}`} onClick={() => onChange({ titleSegments: segments.filter((_, itemIndex) => itemIndex !== index).map((item, order) => ({ ...item, order })) })} className="rounded-lg border px-2 text-red-700"><Trash2 size={15}/></button>
              </div>
            </div>
          ))}
          <Button type="button" size="sm" variant="outline" disabled={segments.length >= 3} onClick={addSegment}>
            <Plus size={15} /> Adicionar parte
          </Button>
        </div>
      )}
      <div className="mt-4 rounded-xl bg-zinc-900 p-4 text-center text-xl font-black drop-shadow">
        <CampaignTitleText form={form} fallback="Prévia do título" />
      </div>
      <p className="mt-2 text-xs text-amber-800">
        Confira o contraste sobre a imagem. Se necessário, mantenha a sombra ou
        use uma cor mais clara.
      </p>
    </div>
  );
}

function CampaignTitleText({
  form,
  fallback,
}: {
  form: CampaignDraft;
  fallback: string;
}) {
  if (
    form.titleCompositionMode === "SEGMENTS" &&
    (form.titleSegments || []).some((segment) => segment.text.trim())
  )
    return (
      <>
        {[...(form.titleSegments || [])]
          .sort((first, second) => first.order - second.order)
          .filter((segment) => segment.text.trim())
          .map((segment, index) => (
            <span
              key={`${segment.order}-${index}`}
              style={{ color: validHexColor(segment.color) ? segment.color : "#FFFFFF" }}
            >
              {index > 0 ? " " : ""}
              {segment.text}
            </span>
          ))}
      </>
    );
  const color =
    form.titleColorMode === "WHITE"
      ? "#FFFFFF"
      : form.titleColorMode === "BLACK"
        ? "#111111"
        : form.titleColorMode === "BLUE"
          ? "#2563EB"
          : form.titleColorMode === "CUSTOM" && validHexColor(form.customTitleColor)
            ? form.customTitleColor
            : "#FFFFFF";
  return <span style={{ color }}>{form.title || fallback}</span>;
}

function validHexColor(value: unknown): value is string {
  return typeof value === "string" && /^#[0-9A-Fa-f]{6}$/.test(value);
}

function HeroImageCropEditor({ file, savedUrl, value, onChange, variant = "HERO" }: { file?: File; savedUrl: string | null; value: HeroImageCrop; onChange: (value: HeroImageCrop) => void; variant?: "HERO" | "MILESTONE" }) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"DESKTOP" | "MOBILE">("DESKTOP");
  const [draft, setDraft] = useState<HeroImageCrop>(value);
  const fileKey = file ? `${file.name}:${file.size}:${file.lastModified}` : null;
  const [localPreview, setLocalPreview] = useState<{
    fileKey: string;
    url: string;
  } | null>(null);
  const [failedFileKey, setFailedFileKey] = useState<string | null>(null);
  const source =
    file && localPreview?.fileKey === fileKey
      ? localPreview.url
      : !file && savedUrl
        ? campaignMediaUrl(savedUrl)
        : null;
  const [imageState, setImageState] = useState<{
    source: string;
    status: "READY" | "ERROR";
  } | null>(null);
  const imageReady = Boolean(
    source && imageState?.source === source && imageState.status === "READY",
  );
  const imageFailed =
    (fileKey !== null && failedFileKey === fileKey) ||
    Boolean(
      source && imageState?.source === source && imageState.status === "ERROR",
    );
  useEffect(() => {
    if (!file || !fileKey) return;
    let active = true;
    const objectUrl = URL.createObjectURL(file);
    const probe = new window.Image();
    probe.onload = () => {
      if (active) {
        setFailedFileKey(null);
        setLocalPreview({ fileKey, url: objectUrl });
      }
    };
    probe.onerror = () => {
      if (active) setFailedFileKey(fileKey);
    };
    probe.src = objectUrl;
    return () => {
      active = false;
      probe.onload = null;
      probe.onerror = null;
      URL.revokeObjectURL(objectUrl);
    };
  }, [file, fileKey]);
  const current = mode === "MOBILE" ? draft.mobile : draft.desktop;
  const update = (patch: Partial<HeroViewport>) => setDraft(existing => ({ ...existing, [mode === "MOBILE" ? "mobile" : "desktop"]: { ...current, ...patch } }));
  const point = (event: React.PointerEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    update({ x: Math.round(Math.max(0, Math.min(100, ((event.clientX - rect.left) / rect.width) * 100))), y: Math.round(Math.max(0, Math.min(100, ((event.clientY - rect.top) / rect.height) * 100))) });
  };
  return <div className="mt-4 rounded-2xl border border-violet-100 bg-violet-50 p-4">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><h4 className="font-black">{variant === "MILESTONE" ? "Ajustar foto do prêmio" : "Ajustar imagem de destaque"}</h4><p className="mt-1 text-xs text-zinc-600">{variant === "MILESTONE" ? "A prévia usa a proporção real do card Prêmios por Meta." : "Ajuste o enquadramento para destacar melhor o prêmio."}</p></div><Button type="button" size="sm" variant="outline" disabled={!source || imageFailed} onClick={() => { setDraft(value); setOpen(true); }}><MousePointerClick size={16}/> {source ? "Ajustar imagem" : "Preparando imagem..."}</Button></div>
    {open && <div className="fixed inset-0 z-[100] overflow-y-auto bg-black/60 p-0 sm:p-6" role="dialog" aria-modal="true" aria-label={variant === "MILESTONE" ? "Ajustar foto do prêmio por meta" : "Ajustar imagem de destaque"}><div className="mx-auto min-h-full max-w-5xl bg-white p-4 shadow-2xl sm:min-h-0 sm:rounded-3xl sm:p-6"><header className="flex items-start justify-between gap-4"><div><h3 className="text-xl font-black">{variant === "MILESTONE" ? "Ajustar foto do Prêmio por Meta" : "Ajustar imagem de destaque"}</h3><p className="mt-1 text-sm text-zinc-500">Toque ou arraste sobre a imagem para escolher o ponto mais importante.</p></div><button type="button" aria-label="Cancelar ajuste" onClick={() => setOpen(false)} className="rounded-xl border px-3 py-2 font-bold">Fechar</button></header>
      <div className="mt-5 inline-flex rounded-xl bg-zinc-100 p-1" role="group" aria-label="Dispositivo da prévia"><button type="button" aria-pressed={mode === "DESKTOP"} onClick={() => setMode("DESKTOP")} className={`inline-flex min-h-10 items-center gap-2 rounded-lg px-4 text-sm font-black ${mode === "DESKTOP" ? "bg-white text-violet-700 shadow" : "text-zinc-500"}`}><Monitor size={17}/>Desktop</button><button type="button" aria-pressed={mode === "MOBILE"} onClick={() => setMode("MOBILE")} className={`inline-flex min-h-10 items-center gap-2 rounded-lg px-4 text-sm font-black ${mode === "MOBILE" ? "bg-white text-violet-700 shadow" : "text-zinc-500"}`}><Smartphone size={17}/>Celular</button></div>
      <div onPointerDown={imageReady ? point : undefined} onPointerMove={event => { if (imageReady && event.buttons === 1) point(event); }} className={`relative mx-auto mt-5 touch-none overflow-hidden rounded-2xl bg-zinc-900 ${variant === "MILESTONE" ? mode === "MOBILE" ? "aspect-[16/9] max-w-[390px]" : "aspect-[16/7] w-full max-w-3xl" : mode === "MOBILE" ? "aspect-[16/9] min-h-[255px] max-w-[390px]" : "aspect-[3/1] w-full"}`}>{source && !imageFailed && <Image src={source} fill unoptimized alt="Prévia do enquadramento" draggable={false} onLoad={() => setImageState({ source, status: "READY" })} onError={() => setImageState({ source, status: "ERROR" })} className={`pointer-events-none select-none object-cover transition-opacity ${imageReady ? "opacity-100" : "opacity-0"}`} style={{ objectPosition: `${current.x}% ${current.y}%`, transform: `scale(${current.zoom})`, transformOrigin: `${current.x}% ${current.y}%` }}/>} {!imageReady && !imageFailed && <div className="absolute inset-0 grid place-items-center text-white"><span className="inline-flex items-center gap-2 text-sm font-bold"><LoaderCircle className="animate-spin" size={18}/>Carregando imagem...</span></div>}{imageFailed && <div className="absolute inset-0 grid place-items-center p-6 text-center text-white"><div><p className="font-bold">Não foi possível carregar esta imagem. Selecione o arquivo novamente.</p><Button type="button" className="mt-4" size="sm" onClick={() => { setOpen(false); document.getElementById("campaign-prize-images")?.click(); }}>Selecionar outra imagem</Button></div></div>}{imageReady && <span className="pointer-events-none absolute h-7 w-7 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-violet-600/70 shadow" style={{ left: `${current.x}%`, top: `${current.y}%` }}/>}</div>
      <div className="mt-5 grid gap-4 md:grid-cols-[1fr_auto]"><label className="text-sm font-bold">Zoom <span className="font-normal text-zinc-500">{Math.round(current.zoom * 100)}%</span><div className="mt-2 flex items-center gap-3"><button type="button" aria-label="Diminuir zoom" onClick={() => update({ zoom: Math.max(1, Number((current.zoom - .05).toFixed(2))) })} className="rounded-lg border p-2"><Minus size={16}/></button><input aria-label="Zoom da imagem" type="range" min="1" max="2" step="0.01" value={current.zoom} onChange={event => update({ zoom: Number(event.target.value) })} className="w-full accent-violet-700"/><button type="button" aria-label="Aumentar zoom" onClick={() => update({ zoom: Math.min(2, Number((current.zoom + .05).toFixed(2))) })} className="rounded-lg border p-2"><ZoomIn size={16}/></button></div></label><div className="flex flex-wrap items-end gap-2"><button type="button" onClick={() => update({ x: 50, y: 0 })} className="rounded-lg border px-3 py-2 text-xs font-bold">Topo</button><button type="button" onClick={() => update({ x: 50, y: 50 })} className="rounded-lg border px-3 py-2 text-xs font-bold">Centro</button><button type="button" onClick={() => update({ x: 50, y: 100 })} className="rounded-lg border px-3 py-2 text-xs font-bold">Base</button></div></div>
      <p className="mt-4 rounded-xl bg-amber-50 p-3 text-xs text-amber-900">O enquadramento pode variar levemente conforme o tamanho da tela.</p>
      <footer className="sticky bottom-0 mt-6 flex flex-wrap justify-end gap-2 border-t bg-white py-4 pb-[max(1rem,env(safe-area-inset-bottom))]"><Button type="button" variant="ghost" disabled={!imageReady} onClick={() => { setDraft(defaultHeroCrop); }}>Restaurar automático</Button><Button type="button" variant="outline" onClick={() => { setDraft(value); setOpen(false); }}>Cancelar</Button><Button type="button" disabled={!imageReady} onClick={() => { onChange(draft); setOpen(false); }}>Aplicar enquadramento</Button></footer>
    </div></div>}
  </div>;
}

function heroImageCrop(customization?: Record<string, unknown>): HeroImageCrop {
  const raw = customization?.heroImage && typeof customization.heroImage === "object" ? customization.heroImage as Record<string, unknown> : {};
  const parse = (value: unknown): HeroViewport => { const item = value && typeof value === "object" ? value as Record<string, unknown> : {}; return { x: clamp(Number(item.x), 0, 100, 50), y: clamp(Number(item.y), 0, 100, 50), zoom: clamp(Number(item.zoom), 1, 2, 1) }; };
  return { desktop: parse(raw.desktop), mobile: parse(raw.mobile) };
}
function heroImageStyle(customization: Record<string, unknown> | undefined, mode: "MOBILE" | "DESKTOP") {
  const crop = heroImageCrop(customization)[mode === "MOBILE" ? "mobile" : "desktop"];
  return { objectPosition: `${crop.x}% ${crop.y}%`, transform: `scale(${crop.zoom})`, transformOrigin: `${crop.x}% ${crop.y}%` };
}
function clamp(value: number, minimum: number, maximum: number, fallback: number) { return Number.isFinite(value) ? Math.min(maximum, Math.max(minimum, value)) : fallback; }

function CampaignLivePreview({
  mode,
  form,
  files,
  campaign,
  personalization,
}: {
  mode: "MOBILE" | "DESKTOP";
  form: CampaignDraft;
  files: File[];
  campaign: Campaign | null;
  personalization: Personalization | null;
}) {
  const localImage = files[0];
  const localUrl = useMemo(
    () => (localImage ? URL.createObjectURL(localImage) : null),
    [localImage],
  );
  useEffect(
    () => () => {
      if (localUrl) URL.revokeObjectURL(localUrl);
    },
    [localUrl],
  );
  const imageUrl =
    localUrl ||
    (campaign?.coverImageUrl ? campaignMediaUrl(campaign.coverImageUrl) : null);
  const primary = String(
    form.customization?.primaryColor ||
      personalization?.brand.primaryColor ||
      "#6D28D9",
  );
  const secondary = personalization?.brand.secondaryColor || "#2563EB";
  const button = String(
    form.customization?.buttonColor ||
      personalization?.brand.buttonColor ||
      "#2563EB",
  );
  const dark =
    String(
      form.customization?.themeMode ||
        personalization?.brand.themeMode ||
        "LIGHT",
    ) === "DARK";
  const promotions = (form.promotions || []).slice(0, 3);
  const prizes = (form.instantPrizes || []).slice(0, 5);
  return (
    <div
      className={`mx-auto mt-4 overflow-hidden rounded-2xl border border-white/10 text-zinc-950 shadow-2xl transition-all duration-300 ${mode === "MOBILE" ? "max-w-[310px]" : "max-w-full"} ${dark ? "bg-zinc-900 text-white" : "bg-zinc-100"}`}
    >
      <div className="flex items-center justify-between bg-white px-3 py-2 text-zinc-950">
        <div className="font-black">
          Sorte<span style={{ color: primary }}>X</span>
        </div>
        <div className="flex items-center gap-2">
          {personalization?.brand.primaryLogoUrl && (
            <Image
              src={personalization.brand.primaryLogoUrl}
              width={24}
              height={24}
              unoptimized
              alt="Logo do organizador"
              className="h-6 w-6 rounded object-contain"
            />
          )}
          <span className="max-w-24 truncate text-[8px] font-bold">
            {personalization?.brand.publicName ||
              campaign?.organizer.name ||
              "Organizador"}
          </span>
        </div>
      </div>
      <div
        className={`relative overflow-hidden bg-zinc-800 ${mode === "MOBILE" ? "h-40" : "h-56"}`}
      >
        {imageUrl ? (
          <Image
            src={imageUrl}
            fill
            unoptimized
            sizes={mode === "MOBILE" ? "310px" : "520px"}
            alt="Prévia do prêmio"
            className="object-cover transition-transform duration-200"
            style={heroImageStyle(form.customization, mode)}
          />
        ) : (
          <div className="grid h-full place-items-center text-xs text-white/60">
            Adicione uma imagem do prêmio
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-black/70 to-transparent p-3 text-white">
          {form.customization?.showWatermark !== false && (
            <span className="absolute right-2 top-0 text-[7px] font-black opacity-70">
              SorteX
            </span>
          )}
          <h3
            className={
              form.titleDisplayMode === "HIGHLIGHT"
                ? "text-xl font-black uppercase leading-none"
                : "text-sm font-bold"
            }
          >
            <CampaignTitleText form={form} fallback="Nome da campanha" />
          </h3>
          <p className="mt-1 text-[8px]">
            {form.drawDate
              ? new Date(`${form.drawDate}T12:00:00`).toLocaleDateString(
                  "pt-BR",
                )
              : "Data do sorteio a definir"}{" "}
            · {form.drawTime || "--:--"}
          </p>
        </div>
      </div>
      <div
        className={`grid border-b bg-white text-zinc-950 ${form.showParticipants !== false ? "grid-cols-3" : "grid-cols-2"}`}
      >
        <PreviewStat
          label="Valor da cota"
          value={moneyPreview(form.numberPrice || 0)}
          color={primary}
        />
        <PreviewStat label="Vendido" value="0%" />
        {form.showParticipants !== false && (
          <PreviewStat label="Participantes" value="0" />
        )}
      </div>
      <div className="space-y-2 p-3">
        <div className="h-1.5 overflow-hidden rounded-full bg-zinc-200">
          <div
            className="h-full w-[8%] rounded-full"
            style={{ backgroundColor: secondary }}
          />
        </div>
        <p className="text-xs font-black">
          {form.mainPrizeName || "Nome do prêmio"}
        </p>
        {campaign?.promotionalVideoUrl && (
          <p className="text-[8px]">Vídeo do prêmio configurado</p>
        )}
        {promotions.length > 0 && (
          <div>
            <p className="text-[8px] font-black uppercase">Promoções</p>
            <div className="mt-1 grid grid-cols-3 gap-1">
              {promotions.map((item, index) => (
                <div
                  key={index}
                  className="rounded-md bg-white p-1 text-[7px] text-zinc-950"
                >
                  <b>{item.numberQuantity} títulos</b>
                  <span className="block">
                    {moneyPreview(item.packagePrice)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
        {prizes.length > 0 && (
          <div>
            <p className="text-[8px] font-black uppercase">Cotas premiadas</p>
            <div className="mt-1 grid grid-cols-5 gap-1">
              {prizes.map((item, index) => (
                <span
                  key={index}
                  className="truncate rounded bg-white px-1 py-1 text-center font-mono text-[6px] text-zinc-950"
                >
                  {item.exactNumber || `Cota ${index + 1}`}
                </span>
              ))}
            </div>
          </div>
        )}
        <button
          type="button"
          className="w-full rounded-lg py-2 text-xs font-black text-white"
          style={{ backgroundColor: button }}
        >
          Comprar títulos
        </button>
        {form.customization?.showSocialLinks !== false &&
          personalization?.socialLinks.some((link) => link.isActive) && (
            <p className="text-center text-[7px] opacity-60">
              Redes sociais do organizador
            </p>
          )}
      </div>
    </div>
  );
}

function PreviewStat({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color?: string;
}) {
  return (
    <div
      className="border-r p-2 last:border-r-0"
      style={color ? { backgroundColor: `${color}20` } : undefined}
    >
      <p className="text-[6px] font-black uppercase text-zinc-500">{label}</p>
      <p className="mt-1 truncate text-[9px] font-black">{value}</p>
    </div>
  );
}
function moneyPreview(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function validateMediaSelection(files: { prizeImages: File[]; video?: File }) {
  const images = [...files.prizeImages];
  for (const image of images) {
    if (!["image/jpeg", "image/png", "image/webp"].includes(image.type))
      throw new Error(
        `O arquivo ${image.name} deve estar em JPG, PNG ou WEBP.`,
      );
    if (image.size > 20 * 1024 * 1024)
      throw new Error(`A imagem ${image.name} deve ter no máximo 20 MB.`);
  }
  if (files.video && !["video/mp4", "video/webm"].includes(files.video.type))
    throw new Error("O vídeo deve estar em MP4 ou WEBM.");
  if (files.video && files.video.size > 100 * 1024 * 1024)
    throw new Error("O vídeo deve ter no máximo 100 MB.");
}

function PrizeImageManager({
  files,
  onChange,
}: {
  files: File[];
  onChange: (files: File[]) => void;
}) {
  const [drag, setDrag] = useState<number | null>(null);
  function move(from: number, to: number) {
    const next = [...files];
    const [item] = next.splice(from, 1);
    next.splice(to, 0, item);
    onChange(next);
  }
  return (
    <div className="mt-4">
      <label className="flex cursor-pointer items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-violet-200 bg-violet-50 p-5 font-bold text-violet-700">
        <UploadCloud />
        Selecionar imagens do prêmio
        <input
          id="campaign-prize-images"
          className="sr-only"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          onChange={(event) =>
            onChange(
              [...files, ...Array.from(event.target.files || [])].slice(0, 10),
            )
          }
        />
      </label>
      {files.length > 0 && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {files.map((file, index) => (
            <div
              key={`${file.name}-${file.lastModified}`}
              draggable
              onDragStart={() => setDrag(index)}
              onDragOver={(event) => event.preventDefault()}
              onDrop={() => {
                if (drag !== null && drag !== index) move(drag, index);
                setDrag(null);
              }}
              className="rounded-2xl border bg-white p-3 shadow-sm"
            >
              <LocalImagePreview file={file} />
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-xs font-bold">
                  {index === 0 ? "Principal · " : ""}
                  {file.name}
                </span>
                <div className="flex gap-1">
                  {index > 0 && (
                    <button
                      type="button"
                      onClick={() => move(index, 0)}
                      className="rounded-lg bg-violet-50 px-2 py-1 text-[10px] font-black text-violet-700"
                    >
                      Definir principal
                    </button>
                  )}
                  <button
                    type="button"
                    aria-label={`Excluir ${file.name}`}
                    onClick={() =>
                      onChange(files.filter((_, item) => item !== index))
                    }
                    className="rounded-lg p-1 text-red-600"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="text-sm font-bold text-zinc-700">
      {label}
      <span className="mt-2 flex items-center gap-3 rounded-xl border bg-white p-2">
        <input
          type="color"
          value={value}
          onChange={(event) => onChange(event.target.value.toUpperCase())}
          className="h-9 w-12 rounded border-0"
        />
        <span className="font-mono text-xs">{value}</span>
      </span>
    </label>
  );
}
function Toggle({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-3 rounded-xl border bg-zinc-50 p-3 text-sm font-bold">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="h-5 w-5 accent-violet-700"
      />
      {label}
    </label>
  );
}

function FileBox({
  title,
  accept,
  multiple,
  current,
  onFiles,
}: {
  title: string;
  accept: string;
  multiple?: boolean;
  current: boolean;
  onFiles: (files: File[]) => void;
}) {
  return (
    <label
      className={`cursor-pointer rounded-2xl border-2 border-dashed p-4 ${current ? "border-green-300 bg-green-50" : "border-violet-200 bg-violet-50"}`}
    >
      <input
        className="sr-only"
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={(e) => onFiles(Array.from(e.target.files || []))}
      />
      <span className="flex items-center gap-2 font-bold">
        {current ? (
          <CheckCircle2 className="text-green-700" />
        ) : (
          <UploadCloud className="text-violet-700" />
        )}
        {title}
      </span>
      <p className="mt-2 text-xs text-zinc-500">
        {current ? "Arquivo salvo" : "Selecionar arquivo"}
      </p>
    </label>
  );
}

function LocalImagePreview({ file }: { file: File }) {
  const url = useMemo(() => URL.createObjectURL(file), [file]);
  useEffect(() => () => URL.revokeObjectURL(url), [url]);
  return (
    <Image
      src={url}
      alt="Prévia do arquivo"
      width={640}
      height={112}
      unoptimized
      className="mb-3 h-28 w-full rounded-xl border bg-white object-contain"
    />
  );
}
function LocalVideoPreview({
  file,
  onRemove,
}: {
  file: File;
  onRemove: () => void;
}) {
  const url = useMemo(() => URL.createObjectURL(file), [file]);
  useEffect(() => () => URL.revokeObjectURL(url), [url]);
  return (
    <div className="rounded-2xl border bg-white p-3">
      <video
        src={url}
        controls
        className="max-h-64 w-full rounded-xl bg-black"
      />
      <div className="mt-2 flex items-center justify-between gap-2">
        <span className="truncate text-xs font-bold">{file.name}</span>
        <button
          type="button"
          onClick={onRemove}
          className="rounded-lg p-2 text-red-600"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  );
}
function Summary({ title, lines }: { title: string; lines: string[] }) {
  return (
    <div className="rounded-2xl bg-zinc-50 p-5">
      <h3 className="font-black">{title}</h3>
      <ul className="mt-3 space-y-1 text-sm text-zinc-600">
        {lines.map((line) => (
          <li key={line}>{line}</li>
        ))}
      </ul>
    </div>
  );
}
function slugify(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
function optionLabel(value: string) {
  return (
    (
      {
        AUTOMOBILE: "Automóveis",
        MOTORCYCLE: "Motos",
        ELECTRONICS: "Eletrônicos",
        CASH: "Dinheiro",
        TRAVEL: "Viagens",
        OTHER: "Outros",
        AUTO: "Automático",
        WHITE: "Branco",
        BLACK: "Preto",
        BLUE: "Azul",
        GREEN: "Verde",
        RED: "Vermelho",
        PURPLE: "Roxo",
        PINK: "Rosa",
        ORANGE: "Laranja",
        YELLOW: "Amarelo",
        CUSTOM: "Personalizado",
        MANUAL: "Escolher manualmente",
        AUTOMATIC: "Gerar automaticamente",
        PRODUCT: "Produto",
        GIFT_CARD: "Vale-presente",
        PIX: "Pix",
        NO_PRIZE: "Não foi dessa vez",
        EXTRA_TICKETS: "Títulos extras",
        LOTERIA_FEDERAL: "Loteria Federal",
        MANUAL_RESULT: "Resultado manual",
        CLASSIC: "Clássico",
        MODERN: "Moderno",
        IMAGE_FOCUS: "Imagem em destaque",
        COMPACT: "Compacto",
        PREMIUM: "Premium",
        LIGHT: "Claro",
        DARK: "Escuro",
        RANDOM: "Automático",
      } as Record<string, string>
    )[value] || value
  );
}

const defaultRoulette: RouletteConfigInput = {
  enabled: false,
  name: "Roleta Instantânea",
  description: "Ganhe rodadas de acordo com a quantidade de títulos comprada.",
  rules: [{ id: "regra-100", minQuantity: 100, rounds: 1 }],
  items: [
    {
      id: "nao-foi",
      name: "Não foi dessa vez",
      type: "NO_PRIZE",
      quantity: 0,
      probability: 70,
      isActive: true,
    },
  ],
};
function rouletteFromCustomization(
  value?: Record<string, unknown>,
): RouletteConfigInput {
  const roulette = value?.roulette;
  if (!roulette || typeof roulette !== "object") return defaultRoulette;
  return {
    ...defaultRoulette,
    ...(roulette as RouletteConfigInput),
    rules: Array.isArray((roulette as RouletteConfigInput).rules)
      ? (roulette as RouletteConfigInput).rules
      : defaultRoulette.rules,
    items: Array.isArray((roulette as RouletteConfigInput).items)
      ? (roulette as RouletteConfigInput).items
      : defaultRoulette.items,
  };
}
function RouletteEditor({
  campaignId,
  value,
  onChange,
}: {
  campaignId?: string;
  value: RouletteConfigInput;
  onChange: (value: RouletteConfigInput) => void;
}) {
  const [summary, setSummary] = useState<{
    totalRounds: number;
    prizesDelivered: number;
    history: Array<{
      createdAt: string;
      result?: { itemName?: string };
      buyer?: { name?: string };
    }>;
  } | null>(null);
  useEffect(() => {
    if (!campaignId || !value.enabled) return;
    fetch(`/api/draws/roulette/organizer/campaigns/${campaignId}`, {
      credentials: "include",
      cache: "no-store",
    })
      .then((response) => (response.ok ? response.json() : null))
      .then(setSummary)
      .catch(() => setSummary(null));
  }, [campaignId, value.enabled]);
  const update = <K extends keyof RouletteConfigInput>(
    key: K,
    next: RouletteConfigInput[K],
  ) => onChange({ ...value, [key]: next });
  const move = <T,>(list: T[], index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= list.length) return list;
    const copy = [...list];
    [copy[index], copy[target]] = [copy[target], copy[index]];
    return copy;
  };
  return (
    <Card className="mt-4 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="font-black">🎯 Roleta Instantânea</h3>
          <p className="text-sm text-zinc-500">
            Libere rodadas após pagamentos aprovados. O resultado é decidido e
            registrado pelo backend.
          </p>
        </div>
        <label className="flex items-center gap-2 text-sm font-bold">
          <input
            type="checkbox"
            checked={value.enabled}
            onChange={(event) => update("enabled", event.target.checked)}
          />{" "}
          {value.enabled ? "Ativa" : "Inativa"}
        </label>
      </div>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <Field label="Nome da promoção">
          <Input
            className={inputClass}
            value={value.name}
            onChange={(event) => update("name", event.target.value)}
          />
        </Field>
        <Field label="Imagem (URL opcional)">
          <Input
            className={inputClass}
            value={value.imageUrl || ""}
            onChange={(event) => update("imageUrl", event.target.value)}
          />
        </Field>
        <Field label="Início">
          <Input
            className={inputClass}
            type="datetime-local"
            value={value.startsAt || ""}
            onChange={(event) => update("startsAt", event.target.value)}
          />
        </Field>
        <Field label="Término">
          <Input
            className={inputClass}
            type="datetime-local"
            value={value.endsAt || ""}
            onChange={(event) => update("endsAt", event.target.value)}
          />
        </Field>
      </div>
      <Field label="Descrição">
        <Textarea
          className="mt-2"
          value={value.description || ""}
          onChange={(event) => update("description", event.target.value)}
        />
      </Field>
      <div className="mt-5 flex items-center justify-between">
        <h4 className="font-black">Regras das rodadas</h4>
        <Button
          size="sm"
          onClick={() =>
            update("rules", [
              ...value.rules,
              { id: crypto.randomUUID(), minQuantity: 100, rounds: 1 },
            ])
          }
        >
          <Plus size={14} /> Adicionar
        </Button>
      </div>
      <div className="mt-3 space-y-2">
        {value.rules.map((rule, index) => (
          <div
            key={rule.id}
            className="grid gap-2 rounded-xl border p-3 sm:grid-cols-[1fr_1fr_auto]"
          >
            <Field label="Quantidade comprada">
              <NumberInput
                value={rule.minQuantity}
                onChange={(next) =>
                  update(
                    "rules",
                    value.rules.map((item) =>
                      item.id === rule.id
                        ? { ...item, minQuantity: next ?? 0 }
                        : item,
                    ),
                  )
                }
              />
            </Field>
            <Field label="Rodadas">
              <NumberInput
                value={rule.rounds}
                onChange={(next) =>
                  update(
                    "rules",
                    value.rules.map((item) =>
                      item.id === rule.id
                        ? { ...item, rounds: next ?? 0 }
                        : item,
                    ),
                  )
                }
              />
            </Field>
            <div className="flex items-end gap-1">
              <Button
                size="sm"
                variant="ghost"
                onClick={() => update("rules", move(value.rules, index, -1))}
              >
                ↑
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => update("rules", move(value.rules, index, 1))}
              >
                ↓
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  update(
                    "rules",
                    value.rules.filter((item) => item.id !== rule.id),
                  )
                }
              >
                <Trash2 size={14} />
              </Button>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-5 flex items-center justify-between">
        <h4 className="font-black">Itens da roleta</h4>
        <Button
          size="sm"
          onClick={() =>
            update("items", [
              ...value.items,
              {
                id: crypto.randomUUID(),
                name: "Novo prêmio",
                type: "OTHER",
                quantity: 1,
                probability: 10,
                isActive: true,
              },
            ])
          }
        >
          <Plus size={14} /> Adicionar
        </Button>
      </div>
      <div className="mt-3 space-y-2">
        {value.items.map((item, index) => (
          <div key={item.id} className="rounded-xl border p-3">
            <div className="grid gap-2 md:grid-cols-5">
              <Field label="Nome">
                <Input
                  className={inputClass}
                  value={item.name}
                  onChange={(event) =>
                    update(
                      "items",
                      value.items.map((entry) =>
                        entry.id === item.id
                          ? { ...entry, name: event.target.value }
                          : entry,
                      ),
                    )
                  }
                />
              </Field>
              <Field label="Tipo">
                <Select
                  value={item.type}
                  onChange={(next) =>
                    update(
                      "items",
                      value.items.map((entry) =>
                        entry.id === item.id ? { ...entry, type: next } : entry,
                      ),
                    )
                  }
                  options={[
                    "NO_PRIZE",
                    "PIX",
                    "PRODUCT",
                    "EXTRA_TICKETS",
                    "OTHER",
                  ]}
                />
              </Field>
              <Field label="Quantidade">
                <NumberInput
                  value={item.quantity}
                  onChange={(next) =>
                    update(
                      "items",
                      value.items.map((entry) =>
                        entry.id === item.id
                          ? { ...entry, quantity: next ?? 0 }
                          : entry,
                      ),
                    )
                  }
                />
              </Field>
              <Field label="Probabilidade">
                <NumberInput
                  value={item.probability}
                  onChange={(next) =>
                    update(
                      "items",
                      value.items.map((entry) =>
                        entry.id === item.id
                          ? { ...entry, probability: next ?? 0 }
                          : entry,
                      ),
                    )
                  }
                />
              </Field>
              <Field label="Imagem (URL)">
                <Input
                  className={inputClass}
                  value={item.imageUrl || ""}
                  onChange={(event) =>
                    update(
                      "items",
                      value.items.map((entry) =>
                        entry.id === item.id
                          ? { ...entry, imageUrl: event.target.value }
                          : entry,
                      ),
                    )
                  }
                />
              </Field>
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <label className="text-sm">
                <input
                  type="checkbox"
                  checked={item.isActive}
                  onChange={(event) =>
                    update(
                      "items",
                      value.items.map((entry) =>
                        entry.id === item.id
                          ? { ...entry, isActive: event.target.checked }
                          : entry,
                      ),
                    )
                  }
                />{" "}
                Ativo
              </label>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => update("items", move(value.items, index, -1))}
              >
                ↑
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => update("items", move(value.items, index, 1))}
              >
                ↓
              </Button>
              <Button
                size="sm"
                variant="ghost"
                onClick={() =>
                  update(
                    "items",
                    value.items.filter((entry) => entry.id !== item.id),
                  )
                }
              >
                <Trash2 size={14} /> Excluir
              </Button>
            </div>
          </div>
        ))}
      </div>
      {summary && (
        <div className="mt-5 rounded-2xl bg-zinc-50 p-4">
          <h4 className="font-black">Histórico da roleta</h4>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <PreviewStat
              label="Rodadas utilizadas"
              value={String(summary.totalRounds)}
            />
            <PreviewStat
              label="Prêmios entregues"
              value={String(summary.prizesDelivered)}
            />
          </div>
          <div className="mt-3 space-y-1 text-xs">
            {summary.history.slice(0, 8).map((entry, index) => (
              <div
                key={`${entry.createdAt}-${index}`}
                className="flex justify-between gap-3 rounded-lg bg-white p-2"
              >
                <span>
                  {entry.buyer?.name || "Comprador"} ·{" "}
                  {entry.result?.itemName || "Resultado registrado"}
                </span>
                <time>{new Date(entry.createdAt).toLocaleString("pt-BR")}</time>
              </div>
            ))}
            {summary.history.length === 0 && (
              <p className="text-zinc-500">
                Nenhuma rodada utilizada até o momento.
              </p>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}
function campaignMediaUrl(path: string) {
  return path.replace(
    /^\/public\/campaigns\/media\/([^/]+)\//,
    "/api/campaigns/$1/media/",
  );
}
function clean(form: CampaignDraft): CampaignDraft {
  return Object.fromEntries(
    Object.entries(form).filter(
      ([, value]) => value !== "" && value !== undefined,
    ),
  ) as CampaignDraft;
}
function isLegacyPopularPromotion(promotion: CampaignPromotionInput) {
  return (
    promotion.isPopular === true ||
    promotion.name.trim().toLocaleLowerCase("pt-BR") === "mais popular"
  );
}

function MilestoneManager({
  campaign,
  busy,
  onEvaluate,
  onDraw,
}: {
  campaign: Campaign;
  busy: string | null;
  onEvaluate: () => void;
  onDraw: (milestoneId: string) => void;
}) {
  const labels: Record<CampaignMilestone["status"], string> = {
    WAITING: "Aguardando",
    RELEASED: "Liberado",
    DRAWN: "Sorteado",
    COMPLETED: "Concluído",
  };
  return (
    <section className="mt-8 rounded-2xl border bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-xl font-black">Gerenciador de metas</h3>
          <p className="mt-1 text-sm text-zinc-500">
            Metas alcançadas ficam bloqueadas e preservam a fotografia dos
            títulos elegíveis.
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          disabled={busy !== null}
          onClick={onEvaluate}
        >
          {busy === "evaluate" ? (
            <LoaderCircle size={16} className="animate-spin" />
          ) : (
            <RefreshCw size={16} />
          )}
          Atualizar metas
        </Button>
      </div>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[680px] text-left text-sm">
          <thead>
            <tr className="border-b text-xs uppercase text-zinc-500">
              <th className="p-3">Meta</th>
              <th>Percentual</th>
              <th>Status</th>
              <th>Elegíveis</th>
              <th>Ação</th>
            </tr>
          </thead>
          <tbody>
            {campaign.milestonePrizes.map((milestone) => (
              <tr key={milestone.id} className="border-b last:border-0">
                <td className="p-3 font-bold">{milestone.name}</td>
                <td>{milestone.percentage}%</td>
                <td>
                  <span className="rounded-full bg-violet-50 px-3 py-1 text-xs font-bold text-violet-800">
                    {labels[milestone.status]}
                  </span>
                </td>
                <td>{milestone.eligibleTicketCount ?? "—"}</td>
                <td>
                  {milestone.status === "RELEASED" ? (
                    <Button
                      size="sm"
                      disabled={busy !== null}
                      onClick={() => onDraw(milestone.id)}
                    >
                      {busy === milestone.id && (
                        <LoaderCircle size={15} className="animate-spin" />
                      )}
                      Executar sorteio
                    </Button>
                  ) : milestone.status === "WAITING" ? (
                    <span className="text-xs text-zinc-500">
                      Aguardando percentual
                    </span>
                  ) : (
                    <span className="text-xs font-semibold text-emerald-700">
                      Resultado preservado
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function MilestoneEditor({
  campaignId,
  milestones,
  winnersRemainEligible,
  onChange,
  onEligibilityChange,
}: {
  campaignId?: string;
  milestones: CampaignMilestoneInput[];
  winnersRemainEligible: boolean;
  onChange: (milestones: CampaignMilestoneInput[]) => void;
  onEligibilityChange: (value: boolean) => void;
}) {
  const update = (index: number, patch: Partial<CampaignMilestoneInput>) =>
    onChange(
      milestones.map((milestone, itemIndex) =>
        itemIndex === index ? { ...milestone, ...patch } : milestone,
      ),
    );

  return (
    <section className="mt-8 rounded-2xl border border-violet-200 bg-violet-50/50 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="text-xl font-black text-violet-950">
            Prêmios por Meta
          </h3>
          <p className="mt-1 max-w-2xl text-sm text-zinc-600">
            Configure prêmios intermediários entre 5% e 100% das vendas. Ao
            atingir a meta, a SorteX congela os títulos pagos e confirmados
            elegíveis para auditoria.
          </p>
        </div>
        <Button
          size="sm"
          variant="outline"
          onClick={() =>
            onChange([
              ...milestones,
              {
                name: "",
                percentage:
                  Array.from({ length: 20 }, (_, index) => (index + 1) * 5).find(
                    (percentage) =>
                      !milestones.some(
                        (milestone) => milestone.percentage === percentage,
                      ),
                  ) || 100,
              },
            ])
          }
          disabled={milestones.length >= 20}
        >
          <Plus size={16} /> Adicionar meta
        </Button>
      </div>

      <div className="mt-5 space-y-4">
        {milestones.length === 0 && (
          <div className="rounded-xl border border-dashed border-violet-200 bg-white p-5 text-sm text-zinc-500">
            Nenhum prêmio por meta configurado.
          </div>
        )}
        {milestones.map((milestone, index) => (
          <Card key={`${milestone.percentage}-${index}`} className="p-4">
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
              <Field label="Nome do prêmio">
                <Input
                  className={inputClass}
                  value={milestone.name}
                  onChange={(event) =>
                    update(index, { name: event.target.value })
                  }
                  placeholder="Ex.: Moto"
                />
              </Field>
              <Field label="Percentual da meta">
                <Select
                  value={String(milestone.percentage)}
                  onChange={(value) =>
                    update(index, { percentage: Number(value) })
                  }
                  options={Array.from(
                    { length: 20 },
                    (_, itemIndex) => String((itemIndex + 1) * 5),
                  )}
                />
              </Field>
              <Field label="Valor estimado">
                <NumberInput
                  value={milestone.estimatedValue}
                  onChange={(value) =>
                    update(index, { estimatedValue: value })
                  }
                />
              </Field>
              <Field label="Data opcional">
                <Input
                  className={inputClass}
                  type="datetime-local"
                  value={milestone.scheduledAt || ""}
                  onChange={(event) =>
                    update(index, { scheduledAt: event.target.value })
                  }
                />
              </Field>
              <Field label="Descrição">
                <Input
                  className={inputClass}
                  value={milestone.description || ""}
                  onChange={(event) =>
                    update(index, { description: event.target.value })
                  }
                />
              </Field>
              <MilestonePhotoField
                campaignId={campaignId}
                imageUrl={milestone.imageUrl}
                imageCrop={milestone.imageCrop}
                prizeName={milestone.name}
                onChange={(imageUrl) => update(index, { imageUrl })}
                onCropChange={(imageCrop) => update(index, { imageCrop })}
              />
              <Field label="Vídeo opcional">
                <Input
                  className={inputClass}
                  type="url"
                  value={milestone.videoUrl || ""}
                  onChange={(event) =>
                    update(index, { videoUrl: event.target.value })
                  }
                  placeholder="https://"
                />
              </Field>
              <Field label="Observações internas">
                <Input
                  className={inputClass}
                  value={milestone.notes || ""}
                  onChange={(event) =>
                    update(index, { notes: event.target.value })
                  }
                />
              </Field>
            </div>
            <Button
              className="mt-3"
              size="sm"
              variant="ghost"
              onClick={() =>
                onChange(
                  milestones.filter((_, itemIndex) => itemIndex !== index),
                )
              }
            >
              <Trash2 size={15} /> Remover meta
            </Button>
          </Card>
        ))}
      </div>

      <fieldset className="mt-5 rounded-xl bg-white p-4">
        <legend className="px-1 text-sm font-black text-zinc-900">
          Após um título ganhar um prêmio intermediário
        </legend>
        <label className="mt-3 flex cursor-pointer gap-3 text-sm text-zinc-700">
          <input
            type="radio"
            name="milestone-eligibility"
            checked={winnersRemainEligible}
            onChange={() => onEligibilityChange(true)}
          />
          Continua concorrendo aos próximos prêmios.
        </label>
        <label className="mt-3 flex cursor-pointer gap-3 text-sm text-zinc-700">
          <input
            type="radio"
            name="milestone-eligibility"
            checked={!winnersRemainEligible}
            onChange={() => onEligibilityChange(false)}
          />
          Sai automaticamente dos próximos sorteios.
        </label>
        <p className="mt-3 text-xs text-zinc-500">
          Esta regra será apresentada ao comprador antes da compra.
        </p>
      </fieldset>
    </section>
  );
}
function MilestonePhotoField({
  campaignId,
  imageUrl,
  imageCrop,
  prizeName,
  onChange,
  onCropChange,
}: {
  campaignId?: string;
  imageUrl?: string;
  imageCrop?: HeroImageCrop;
  prizeName: string;
  onChange: (imageUrl: string | undefined) => void;
  onCropChange: (imageCrop: HeroImageCrop) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [failedUrl, setFailedUrl] = useState("");
  const previewUrl = milestoneEditorImageUrl(imageUrl, campaignId);
  const imageFailed = Boolean(previewUrl) && failedUrl === previewUrl;
  async function upload(file?: File) {
    if (!file) return;
    setError("");
    if (!campaignId) {
      setError("Salve os dados básicos da campanha antes de adicionar a foto.");
      return;
    }
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setError("Formato não suportado. Envie uma imagem JPEG, PNG ou WebP.");
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setError("A foto deve ter no máximo 20 MB.");
      return;
    }
    setBusy(true);
    try {
      const url = await uploadCampaignMilestoneImage(campaignId, file);
      onChange(url);
      setFailedUrl("");
    } catch (cause) {
      setError(
        cause instanceof Error
          ? cause.message
          : "Não foi possível enviar a foto do prêmio.",
      );
    } finally {
      setBusy(false);
    }
  }
  return (
    <div className="md:col-span-2">
      <span className="text-sm font-bold text-zinc-700">Foto do prêmio</span>
      <div className="mt-2 flex min-h-32 flex-col gap-3 rounded-2xl border border-dashed bg-zinc-50 p-3 sm:flex-row sm:items-center">
        <div className="relative grid h-28 w-full shrink-0 place-items-center overflow-hidden rounded-xl bg-violet-50 sm:w-40">
          {previewUrl && !imageFailed ? (
            <Image
              src={previewUrl}
              alt={`Foto do prêmio ${prizeName || "por meta"}`}
              fill
              unoptimized
              sizes="160px"
              className="object-cover"
              onError={() => setFailedUrl(previewUrl)}
            />
          ) : (
            <UploadCloud
              size={34}
              className="text-violet-300"
              aria-label="Prêmio sem foto"
            />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs leading-5 text-zinc-500">
            JPEG, PNG ou WebP. Tamanho máximo de 20 MB.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <label className={`inline-flex min-h-10 cursor-pointer items-center rounded-xl bg-violet-700 px-4 text-xs font-black text-white ${busy ? "pointer-events-none opacity-60" : ""}`}>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp"
                className="sr-only"
                disabled={busy}
                onChange={(event) => {
                  void upload(event.target.files?.[0]);
                  event.target.value = "";
                }}
              />
              {busy
                ? "Enviando..."
                : imageUrl
                  ? "Trocar foto"
                  : "Adicionar foto"}
            </label>
            {imageUrl && (
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  onChange(undefined);
                  onCropChange(defaultHeroCrop);
                  setError("");
                }}
                className="min-h-10 rounded-xl border px-4 text-xs font-black text-red-700 hover:bg-red-50 disabled:opacity-50"
              >
                Remover foto
              </button>
            )}
          </div>
          {imageFailed && (
            <p className="mt-2 text-xs font-semibold text-amber-700">
              Não foi possível carregar a foto salva. Você pode substituí-la.
            </p>
          )}
          {error && (
            <p role="alert" className="mt-2 text-xs font-semibold text-red-700">
              {error}
            </p>
          )}
        </div>
      </div>
      {imageUrl && !imageFailed && (
        <HeroImageCropEditor
          savedUrl={previewUrl}
          value={imageUrl ? imageCrop || defaultHeroCrop : defaultHeroCrop}
          onChange={onCropChange}
          variant="MILESTONE"
        />
      )}
    </div>
  );
}
function milestoneEditorImageUrl(imageUrl?: string, campaignId?: string) {
  if (!imageUrl) return "";
  const match = imageUrl.match(
    /^\/public\/campaigns\/media\/[^/]+\/milestone\/([^/?#]+)$/,
  );
  return match && campaignId
    ? `/api/campaigns/${encodeURIComponent(campaignId)}/media/milestone/${encodeURIComponent(match[1])}`
    : imageUrl;
}
function toApiDateTime(value?: string) {
  if (!value) return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toISOString();
}
function toOptionalApiDateTime(value: string | null | undefined, message: string) {
  const normalized = value?.trim();
  if (!normalized) return undefined;
  const date = new Date(normalized);
  if (Number.isNaN(date.getTime())) throw new Error(message);
  return date.toISOString();
}
function toLocalDateTimeInput(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return local.toISOString().slice(0, 16);
}
function fromCampaign(campaign: Campaign): CampaignDraft {
  return {
    showParticipants: campaign.showParticipants !== false,
    titleDisplayMode: campaign.titleDisplayMode || "SIMPLE",
    titleColorMode: campaign.titleColorMode || "AUTO",
    customTitleColor: campaign.customTitleColor || "#7C00FF",
    titleCompositionMode: campaign.titleCompositionMode || "SINGLE",
    titleSegments: campaign.titleSegments || [],
    rewardSectionsOrder: rewardSectionsOrder(campaign.rewardSectionsOrder),
    accentColorMode: campaign.accentColorMode || "BLUE",
    customAccentColor: campaign.customAccentColor || "#2563EB",
    popularQuickQuantity:
      campaign.popularQuickQuantity ||
      (campaign.promotions.find(isLegacyPopularPromotion)
        ?.numberQuantity as CampaignDraft["popularQuickQuantity"]) ||
      1000,
    title: campaign.title,
    slug: campaign.slug,
    category: campaign.category,
    shortDescription: campaign.shortDescription || "",
    description: campaign.description || "",
    regulation: campaign.regulation || "",
    mainPrizeName: campaign.mainPrizeName || "",
    mainPrizeDescription: campaign.mainPrizeDescription || "",
    mainPrizeQuantity: campaign.mainPrizeQuantity || 1,
    cashAlternative: campaign.cashAlternative || 0,
    estimatedPrizeValue: campaign.estimatedPrizeValue || 0,
    totalNumbers: campaign.totalNumbers,
    numberPrice: campaign.numberPrice,
    minimumPurchase: campaign.minimumPurchase,
    maximumPurchasePerBuyer: campaign.maximumPurchasePerBuyer,
    numberSelectionMode: campaign.numberSelectionMode,
    drawDate: campaign.drawDate?.slice(0, 10) || "",
    drawTime: campaign.drawTime || "20:00",
    drawBasis: campaign.drawBasis,
    drawRuleTemplateId: campaign.drawRuleTemplateId || undefined,
    customDrawRule: campaign.customDrawRule || initial.customDrawRule,
    customization: campaign.customization?.configuration || {
      useOrganizerDefaults: true,
    },
    salesStartAt: toLocalDateTimeInput(campaign.salesStartAt),
    salesEndAt: toLocalDateTimeInput(campaign.salesEndAt),
    promotions: campaign.promotions
      .filter((promotion) => !isLegacyPopularPromotion(promotion))
      .map((promotion) => ({
        name: promotion.name,
        numberQuantity: promotion.numberQuantity,
        packagePrice: promotion.packagePrice,
        isPopular: promotion.isPopular,
        isActive: promotion.isActive,
        sortOrder: promotion.sortOrder,
      })),
    instantPrizes: campaign.instantPrizes.map((prize) => ({
      exactNumber: prize.exactNumber,
      generationRule: prize.generationRule,
      value: prize.value,
      description: prize.description,
      type: prize.type,
      quantity: prize.quantity,
    })),
    milestones: campaign.milestonePrizes
      .filter((milestone) => milestone.status === "WAITING")
      .map((milestone) => ({
        name: milestone.name,
        description: milestone.description || undefined,
        imageUrl: milestone.imageUrl || undefined,
        videoUrl: milestone.videoUrl || undefined,
        estimatedValue: milestone.estimatedValue,
        percentage: milestone.percentage,
        scheduledAt: toLocalDateTimeInput(milestone.scheduledAt),
      })),
    milestoneWinnersRemainEligible:
      campaign.milestoneWinnersRemainEligible !== false,
  };
}
