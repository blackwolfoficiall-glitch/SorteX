import OrganizerPublicHub from "@/components/public/OrganizerPublicHub";

export default async function OrganizerPublicPage({params,searchParams}:{params:Promise<{organizerId:string}>;searchParams:Promise<{view?:string;returnTo?:string}>}){
  const [{organizerId},query]=await Promise.all([params,searchParams]);
  const allowed=["campaigns","winners","audit","contact"] as const;
  const view=allowed.includes(query.view as typeof allowed[number])?query.view as typeof allowed[number]:"campaigns";
  return <OrganizerPublicHub organizerId={organizerId} view={view} returnTo={query.returnTo||"/"}/>;
}
