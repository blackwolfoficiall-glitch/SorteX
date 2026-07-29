import { apiFetch, jsonFromUpstream, readJson } from '@/lib/auth/server';
export async function GET(_request:Request,{params}:{params:Promise<{code:string}>}){const {code}=await params;const response=await apiFetch(`/public/winners/verify/${encodeURIComponent(code)}`);return jsonFromUpstream(await readJson(response),response.status);}
