import { socialPending } from "@/lib/auth/social-server";
export async function GET() {
  return socialPending("pending");
}
