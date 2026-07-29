import { authenticatedApiFetch, jsonFromUpstream, readJson } from '@/lib/auth/server';
export async function PATCH(request:Request){const body=await request.text();const response=await authenticatedApiFetch('/organizers/me/account',{method:'PATCH',body,headers:{'Content-Type':'application/json'}});return jsonFromUpstream(await readJson(response),response.status)}
