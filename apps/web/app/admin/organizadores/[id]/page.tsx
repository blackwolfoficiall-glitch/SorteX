"use client";

import Link from "next/link";
import Image from "next/image";
import { use, useEffect, useState } from "react";
import { ArrowLeft, CheckCircle2, ExternalLink, LoaderCircle, Save, ShieldCheck, Sparkles, XCircle } from "lucide-react";
import VerificationStatusBadge from "@/components/organizador/VerificationStatusBadge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/textarea";
import { authRequest } from "@/lib/auth/client";
import type { OrganizerPlan, OrganizerProfile } from "@/lib/organizers/types";
import { useAuthorizedUser } from "@/components/auth/RoleGate";
import { hasAdminPermission } from "@/lib/admin/authorization";

const plans: OrganizerPlan[] = ["BASIC", "PROFESSIONAL", "PREMIUM", "ENTERPRISE"];
const checklistItems=[['personalData','Dados pessoais conferidos'],['document','CPF/CNPJ conferido'],['phone','Telefone conferido'],['email','E-mail conferido'],['address','Endereço conferido'],['identity','Documento com foto conferido'],['proof','Comprovante conferido'],['social','Redes sociais avaliadas'],['activity','Atividade analisada'],['plan','Plano conferido'],['gateway','Gateway conferido'],['fee','Taxa definida']].map(([key,label])=>({key,label}));

type BackofficeOrganizer = OrganizerProfile & {
  createdAt?: string;
  riskLevel?: string;
  riskScore?: number;
  riskReasons?: string[];
  reviewChecklist?: Record<string, boolean>;
  payoutsBlocked?: boolean;
  financialAccount?: { status:string;availableBalance:number;pendingBalance:number;blockedBalance:number;lifetimeGrossRevenue:number } | null;
  internalNoteEntries?: Array<{id:string;category:string;text:string;createdAt:string;author?:{name:string}}>;
  feeHistory?: Array<{id:string;ruleType:string;newRate:number;reason:string;createdAt:string;admin?:{name:string}}>;
  reviewDecisions?: Array<{id:string;previousStatus:string;nextStatus:string;reason:string;createdAt:string;admin?:{name:string}}>;
  user: OrganizerProfile["user"] & { campaigns?: Array<{id:string;title:string;status:string}>; subscriptions?: Array<{status:string;selectedPlan?:{name:string}}> };
};

export default function AdminOrganizerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = useAuthorizedUser();
  const canManageFinance = Boolean(
    user && hasAdminPermission(user, "FINANCE_WRITE"),
  );
  const { id } = use(params);
  const [profile, setProfile] = useState<BackofficeOrganizer | null>(null);
  const [reason, setReason] = useState("");
  const [commercial, setCommercial] = useState({ currentPlan: "BASIC" as OrganizerPlan, platformFee: 2.9, monthlyFee: 29.9, customPlatformFee: "", firstCampaignFree: true, platformFeeWaived: false, monthlyFeeWaived: false, founder: false, vip: false });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [checklist,setChecklist]=useState<Record<string,boolean>>({});
  const [note,setNote]=useState("");
  const [noteCategory,setNoteCategory]=useState("GENERAL");
  const [campaignFeeId,setCampaignFeeId]=useState("");

  useEffect(() => {
    authRequest<BackofficeOrganizer>(`/api/admin/platform/organizers/${id}/backoffice`, { cache: "no-store" })
      .then((data) => {
        setProfile(data);
        setReason(data.rejectionReason || "");
        setCommercial({ currentPlan: data.currentPlan, platformFee: data.platformFee, monthlyFee: data.monthlyFee, customPlatformFee: data.customPlatformFee?.toString() || "", firstCampaignFree: data.firstCampaignFree, platformFeeWaived: data.platformFeeWaived, monthlyFeeWaived: data.monthlyFeeWaived, founder: data.founder, vip: data.vip });
        setChecklist(data.reviewChecklist || {});
      })
      .catch((cause) => setError(cause instanceof Error ? cause.message : "Não foi possível carregar o cadastro."))
      .finally(() => setLoading(false));
  }, [id]);

  async function review(status: string) {
    setSaving(true); setError("");
    try {
      if (reason.trim().length < 5) throw new Error("Informe um motivo com pelo menos 5 caracteres.");
      if (!window.confirm("Confirma esta decisão administrativa? Ela será registrada no histórico.")) return;
      await authRequest(`/api/admin/platform/organizers/${id}/decision`, { method: "POST", body: JSON.stringify({ status, reason: reason.trim() || (status === "VERIFIED" ? "Cadastro aprovado pela Equipe SorteX." : "Análise iniciada.") }) });
      setProfile(await authRequest<BackofficeOrganizer>(`/api/admin/platform/organizers/${id}/backoffice`, { cache: "no-store" }));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível concluir a análise."); }
    finally { setSaving(false); }
  }

  async function runRisk(){setSaving(true);setError("");try{await authRequest(`/api/admin/platform/organizers/${id}/risk-analysis`,{method:"POST"});setProfile(await authRequest<BackofficeOrganizer>(`/api/admin/platform/organizers/${id}/backoffice`,{cache:"no-store"}));}catch(cause){setError(cause instanceof Error?cause.message:"Não foi possível analisar o risco.");}finally{setSaving(false)}}
  async function saveChecklist(){setSaving(true);setError("");try{await authRequest(`/api/admin/platform/organizers/${id}/checklist`,{method:"PATCH",body:JSON.stringify({checklist})});}catch(cause){setError(cause instanceof Error?cause.message:"Não foi possível salvar o checklist.");}finally{setSaving(false)}}
  async function decideDocument(documentId:string,status:string){const reason=status==='REJECTED'?window.prompt('Motivo da rejeição:')||'':undefined;if(status==='REJECTED'&&!reason)return;try{await authRequest(`/api/admin/platform/organizer-documents/${documentId}/decision`,{method:'POST',body:JSON.stringify({status,reason,note:reason})});setProfile(await authRequest<BackofficeOrganizer>(`/api/admin/platform/organizers/${id}/backoffice`,{cache:'no-store'}));}catch(cause){setError(cause instanceof Error?cause.message:'Não foi possível analisar o documento.')}}
  async function addNote(){if(note.trim().length<3)return;try{await authRequest(`/api/admin/platform/organizers/${id}/internal-notes`,{method:'POST',body:JSON.stringify({category:noteCategory,text:note})});setNote('');setProfile(await authRequest<BackofficeOrganizer>(`/api/admin/platform/organizers/${id}/backoffice`,{cache:'no-store'}));}catch(cause){setError(cause instanceof Error?cause.message:'Não foi possível registrar a observação.')}}

  async function saveCommercial() {
    setSaving(true); setError("");
    try {
      await authRequest(`/api/admin/organizers/${id}/commercial-terms`, { method: "PATCH", body: JSON.stringify({ ...commercial, customPlatformFee: commercial.customPlatformFee === "" ? null : Number(commercial.customPlatformFee) }) });
      setProfile(await authRequest<BackofficeOrganizer>(`/api/admin/platform/organizers/${id}/backoffice`, { cache: "no-store" }));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível salvar as condições."); }
    finally { setSaving(false); }
  }

  async function saveFee(ruleType: "PLAN" | "CUSTOM" | "CAMPAIGN" | "ZERO_FEE" | "FIRST_CAMPAIGN_FREE") {
    if (!reason.trim()) { setError("Informe o motivo da condição comercial."); return; }
    setSaving(true); setError("");
    try {
      await authRequest(`/api/admin/platform/organizers/${id}/fee`, { method: "POST", body: JSON.stringify({ ruleType, rate: ["CUSTOM","CAMPAIGN"].includes(ruleType) ? Number(commercial.customPlatformFee || 0) : commercial.platformFee, campaignId: campaignFeeId || undefined, reason }) });
      setProfile(await authRequest<typeof profile>(`/api/admin/platform/organizers/${id}/backoffice`, { cache: "no-store" }));
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Não foi possível alterar a taxa."); }
    finally { setSaving(false); }
  }

  if (loading) return <main className="flex min-h-screen items-center justify-center"><LoaderCircle className="animate-spin text-violet-700" /></main>;
  if (!profile) return <main className="p-10 text-center text-red-700">{error || "Organizador não encontrado."}</main>;

  return (
    <main className="min-h-screen bg-zinc-50 px-5 py-8 md:px-10"><div className="mx-auto max-w-6xl space-y-6">
      <Link href="/admin/organizadores" className="inline-flex items-center gap-2 font-bold text-violet-700"><ArrowLeft size={18} /> Voltar</Link>
      <div className="flex flex-wrap items-start justify-between gap-4"><div><h1 className="text-3xl font-black">{profile.organizationName || profile.fullName}</h1><p className="mt-1 text-zinc-500">{profile.user.email}</p></div><VerificationStatusBadge status={profile.verificationStatus} /></div>
      {error && <p className="rounded-2xl bg-red-50 p-4 text-red-700">{error}</p>}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card className="p-6"><h2 className="text-xl font-black">Dados do cadastro</h2><div className="mt-5 grid gap-4 text-sm md:grid-cols-2"><Info label="Responsável" value={profile.fullName} /><Info label="CPF" value={profile.cpf} /><Info label="WhatsApp" value={profile.phone} /><Info label="Nascimento" value={profile.birthDate?.slice(0, 10) || "Não informado"} /><Info label="CNPJ" value={profile.cnpj || "Não possui"} /><Info label="Instagram" value={profile.instagram || "Não informado"} /><Info label="CEP" value={profile.postalCode || "Não informado"} /><Info label="Endereço" value={`${profile.address || ""}, ${profile.addressNumber || ""}${profile.addressComplement ? ` — ${profile.addressComplement}` : ""}`} /><Info label="Bairro" value={profile.neighborhood || "Não informado"} /><Info label="Cidade/UF" value={`${profile.city || ""} - ${profile.state || ""}`} /><Info label="Conta criada" value={profile.createdAt ? new Date(profile.createdAt).toLocaleString("pt-BR") : "Não informado"} /><Info label="Última atualização" value={new Date(profile.updatedAt).toLocaleString("pt-BR")} /></div></Card>
          <Card className="p-6"><h2 className="text-xl font-black">Operação e restrições</h2><div className="mt-4 grid gap-3 text-sm md:grid-cols-2"><Info label="Conta" value={profile.user.isActive ? "Ativa" : "Inativa"} /><Info label="Plano" value={profile.user.subscriptions?.[0]?.selectedPlan?.name || profile.currentPlan} /><Info label="Campanhas" value={String(profile.user.campaigns?.length || 0)} /><Info label="Publicação" value={profile.campaignsBlocked ? "Bloqueada" : "Liberada"} /><Info label="Recebimentos" value={profile.paymentsBlocked ? "Bloqueados" : "Liberados"} /><Info label="Saques" value={profile.payoutsBlocked ? "Bloqueados" : "Liberados"} /><Info label="Conta financeira" value={profile.financialAccount?.status || "Não criada"} /><Info label="Saldo disponível" value={money(profile.financialAccount?.availableBalance)} /><Info label="Saldo pendente" value={money(profile.financialAccount?.pendingBalance)} /><Info label="Saldo bloqueado" value={money(profile.financialAccount?.blockedBalance)} /></div></Card>
          <Card className="p-6"><div className="flex items-center justify-between gap-3"><div><h2 className="text-xl font-black">Análise automática local</h2><p className="mt-1 text-sm text-zinc-500">A análise auxilia a equipe e nunca aprova ou reprova automaticamente.</p></div><Button variant="outline" onClick={runRisk} disabled={saving}><Sparkles size={18}/>Executar análise</Button></div><div className="mt-4 rounded-2xl bg-zinc-50 p-4"><p className="font-black">Risco: {profile.riskLevel || 'Revisão manual'} · {profile.riskScore || 0}/100</p><ul className="mt-2 list-disc pl-5 text-sm text-zinc-600">{(profile.riskReasons||[]).map((item)=><li key={item}>{item}</li>)}</ul></div></Card>
          <Card className="p-6"><h2 className="text-xl font-black">Checklist da análise</h2><div className="mt-4 grid gap-2 md:grid-cols-2">{checklistItems.map(item=><label key={item.key} className="flex items-center gap-3 rounded-xl border p-3 text-sm font-semibold"><input type="checkbox" checked={Boolean(checklist[item.key])} onChange={event=>setChecklist(current=>({...current,[item.key]:event.target.checked}))}/>{item.label}</label>)}</div><Button className="mt-4" variant="outline" onClick={saveChecklist} disabled={saving}><Save size={18}/>Salvar checklist</Button></Card>
          <Card className="p-6"><h2 className="text-xl font-black">Documentos protegidos</h2><div className="mt-5 grid gap-3 md:grid-cols-2">{profile.documents.map((document) => <article key={document.id} className="rounded-2xl border p-4"><div className="flex items-start justify-between gap-2"><div><p className="font-semibold">{document.originalName}</p><p className="text-xs text-zinc-500">Versão {document.version||1} · {document.status||'Enviado'}</p></div><a href={`/api/organizer/documents/${document.id}/file`} target="_blank" aria-label="Visualizar documento" className="rounded-lg border p-2"><ExternalLink size={18}/></a></div><div className="mt-3 flex gap-2"><button onClick={()=>decideDocument(document.id,'APPROVED')} className="rounded-lg border px-3 py-2 text-xs font-bold text-emerald-700">Aprovar</button><button onClick={()=>decideDocument(document.id,'REJECTED')} className="rounded-lg border px-3 py-2 text-xs font-bold text-red-700">Rejeitar</button></div></article>)}{profile.documents.length === 0 && <p className="text-sm text-zinc-500">Nenhum documento enviado.</p>}</div></Card>
          {canManageFinance&&<Card className="p-6"><h2 className="text-xl font-black">Plano e taxa SorteX</h2><p className="mt-1 text-sm text-zinc-500">Prioridade: campanha, organizador, plano e taxa global. A taxa do gateway nunca é alterada aqui.</p><div className="mt-5 grid gap-4 md:grid-cols-3"><label className="text-sm font-semibold">Plano<select value={commercial.currentPlan} onChange={(event) => setCommercial((current) => ({ ...current, currentPlan: event.target.value as OrganizerPlan }))} className="mt-2 h-12 w-full rounded-xl border bg-white px-3">{plans.map((plan) => <option key={plan}>{plan}</option>)}</select></label><CommercialNumber label="Taxa padrão (%)" value={commercial.platformFee} onChange={(value) => setCommercial((current) => ({ ...current, platformFee: value }))} /><CommercialNumber label="Mensalidade (R$)" value={commercial.monthlyFee} onChange={(value) => setCommercial((current) => ({ ...current, monthlyFee: value }))} /><label className="text-sm font-semibold">Taxa personalizada (%)<Input className="mt-2 h-12" type="number" step="0.01" value={commercial.customPlatformFee} onChange={(event) => setCommercial((current) => ({ ...current, customPlatformFee: event.target.value }))} /></label><label className="text-sm font-semibold md:col-span-2">Campanha específica<select value={campaignFeeId} onChange={event=>setCampaignFeeId(event.target.value)} className="mt-2 h-12 w-full rounded-xl border bg-white px-3"><option value="">Nenhuma — aplicar ao organizador</option>{(profile.user.campaigns||[]).map((campaign)=><option key={campaign.id} value={campaign.id}>{campaign.title}</option>)}</select></label></div><div className="mt-5 flex flex-wrap gap-2"><Button variant="outline" onClick={saveCommercial} disabled={saving}><Save size={18} /> Salvar plano</Button><Button variant="secondary" onClick={()=>saveFee("PLAN")} disabled={saving}>Usar taxa do plano</Button><Button onClick={()=>saveFee("CUSTOM")} disabled={saving}>Aplicar taxa personalizada</Button><Button onClick={()=>saveFee("CAMPAIGN")} disabled={saving||!campaignFeeId}>Aplicar à campanha</Button><Button variant="destructive" onClick={()=>saveFee("ZERO_FEE")} disabled={saving}>Zerar taxa SorteX</Button><Button variant="outline" onClick={()=>saveFee("FIRST_CAMPAIGN_FREE")} disabled={saving}>Primeira campanha grátis</Button></div><div className="mt-4 rounded-xl bg-zinc-50 p-4 text-sm"><b>Simulação em venda de R$ 100,00</b><p>Taxa SorteX: R$ {(Number(commercial.customPlatformFee||commercial.platformFee)).toFixed(2)} · Valor antes da taxa do gateway: R$ {(100-Number(commercial.customPlatformFee||commercial.platformFee)).toFixed(2)}</p></div></Card>}
        </div>

        <div className="space-y-6">
          <Card className="p-6 text-center">{profile.logoUrl ? <Image src={`/api/organizer/logo/${profile.userId}`} alt={`Logo de ${profile.organizationName || profile.fullName}`} width={128} height={128} unoptimized className="mx-auto h-32 w-32 rounded-3xl object-contain" /> : <div className="mx-auto flex h-32 w-32 items-center justify-center rounded-3xl bg-zinc-100 text-zinc-400"><ShieldCheck size={44} /></div>}<p className="mt-4 text-sm font-semibold">Logo do organizador</p></Card>
          <Card className="p-6"><h2 className="text-xl font-black">Decisão administrativa</h2><p className="mt-2 text-sm text-zinc-500">A decisão altera permissões, registra o responsável e cria auditoria. A mensagem abaixo é segura para o organizador.</p><Textarea className="mt-4 min-h-28" placeholder="Motivo ou orientação ao organizador" value={reason} onChange={(event) => setReason(event.target.value)} /><div className="mt-4 grid gap-2"><Button variant="secondary" onClick={() => review("UNDER_REVIEW")} disabled={saving}>Assumir análise</Button><Button onClick={() => review("VERIFIED")} disabled={saving}><CheckCircle2 size={18} /> Aprovar organizador</Button><Button variant="secondary" onClick={() => review("CORRECTION_REQUESTED")} disabled={saving}>Solicitar correção</Button><Button variant="secondary" onClick={() => review("DOCUMENT_REQUESTED")} disabled={saving}>Solicitar documentos</Button><Button variant="destructive" onClick={() => review("REJECTED")} disabled={saving}><XCircle size={18} /> Reprovar cadastro</Button><Button variant="destructive" onClick={() => review("SUSPENDED")} disabled={saving}>Suspender</Button><Button variant="destructive" onClick={() => review("BLOCKED")} disabled={saving}>Bloquear</Button><Button variant="outline" onClick={() => review("VERIFIED")} disabled={saving}>Reativar e aprovar</Button></div></Card>
          <Card className="p-6"><h2 className="text-xl font-black">Observações internas</h2><p className="mt-1 text-xs text-zinc-500">Nunca são exibidas ao organizador.</p><select value={noteCategory} onChange={event=>setNoteCategory(event.target.value)} className="mt-4 h-11 w-full rounded-xl border px-3"><option value="REGISTRATION">Cadastro</option><option value="RISK">Risco</option><option value="COMMERCIAL">Comercial</option><option value="FINANCE">Financeiro</option><option value="SUPPORT">Suporte</option><option value="LEGAL">Jurídico</option><option value="GENERAL">Geral</option></select><Textarea value={note} onChange={event=>setNote(event.target.value)} className="mt-3 min-h-24" placeholder="Observação privada"/><Button className="mt-3" variant="outline" onClick={addNote}>Registrar observação</Button><div className="mt-4 space-y-2">{(profile.internalNoteEntries||[]).map(item=><div key={item.id} className="rounded-xl bg-zinc-50 p-3 text-sm"><b>{item.category}</b><p>{item.text}</p><p className="mt-1 text-xs text-zinc-400">{item.author?.name} · {new Date(item.createdAt).toLocaleString('pt-BR')}</p></div>)}</div></Card>
          {!!profile.reviewDecisions?.length && <Card className="p-6"><h2 className="text-xl font-black">Histórico de decisões</h2><div className="mt-4 space-y-3">{profile.reviewDecisions.map(item=><div key={item.id} className="rounded-xl bg-zinc-50 p-3 text-sm"><b>{item.previousStatus} → {item.nextStatus}</b><p className="text-zinc-600">{item.reason}</p><p className="mt-1 text-xs text-zinc-400">{item.admin?.name} · {new Date(item.createdAt).toLocaleString("pt-BR")}</p></div>)}</div></Card>}
        </div>
      </div>
    </div></main>
  );
}

function Info({ label, value }: { label: string; value: string }) { return <div className="rounded-xl bg-zinc-50 p-4"><p className="text-xs font-bold uppercase tracking-wide text-zinc-400">{label}</p><p className="mt-1 font-semibold">{value || "Não informado"}</p></div>; }
function CommercialNumber({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) { return <label className="text-sm font-semibold">{label}<Input className="mt-2 h-12" type="number" step="0.01" min="0" value={value} onChange={(event) => onChange(Number(event.target.value))} /></label>; }
function money(value?: number) { return value == null ? "Não disponível" : new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(Number(value)); }
