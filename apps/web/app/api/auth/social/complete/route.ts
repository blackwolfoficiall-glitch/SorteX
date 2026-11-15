import { socialPending } from "@/lib/auth/social-server";
export async function POST(request: Request) {
  return socialPending("complete", request);
}
