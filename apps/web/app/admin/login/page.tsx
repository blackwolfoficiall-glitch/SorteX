'use client';

import { FormEvent, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { LockKeyhole, ShieldCheck } from 'lucide-react';
import { authRequest } from '@/lib/auth/client';
import type { AuthUser } from '@/lib/auth/types';

export default function AdminLoginPage(){
  const router=useRouter();const [email,setEmail]=useState(''),[password,setPassword]=useState(''),[error,setError]=useState(''),[loading,setLoading]=useState(false);
  useEffect(()=>{void fetch('/api/auth/admin-login',{method:'GET',credentials:'same-origin',cache:'no-store'}).catch(()=>undefined)},[]);
  async function submit(event:FormEvent){event.preventDefault();setLoading(true);setError('');try{const {user}=await authRequest<{user:AuthUser}>('/api/auth/admin-login',{method:'POST',body:JSON.stringify({email:email.trim().toLowerCase(),password})});if(user.role!=='ADMIN')throw new Error('Esta conta não possui acesso administrativo.');router.replace('/admin/dashboard');router.refresh();}catch(cause){setError(cause instanceof Error?cause.message:'Não foi possível entrar.');}finally{setLoading(false)}}
  return <main className="grid min-h-screen place-items-center bg-slate-950 p-5"><section className="w-full max-w-md rounded-3xl border border-white/10 bg-white p-7 shadow-2xl"><div className="flex items-center gap-3"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-violet-600 text-white"><ShieldCheck/></span><div><p className="text-2xl font-black">Sorte<span className="text-violet-600">X</span></p><p className="text-sm text-slate-500">Painel Administrativo · Equipe SorteX</p></div></div><h1 className="mt-8 text-2xl font-black">Acesso restrito</h1><p className="mt-1 text-sm text-slate-500">Entre com uma conta administrativa autorizada.</p><form onSubmit={submit} className="mt-6 space-y-4"><label className="block text-sm font-bold">E-mail<input type="email" required autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} className="mt-2 h-12 w-full rounded-xl border px-4"/></label><label className="block text-sm font-bold">Senha<input type="password" required autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)} className="mt-2 h-12 w-full rounded-xl border px-4"/></label>{error&&<p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-700">{error}</p>}<button disabled={loading} className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-violet-600 font-black text-white disabled:opacity-60"><LockKeyhole size={18}/>{loading?'Validando...':'Entrar no painel'}</button></form><p className="mt-5 text-center text-xs text-slate-400">Administradores não possuem cadastro público. Ações sensíveis são auditadas.</p></section></main>
}
