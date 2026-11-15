import { apiFetch } from "@/lib/auth/server";
export async function GET() { return apiFetch("/locations/states"); }
