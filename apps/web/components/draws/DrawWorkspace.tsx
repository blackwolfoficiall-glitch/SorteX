'use client';
import { useEffect, useState } from 'react';
import { FlaskConical, ShieldCheck, Trophy } from 'lucide-react';
import PremiumScope from '@/components/premium/PremiumScope';
import styles from './organizer-draw-premium.module.css';
import AdminLotteryHistory from './AdminLotteryHistory';

type Mode='organizer'|'winners'|'buyer'|'admin';
type JsonRecord=Record<string,unknown>;
const card='rounded-3xl border border-violet-100 bg-white p-6 shadow-sm';
export default function DrawWorkspace({mode}:{mode:Mode}){
  const [items,setItems]=useState<JsonRecord[]>([]);const [message,setMessage]=useState('');const [campaignId,setCampaignId]=useState('');const [lotteryDrawId,setLotteryDrawId]=useState('');
  const endpoint=mode==='buyer'?'/api/draws/winners/my':mode==='winners'?'/api/draws/winners/organizer':mode==='admin'?'/api/draws/admin/lottery-draws':'/api/draws/admin/lottery-draws';
  useEffect(()=>{fetch(endpoint).then(r=>r.json()).then(v=>setItems(Array.isArray(v)?v:[])).catch(()=>setItems([]));},[endpoint]);
  async function action(path:string,body:unknown={}){
    setMessage('Processando...');
    try {
      const response=await fetch(`/api/draws/${path}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
      const result=await response.json();
      if(!response.ok){
        setMessage(Array.isArray(result.message) ? result.message.join(' ') : result.message ?? 'Não foi possível concluir.');
        return;
      }
      setMessage(path.endsWith('/import/caixa')
        ? 'Extração importada e aguardando revisão. Nenhum resultado de campanha foi publicado.'
        : 'Operação concluída com registro auditável.');
      if(mode==='admin'){
        try {
          const refreshed=await fetch(endpoint);
          if(!refreshed.ok) throw new Error();
          const list=await refreshed.json();
          setItems(Array.isArray(list)?list:[]);
        } catch {
          setMessage('Operação concluída. Recarregue a página para atualizar a lista.');
        }
      }
    } catch {
      setMessage('Não foi possível confirmar a operação. Verifique a lista antes de tentar novamente.');
    }
  }
  if (mode === 'admin') {
    return (
      <AdminLotteryHistory
        items={items}
        message={message}
        forms={
          <>
            <LotteryForm onSubmit={(data) => action('admin/lottery-draws', data)} />
            <CaixaImportForm onSubmit={(extractionNumber) => action('admin/lottery-draws/import/caixa', { extractionNumber })} />
          </>
        }
        renderReview={(item) =>
          typeof item.id === 'string' && (item.status === 'PENDING_REVIEW' || item.status === 'VERIFIED') ? (
            <ReviewLotteryForm
              id={item.id}
              extraction={String(item.extractionNumber ?? '')}
              verified={item.status === 'VERIFIED'}
              onReview={(id, decision, reason) => action(`admin/lottery-draws/${encodeURIComponent(id)}/${decision}`, { reason })}
            />
          ) : null
        }
      />
    );
  }
  if(mode==='buyer')return <Shell title="Meus prêmios" subtitle="Acompanhe entregas e confirme o recebimento com segurança."><ItemList items={items}/></Shell>;
  if(mode==='winners')return <Shell title="Ganhadores" subtitle="Contato, entrega, confirmação e material de divulgação."><ItemList items={items}/><div className={card}><h2 className="text-lg font-bold">Prévia vertical 9:16</h2><div className="mx-auto mt-4 aspect-[9/16] max-w-64 rounded-[2rem] bg-gradient-to-b from-violet-950 to-violet-600 p-5 text-white"><div className="flex justify-between text-xs"><span>LOGO ORGANIZADOR</span><b>SorteX</b></div><div className="flex h-full flex-col items-center justify-center text-center"><span className="text-5xl">🏆</span><h3 className="mt-4 text-2xl font-black">Prêmio entregue</h3><p className="mt-2">Verificado pela SorteX</p><div className="mt-8 rounded-xl bg-white/15 p-3 text-xs">QR CODE • código público</div></div></div></div></Shell>;
  return (
    <PremiumScope className={styles.scope}>
      <section
        className={styles.content}
        aria-labelledby="organizer-draw-title"
      >
        <header className={styles.banner}>
          <span className={styles.icon}>
            <Trophy aria-hidden="true" size={25} />
          </span>
          <div>
            <p className={styles.eyebrow}>Apuração</p>
            <h1 id="organizer-draw-title" className="sx-premium-title">
              Motor de sorteios
            </h1>
            <p className={styles.muted}>
              Simule, execute e confirme separadamente, com regra publicada e
              resultado verificado.
            </p>
          </div>
        </header>
        <section
          className={styles.surface}
          aria-labelledby="organizer-draw-operation-title"
        >
          <h2
            id="organizer-draw-operation-title"
            className={styles.sectionTitle}
          >
            <ShieldCheck aria-hidden="true" size={21} /> Apuração da campanha
          </h2>
          <div className={styles.fields}>
            <OrganizerDrawField
              label="ID da campanha"
              value={campaignId}
              onChange={setCampaignId}
            />
            <OrganizerDrawField
              label="ID da extração verificada"
              value={lotteryDrawId}
              onChange={setLotteryDrawId}
            />
          </div>
          <div className={styles.actions}>
            <button
              className="sx-premium-button"
              data-variant="primary"
              type="button"
              onClick={() =>
                action(`campaigns/${campaignId}/draw/simulate`, {
                  lotteryDrawId,
                })
              }
            >
              Simular
            </button>
            <button
              className="sx-premium-button"
              type="button"
              onClick={() =>
                action(`campaigns/${campaignId}/draw/execute`, {
                  lotteryDrawId,
                })
              }
            >
              Executar prévia
            </button>
            <button
              className="sx-premium-button"
              type="button"
              onClick={() => action(`campaigns/${campaignId}/draw/confirm`)}
            >
              Confirmar resultado
            </button>
          </div>
          {message && (
            <p role="status" className={styles.message}>
              {message}
            </p>
          )}
        </section>
        <RuleSimulator />
      </section>
    </PremiumScope>
  );
}
function OrganizerDrawField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <label className={styles.field}>
      {label}
      <input value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}
function Shell({title,subtitle,children}:{title:string;subtitle:string;children:React.ReactNode}){return <main className="min-h-screen bg-slate-50 p-4 md:p-8"><div className="mx-auto max-w-6xl"><span className="text-sm font-bold uppercase tracking-widest text-violet-600">SorteX • Módulo 6</span><h1 className="mt-2 text-3xl font-black text-slate-950">{title}</h1><p className="mt-2 text-slate-600">{subtitle}</p><div className="mt-8 grid gap-6">{children}</div></div></main>}
function Field({label,value,onChange}:{label:string;value:string;onChange:(v:string)=>void}){return <label className="grid gap-2 text-sm font-semibold text-slate-700">{label}<input className="rounded-xl border border-slate-200 p-3 font-normal" value={value} onChange={e=>onChange(e.target.value)}/></label>}
function Button({onClick,children}:{onClick:()=>void;children:React.ReactNode}){return <button onClick={onClick} className="rounded-xl bg-violet-700 px-5 py-3 text-sm font-bold text-white transition hover:bg-violet-800">{children}</button>}
type ReviewDecision='verify'|'reject'|'lock';
type ReviewAction=(id:string,decision:ReviewDecision,reason:string)=>Promise<void>;
function ItemList({items,onReview}:{items:JsonRecord[],onReview?:ReviewAction}){
  return <div className={card}><h2 className="text-lg font-bold">Registros</h2>
    <div className="mt-4 grid gap-3">{items.length?items.map((item,index)=>
      <div key={String(item.id??index)} className="min-w-0">
        <pre className="overflow-auto rounded-xl bg-slate-950 p-4 text-xs text-emerald-300">{JSON.stringify(item,null,2)}</pre>
        {onReview&&typeof item.id==='string'&&(item.status==='PENDING_REVIEW'||item.status==='VERIFIED')&&
          <ReviewLotteryForm id={item.id} extraction={String(item.extractionNumber??'')} verified={item.status==='VERIFIED'} onReview={onReview}/>}
      </div>):<p className="text-sm text-slate-500">Nenhum registro disponível.</p>}</div>
  </div>;
}
function ReviewLotteryForm({id,extraction,verified,onReview}:{id:string,extraction:string,verified:boolean,onReview:ReviewAction}){
  const [reason,setReason]=useState('');
  const [busy,setBusy]=useState(false);
  const decisions: {type:ReviewDecision,label:string}[]=verified
    ? [{type:'lock',label:'Bloquear alterações'},{type:'reject',label:'Rejeitar'}]
    : [{type:'verify',label:'Verificar'} ,{type:'reject',label:'Rejeitar'}];
  async function submit(type:ReviewDecision){
    if(!reason.trim()||busy)return;
    setBusy(true);
    try{await onReview(id,type,reason.trim());}finally{setBusy(false);}
  }
  return <div className="mt-3 space-y-3">
    <Field label={`Justificativa da revisão ${extraction}`.trim()} value={reason} onChange={setReason}/>
    <div className="flex flex-wrap gap-2">
      {decisions.map(({type,label})=><button key={type} type="button" disabled={!reason.trim()||busy} className="rounded-xl bg-violet-700 px-4 py-2 text-sm font-bold text-white disabled:opacity-60" onClick={()=>void submit(type)}>{label}</button>)}
    </div>
  </div>;
}
function LotteryForm({onSubmit}:{onSubmit:(data:JsonRecord)=>Promise<void>}){const [values,setValues]=useState({extractionNumber:'',drawDate:'',firstPrize:'',secondPrize:'',thirdPrize:'',fourthPrize:'',fifthPrize:''});return <form className={card} onSubmit={e=>{e.preventDefault();void onSubmit({...values,sourceType:'MANUAL'});}}><h2 className="text-lg font-bold">Cadastrar extração</h2><div className="mt-4 grid gap-3 md:grid-cols-2"><Field label="Extração" value={values.extractionNumber} onChange={v=>setValues({...values,extractionNumber:v})}/><Field label="Data (ISO)" value={values.drawDate} onChange={v=>setValues({...values,drawDate:v})}/>{(['firstPrize','secondPrize','thirdPrize','fourthPrize','fifthPrize'] as const).map((key,i)=><Field key={key} label={`${i+1}º prêmio (5 dígitos)`} value={values[key]} onChange={v=>setValues({...values,[key]:v})}/>)}</div><div className="mt-4"><Button onClick={()=>undefined}>Salvar para revisão</Button></div></form>}
function CaixaImportForm({onSubmit}:{onSubmit:(extractionNumber:string)=>Promise<void>}){
  const [extractionNumber,setExtractionNumber]=useState('');
  const [busy,setBusy]=useState(false);
  return <form className={card} onSubmit={async(e)=>{
    e.preventDefault();
    if(busy) return;
    setBusy(true);
    try { await onSubmit(extractionNumber); } finally { setBusy(false); }
  }}>
    <h2 className="text-lg font-bold">Importar extração da CAIXA</h2>
    <p className="mt-1 text-sm text-slate-600">A consulta é feita somente quando habilitada neste ambiente. Os prêmios originais são guardados e a extração fica pendente de revisão.</p>
    <label className="mt-4 grid gap-2 text-sm font-semibold text-slate-700">Número da extração da CAIXA
      <input className="rounded-xl border border-slate-200 p-3 font-normal" value={extractionNumber} onChange={e=>setExtractionNumber(e.target.value)} inputMode="numeric" pattern="[1-9][0-9]{0,8}" required/>
    </label>
    <button type="submit" disabled={busy} className="mt-4 rounded-xl bg-violet-700 px-5 py-3 text-sm font-bold text-white transition hover:bg-violet-800 disabled:opacity-60">{busy?'Consultando a CAIXA...':'Importar para revisão'}</button>
  </form>;
}
function RuleSimulator(){const [result,setResult]=useState<JsonRecord|null>(null);async function simulate(){const steps=[1,2,3,4,5].map((sourcePrize,order)=>({order:order+1,sourcePrize,digitPosition:'UNIT',direction:'NORMAL'}));const response=await fetch('/api/draws/draw-rules/simulate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ruleDefinition:{version:1,outputLength:5,steps,normalization:{mode:'MODULO_TOTAL_NUMBERS'}},prizes:['12345','54321','00009','90807','11111'],totalNumbers:100000})});setResult(await response.json());}
  return (
    <section
      className={styles.surface}
      aria-labelledby="organizer-draw-simulator-title"
    >
      <h2 id="organizer-draw-simulator-title" className={styles.sectionTitle}>
        <FlaskConical aria-hidden="true" size={21} /> Simulador visual
      </h2>
      <p className={styles.muted}>Usa dados fictícios e nunca cria ganhador.</p>
      <div className={styles.actions}>
        <button type="button" className="sx-premium-button" onClick={simulate}>
          Executar simulação segura
        </button>
      </div>
      {result && (
        <pre className={styles.result}>{JSON.stringify(result, null, 2)}</pre>
      )}
    </section>
  );
}
