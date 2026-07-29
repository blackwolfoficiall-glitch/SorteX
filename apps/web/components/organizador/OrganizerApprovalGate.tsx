'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getOrganizerProfile } from '@/lib/organizers/client';

export default function OrganizerApprovalGate({children}:{children:React.ReactNode}){
  const router=useRouter();const [allowed,setAllowed]=useState(false);
  useEffect(()=>{let active=true;getOrganizerProfile().then(profile=>{if(!active)return;if(['PENDING','UNDER_REVIEW','CORRECTION_REQUESTED','DOCUMENT_REQUESTED','VERIFIED'].includes(profile.verificationStatus)){setAllowed(true);return;}router.replace('/organizador/verificacao');}).catch(()=>router.replace('/organizador/verificacao'));return()=>{active=false}},[router]);
  if(!allowed)return <main className="grid min-h-[60vh] place-items-center"><div className="h-10 w-10 animate-spin rounded-full border-4 border-violet-200 border-t-violet-700" aria-label="Validando aprovação do organizador"/></main>;
  return children;
}
