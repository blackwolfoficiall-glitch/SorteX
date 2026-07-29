"use client";

import { useRouter, useSearchParams } from "next/navigation";

export default function InstitutionalBackButton(){
  const router=useRouter();
  const searchParams=useSearchParams();
  const returnTo=searchParams.get("returnTo");
  return <button type="button" onClick={()=>{if(window.history.length>1)router.back();else router.replace(returnTo?.startsWith("/campanha/")?returnTo:"/")}} className="font-bold text-violet-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-600">← Voltar{returnTo?.startsWith("/campanha/")?" para a campanha":""}</button>;
}
