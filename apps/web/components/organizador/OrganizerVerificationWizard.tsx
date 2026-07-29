"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Building2,
  CheckCircle2,
  Crown,
  FileCheck2,
  FileText,
  ImageUp,
  LoaderCircle,
  MapPin,
  ShieldCheck,
  UploadCloud,
  UserRound,
} from "lucide-react";
import ProgressSteps from "./ProgressSteps";
import VerificationStatusBadge from "./VerificationStatusBadge";
import AddressFields from "./AddressFields";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import {
  getOrganizerProfile,
  submitOrganizerProfile,
  updateOrganizerProfile,
  uploadOrganizerFile,
} from "@/lib/organizers/client";
import type {
  OrganizerDocumentType,
  OrganizerProfile,
} from "@/lib/organizers/types";
import { PlanSelector } from "@/components/organizer-platform/PlanSelector";
import type { CurrentPlan } from "@/lib/organizer-platform/client";

const steps = [
  "Dados pessoais",
  "Organização",
  "Endereço",
  "Documentos",
  "Escolha do plano",
  "Revisão",
  "Confirmação",
];
const fieldClass = "h-12 rounded-xl bg-white px-4";

const emptyForm = {
  fullName: "",
  cpf: "",
  phone: "",
  birthDate: "",
  organizationName: "",
  cnpj: "",
  instagram: "",
  postalCode: "",
  address: "",
  addressNumber: "",
  addressComplement: "",
  neighborhood: "",
  municipalityCode: "",
  addressReference: "",
  city: "",
  state: "",
};

export default function OrganizerVerificationWizard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [profile, setProfile] = useState<OrganizerProfile | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [currentPlan, setCurrentPlan] = useState<CurrentPlan | null>(null);
  const handleCurrentPlanChange = useCallback((selected: CurrentPlan) => {
    setCurrentPlan(selected);
    if (selected.profile.planSelectedAt) setError("");
  }, []);

  useEffect(() => {
    getOrganizerProfile()
      .then((data) => {
        setProfile(data);
        setForm({
          fullName: data.fullName || "",
          cpf: data.cpf || "",
          phone: data.phone || "",
          birthDate: data.birthDate?.slice(0, 10) || "",
          organizationName: data.organizationName || "",
          cnpj: data.cnpj || "",
          instagram: data.instagram || "",
          postalCode: data.postalCode || "",
          address: data.address || "",
          addressNumber: data.addressNumber || "",
          addressComplement: data.addressComplement || "",
          neighborhood: data.neighborhood || "",
          municipalityCode: data.municipalityCode || "",
          addressReference: data.addressReference || "",
          city: data.city || "",
          state: data.state || "",
        });
        if (searchParams.get("edit") === "1") setStep(1);
        else if (["PENDING", "UNDER_REVIEW", "CORRECTION_REQUESTED", "DOCUMENT_REQUESTED", "VERIFIED", "REJECTED", "SUSPENDED", "BLOCKED", "CLOSED"].includes(data.verificationStatus)) setStep(7);
      })
      .catch((cause) => setError(cause instanceof Error ? cause.message : "Não foi possível carregar seu cadastro."))
      .finally(() => setLoading(false));
  }, [searchParams]);

  const documents = useMemo(
    () => { const map = new Map<OrganizerDocumentType, OrganizerProfile['documents'][number]>(); for (const document of profile?.documents || []) if (!map.has(document.type)) map.set(document.type, document); return map; },
    [profile],
  );

  function change(event: React.ChangeEvent<HTMLInputElement>) {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
  }

  async function saveAndContinue() {
    setSaving(true);
    setError("");
    try {
      const updated = await updateOrganizerProfile(
        step === 1
          ? {
              fullName: form.fullName,
              cpf: form.cpf,
              phone: form.phone,
              birthDate: form.birthDate
                ? new Date(`${form.birthDate}T00:00:00.000Z`).toISOString()
                : undefined,
            }
          : step === 2
            ? {
              organizationName: form.organizationName,
              cnpj: form.cnpj || undefined,
              instagram: form.instagram || undefined,
            }
            : {
              postalCode: form.postalCode,
              address: form.address,
              addressNumber: form.addressNumber,
              addressComplement: form.addressComplement || undefined,
              neighborhood: form.neighborhood || undefined,
              municipalityCode: form.municipalityCode || undefined,
              addressReference: form.addressReference || undefined,
              city: form.city,
              state: form.state,
            },
      );
      setProfile(updated);
      setStep((current) => current + 1);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  }

  async function upload(file: File, type: "LOGO" | OrganizerDocumentType) {
    setSaving(true);
    setError("");
    try {
      setProfile(await uploadOrganizerFile(file, type));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível enviar.");
    } finally {
      setSaving(false);
    }
  }

  async function submit() {
    setSaving(true);
    setError("");
    try {
      setProfile(await submitOrganizerProfile());
      setStep(7);
      window.setTimeout(() => {
        router.refresh();
        router.replace("/dashboard");
      }, 1200);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível enviar para análise.");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <LoadingState />;
  if (!profile) return <ErrorState message={error} />;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-bold uppercase tracking-wider text-violet-600">Verificação SorteX</p>
          <h1 className="mt-2 text-3xl font-black text-zinc-950">Cadastro do organizador</h1>
          <p className="mt-2 text-zinc-500">Complete os dados para conquistar o selo de organizador verificado.</p>
        </div>
        <VerificationStatusBadge status={profile.verificationStatus} />
      </div>

      {(profile.publicReviewMessage || profile.rejectionReason) && (
        <div className={`rounded-2xl border p-4 text-sm ${profile.verificationStatus === "VERIFIED" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-red-200 bg-red-50 text-red-800"}`}>
          <strong>Atualização da Equipe SorteX:</strong> {profile.publicReviewMessage || profile.rejectionReason}
        </div>
      )}

      <ProgressSteps etapa={step} etapas={steps} />
      {error && <p role="alert" className="rounded-2xl bg-red-50 p-4 text-sm text-red-700">{error}</p>}

      {step === 1 && (
        <StepCard icon={<UserRound />} title="Dados pessoais" description="Dados do responsável legal pela organização.">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Nome completo"><Input className={fieldClass} name="fullName" value={form.fullName} onChange={change} /></Field>
            <Field label="CPF"><Input className={fieldClass} name="cpf" value={form.cpf} onChange={change} inputMode="numeric" /></Field>
            <Field label="Celular / WhatsApp"><Input className={fieldClass} name="phone" value={form.phone} onChange={change} inputMode="tel" /></Field>
            <Field label="Data de nascimento"><Input className={fieldClass} name="birthDate" value={form.birthDate} onChange={change} type="date" /></Field>
          </div>
          <Actions saving={saving} onNext={saveAndContinue} />
        </StepCard>
      )}

      {step === 2 && (
        <StepCard icon={<Building2 />} title="Dados da organização" description="Identidade comercial do organizador.">
          <div className="grid gap-4 md:grid-cols-2">
            <Field label="Nome da organização ou fantasia"><Input className={fieldClass} name="organizationName" value={form.organizationName} onChange={change} /></Field>
            <Field label="CNPJ (opcional)"><Input className={fieldClass} name="cnpj" value={form.cnpj} onChange={change} /></Field>
            <Field label="Instagram (opcional)"><Input className={fieldClass} name="instagram" value={form.instagram} onChange={change} placeholder="@suaorganizacao" /></Field>
          </div>
          <Actions saving={saving} onBack={() => setStep(1)} onNext={saveAndContinue} />
        </StepCard>
      )}

      {step === 3 && (
        <StepCard icon={<MapPin />} title="Endereço" description="Endereço comercial do organizador.">
          <div className="grid gap-4 md:grid-cols-2">
            <AddressFields value={{ postalCode: form.postalCode, state: form.state, city: form.city, neighborhood: form.neighborhood, address: form.address, addressNumber: form.addressNumber, addressComplement: form.addressComplement, addressReference: form.addressReference, municipalityCode: form.municipalityCode }} onChange={(address) => setForm((current) => ({ ...current, ...address }))} />
          </div>
          <Actions saving={saving} onBack={() => setStep(2)} onNext={saveAndContinue} />
        </StepCard>
      )}

      {step === 4 && (
        <StepCard icon={<FileCheck2 />} title="Documentos" description="Arquivos JPG, PNG, WEBP ou PDF de até 10 MB.">
          <div className="grid gap-4 md:grid-cols-2">
            <UploadField icon={<ImageUp />} title="Logo do organizador" detail="Usada no perfil e nos materiais da marca." accepted={Boolean(profile.logoUrl)} accept="image/jpeg,image/png,image/webp" onFile={(file) => upload(file, "LOGO")} />
            <UploadField icon={<FileText />} title="RG ou CNH" detail={documents.get("IDENTITY")?.originalName} accepted={documents.has("IDENTITY")} onFile={(file) => upload(file, "IDENTITY")} />
            <UploadField icon={<MapPin />} title="Comprovante de endereço" detail={documents.get("ADDRESS_PROOF")?.originalName} accepted={documents.has("ADDRESS_PROOF")} onFile={(file) => upload(file, "ADDRESS_PROOF")} />
            {form.cnpj && <UploadField icon={<Building2 />} title="Documento do CNPJ" detail={documents.get("CNPJ_DOCUMENT")?.originalName} accepted={documents.has("CNPJ_DOCUMENT")} onFile={(file) => upload(file, "CNPJ_DOCUMENT")} />}
          </div>
          <Actions saving={saving} onBack={() => setStep(3)} onNext={() => setStep(5)} />
        </StepCard>
      )}

      {step === 5 && (
        <StepCard icon={<Crown />} title="Escolha seu plano" description="Compare as opções e selecione o plano que será ativado conforme as regras atuais da SorteX.">
          <PlanSelector
            onboarding
            embedded
            onCurrentChange={handleCurrentPlanChange}
          />
          <Actions
            saving={saving}
            onBack={() => setStep(4)}
            onNext={() => {
              if (!currentPlan?.profile.planSelectedAt) {
                setError("Escolha um plano para continuar.");
                return;
              }
              setError("");
              setStep(6);
            }}
            nextLabel="Revisar cadastro"
          />
        </StepCard>
      )}

      {step === 6 && (
        <StepCard icon={<ShieldCheck />} title="Revisão" description="Confira os dados antes de enviar para a equipe SorteX.">
          <div className="grid gap-4 md:grid-cols-2">
            <ReviewGroup title="Responsável" items={[form.fullName, form.cpf, form.phone, form.birthDate]} />
            <ReviewGroup title="Organização" items={[form.organizationName, form.cnpj || "Sem CNPJ", form.instagram || "Sem Instagram"]} />
            <ReviewGroup title="Endereço" items={[`${form.address}, ${form.addressNumber}`, form.neighborhood || "Bairro não informado", form.addressComplement || "Sem complemento", `${form.city} - ${form.state}`, form.postalCode]} />
            <ReviewGroup title="Documentos" items={[profile.logoUrl ? "Logo enviada" : "Logo pendente", documents.has("IDENTITY") ? "Identificação enviada" : "Identificação pendente", documents.has("ADDRESS_PROOF") ? "Endereço enviado" : "Comprovante pendente", !form.cnpj || documents.has("CNPJ_DOCUMENT") ? "CNPJ conferido" : "Documento do CNPJ pendente"]} />
            <ReviewGroup title="Plano" items={[currentPlan?.plan?.name || "Plano não selecionado", currentPlan?.subscription ? "Aguardando ativação conforme o fluxo comercial" : "Seleção pendente"]} />
          </div>
          <Actions saving={saving} onBack={() => setStep(5)} onNext={submit} nextLabel="Enviar para análise" />
        </StepCard>
      )}

      {step === 7 && <Confirmation profile={profile} onEdit={() => setStep(1)} onDashboard={() => { router.refresh(); router.replace("/dashboard"); }} />}
    </div>
  );
}

function StepCard({ icon, title, description, children }: { icon: React.ReactNode; title: string; description: string; children: React.ReactNode }) {
  return <Card className="p-6 md:p-8"><div className="flex items-start gap-4"><div className="rounded-2xl bg-violet-100 p-3 text-violet-700">{icon}</div><div><h2 className="text-2xl font-black">{title}</h2><p className="mt-1 text-sm text-zinc-500">{description}</p></div></div><div className="mt-7">{children}</div></Card>;
}

function Field({ label, className, children }: { label: string; className?: string; children: React.ReactNode }) {
  return <label className={`block text-sm font-semibold text-zinc-700 ${className || ""}`}>{label}<div className="mt-2">{children}</div></label>;
}

function Actions({ saving, onBack, onNext, nextLabel = "Salvar e continuar" }: { saving: boolean; onBack?: () => void; onNext: () => void; nextLabel?: string }) {
  return <div className="mt-8 flex justify-end gap-3">{onBack && <Button variant="outline" size="lg" onClick={onBack}>Voltar</Button>}<Button size="lg" onClick={onNext} disabled={saving}>{saving && <LoaderCircle className="animate-spin" size={18} />}{nextLabel}</Button></div>;
}

function UploadField({ icon, title, detail, accepted, accept = "image/jpeg,image/png,image/webp,application/pdf", onFile }: { icon: React.ReactNode; title: string; detail?: string; accepted: boolean; accept?: string; onFile: (file: File) => void }) {
  return <label className={`cursor-pointer rounded-2xl border-2 border-dashed p-5 transition ${accepted ? "border-green-300 bg-green-50" : "border-violet-200 bg-violet-50 hover:border-violet-400"}`}><input className="sr-only" type="file" accept={accept} onChange={(event) => { const file = event.target.files?.[0]; if (file) onFile(file); event.target.value = ""; }} /><div className="flex items-start gap-3"><span className={accepted ? "text-green-700" : "text-violet-700"}>{accepted ? <CheckCircle2 /> : icon}</span><div><p className="font-bold">{title}</p><p className="mt-1 text-xs text-zinc-500">{detail || "Clique para selecionar o arquivo"}</p></div></div></label>;
}

function ReviewGroup({ title, items }: { title: string; items: string[] }) {
  return <div className="rounded-2xl bg-zinc-50 p-5"><h3 className="font-black text-zinc-900">{title}</h3><ul className="mt-3 space-y-1 text-sm text-zinc-600">{items.map((item) => <li key={item}>{item || "Não informado"}</li>)}</ul></div>;
}

function Confirmation({ profile, onEdit, onDashboard }: { profile: OrganizerProfile; onEdit: () => void; onDashboard: () => void }) {
  const verified = profile.verificationStatus === "VERIFIED";
  const correction = profile.verificationStatus === "CORRECTION_REQUESTED" || profile.verificationStatus === "REJECTED";
  const documentsRequested = profile.verificationStatus === "DOCUMENT_REQUESTED";
  const title = verified ? "Cadastro aprovado!" : correction ? "Correção solicitada" : documentsRequested ? "Documentação solicitada" : profile.verificationStatus === "SUSPENDED" ? "Conta temporariamente suspensa" : profile.verificationStatus === "BLOCKED" ? "Conta bloqueada" : "Cadastro enviado para análise";
  const description = verified ? "Seu perfil de organizador foi verificado e sua conta está pronta para começar." : correction ? "Revise os dados indicados pela Equipe SorteX e envie novamente." : documentsRequested ? "Envie os documentos solicitados para retornar à fila de análise." : "Acompanhe aqui o status, as pendências e as próximas orientações da Equipe SorteX.";
  const dashboardAllowed = ["PENDING", "UNDER_REVIEW", "CORRECTION_REQUESTED", "DOCUMENT_REQUESTED", "VERIFIED"].includes(profile.verificationStatus);
  return <Card className="p-8 text-center"><div className={`mx-auto flex h-20 w-20 items-center justify-center rounded-full ${verified ? "bg-green-100 text-green-700" : "bg-blue-100 text-blue-700"}`}>{verified ? <ShieldCheck size={40} /> : <UploadCloud size={40} />}</div><h2 className="mt-6 text-3xl font-black">{title}</h2><p className="mx-auto mt-3 max-w-xl text-zinc-500">{description}</p>{dashboardAllowed?<div className="mx-auto mt-7 grid max-w-md gap-3 sm:grid-cols-2"><Button size="lg" onClick={onDashboard}>Ir para o Dashboard</Button>{verified?<Link href="/perfil" className="inline-flex min-h-12 items-center justify-center rounded-xl border bg-white px-5 font-bold text-zinc-800 transition hover:bg-zinc-50">Ver meu perfil</Link>:<Button variant="outline" size="lg" onClick={onEdit}>Revisar cadastro</Button>}</div>:(correction||documentsRequested) && <Button className="mt-6" onClick={onEdit}>{documentsRequested?'Enviar documento':'Corrigir cadastro'}</Button>}<p className="mt-6 text-xs text-zinc-400">{verified?"Seu cadastro já foi aprovado. Você pode acessar o painel ou revisar seu perfil.":"Você já pode conhecer o painel e preparar campanhas em rascunho. Publicação e recebimentos reais permanecem bloqueados até a aprovação."}</p></Card>;
}

function LoadingState() {
  return <div className="flex min-h-96 items-center justify-center"><LoaderCircle className="animate-spin text-violet-700" size={38} /></div>;
}

function ErrorState({ message }: { message: string }) {
  return <div className="mx-auto max-w-xl rounded-2xl bg-red-50 p-6 text-center text-red-700">{message || "Não foi possível carregar o cadastro."}</div>;
}
