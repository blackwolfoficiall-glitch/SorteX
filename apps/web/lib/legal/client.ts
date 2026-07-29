import { authRequest } from "@/lib/auth/client";
export type LegalDocument={id:string;title:string;subtitle:string|null;slug:string;category:string;content:{html?:string;blocks?:Array<{text?:string}>};version:number;status:"DRAFT"|"PUBLISHED"|"ARCHIVED";required:boolean;changeSummary:string|null;publishedAt:string|null;createdAt:string;updatedAt:string;createdBy?:{name:string};updatedBy?:{name:string};_count?:{versions:number;acceptances:number}};
export type LegalAcceptance={id:string;version:number;acceptedAt:string;device:string|null;browser:string|null;operatingSystem:string|null;document:{title:string;slug:string;category:string}};
export const adminLegalDocuments=(query="")=>authRequest<LegalDocument[]>(`/api/legal/admin${query}`,{cache:"no-store"});
export const adminLegalDocument=(id:string)=>authRequest<LegalDocument>(`/api/legal/admin/${id}`,{cache:"no-store"});
export const saveLegalDocument=(id:string|undefined,body:Record<string,unknown>)=>authRequest<LegalDocument>(id?`/api/legal/admin/${id}`:"/api/legal/admin",{method:id?"PUT":"POST",body:JSON.stringify(body)});
export const legalAction=(id:string,action:string,body:Record<string,unknown>={})=>authRequest<LegalDocument>(`/api/legal/admin/${id}/${action}`,{method:"POST",body:JSON.stringify(body)});
export const deleteLegalDocument=(id:string)=>authRequest(`/api/legal/admin/${id}`,{method:"DELETE"});
export const legalHistory=(id:string)=>authRequest<Array<LegalDocument&{createdBy:{name:string}}>>(`/api/legal/admin/${id}/history`,{cache:"no-store"});
export const legalUsers=(id:string,type:"acceptances"|"pending-users")=>authRequest<Array<Record<string,unknown>>>(`/api/legal/admin/${id}/${type}`,{cache:"no-store"});
export const publicLegalDocuments=()=>fetch("/api/legal/public",{cache:"no-store"}).then(assertJson<LegalDocument[]>);
export const publicLegalDocument=(slug:string)=>fetch(`/api/legal/public/${encodeURIComponent(slug)}`,{cache:"no-store"}).then(assertJson<LegalDocument>);
export const acceptLegalDocument=(slug:string)=>authRequest(`/api/legal/${encodeURIComponent(slug)}/accept`,{method:"POST"});
export const myLegalAcceptances=()=>authRequest<LegalAcceptance[]>("/api/legal/acceptances/me",{cache:"no-store"});
export const pendingLegalDocuments=()=>authRequest<LegalDocument[]>("/api/legal/pending",{cache:"no-store"});
export const createDataRequest=(type:string,reason?:string)=>authRequest("/api/legal/data-requests",{method:"POST",body:JSON.stringify({type,reason})});
export const myDataRequests=()=>authRequest<Array<Record<string,unknown>>>("/api/legal/data-requests/me",{cache:"no-store"});
function assertJson<T>(response:Response){if(!response.ok)throw new Error("Não foi possível carregar os documentos.");return response.json() as Promise<T>}
