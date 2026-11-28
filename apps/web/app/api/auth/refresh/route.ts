import { cookies } from "next/headers";
import { REFRESH_COOKIE, renewAuthSession } from "@/lib/auth/server";

export async function POST() {
  const cookieStore = await cookies();
  const refreshToken = cookieStore.get(REFRESH_COOKIE)?.value;

  if (!refreshToken) {
    return Response.json(
      { message: "Sessão não encontrada." },
      { status: 401 },
    );
  }

  const renewal = await renewAuthSession(cookieStore, refreshToken);
  return renewal.ok ? Response.json({ refreshed: true }) : renewal.response;
}
