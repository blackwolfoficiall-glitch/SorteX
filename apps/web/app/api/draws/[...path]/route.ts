import { apiFetch, authenticatedApiFetch, jsonFromUpstream, readJson } from '@/lib/auth/server';

async function proxy(request:Request,context:{params:Promise<{path:string[]}>}){const {path}=await context.params;const query=new URL(request.url).search;const body=['GET','HEAD'].includes(request.method)?undefined:await request.text();const target=`/${path.join('/')}${query}`;const fetcher=request.method==='GET'&&path[0]==='public'?apiFetch:authenticatedApiFetch;const response=await fetcher(target,{method:request.method,body:body||undefined,headers:body?{'Content-Type':request.headers.get('content-type')??'application/json'}:undefined});return jsonFromUpstream(await readJson(response),response.status);}
export const GET=proxy;export const POST=proxy;export const PATCH=proxy;
