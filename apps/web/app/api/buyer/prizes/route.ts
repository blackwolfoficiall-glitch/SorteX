import { authenticatedApiFetch, readJson } from "@/lib/auth/server";
import {
  buyerPrizeEndpoints,
  projectBuyerPrizes,
  record,
  type BuyerPrizeKind,
  type BuyerPrizes,
} from "@/lib/buyer/prizes";

const headers = { "Cache-Control": "private, no-store" };

export async function GET() {
  // Resolve the cookie-authenticated principal before fetching either list;
  // no buyer ID or upstream path is supplied by the browser.
  const authorization = await authenticatedApiFetch("/auth/me", { method: "GET" });
  if (!authorization.ok) {
    return Response.json(
      { message: "Não foi possível consultar seus prêmios." },
      { status: authorization.status, headers },
    );
  }
  const buyer = record(await readJson(authorization));
  if (buyer.role !== "BUYER")
    return Response.json({ message: "Acesso restrito a compradores." }, { status: 403, headers });
  if (typeof buyer.id !== "string" || !buyer.id)
    return Response.json({ message: "Sessão de comprador inválida." }, { status: 502, headers });
  const buyerId = buyer.id;

  async function load(kind: BuyerPrizeKind) {
    try {
      const response = await authenticatedApiFetch(buyerPrizeEndpoints[kind], { method: "GET" });
      if (!response.ok) return null;
      return projectBuyerPrizes(await readJson(response), buyerId, kind);
    } catch {
      return null;
    }
  }

  const [draw, instant] = await Promise.all([load("draw"), load("instant")]);
  const payload: BuyerPrizes = { draw, instant };
  return Response.json(payload, { headers });
}
