/** Accept only the development scheme. Session/identity tokens never travel in URLs. */
export function recoveryTokenFromUrl(value: string): string | null {
  try {
    const u = new URL(value);
    if (
      u.protocol !== "sortex-dev:" ||
      u.hostname !== "reset-password" ||
      (u.pathname && u.pathname !== "/") ||
      u.username ||
      u.password ||
      u.hash
    )
      return null;
    if (
      [...u.searchParams.keys()].some((k) => k !== "token") ||
      u.searchParams.getAll("token").length !== 1
    )
      return null;
    const token = u.searchParams.get("token");
    return token && /^[a-f0-9]{64}$/.test(token) ? token : null;
  } catch {
    return null;
  }
}
export type NativeProvider = "google" | "apple";
export interface NativeOAuthChallenge {
  state: string;
  nonce: string;
  expiresAt: string;
}
/** Future server adapter contract. Deliberately not routed to web OAuth endpoints. */
export interface NativeIdentityBroker {
  challenge(
    provider: NativeProvider,
    platform: "ios" | "android",
  ): Promise<NativeOAuthChallenge>;
  exchange(input: {
    provider: NativeProvider;
    state: string;
    nonce: string;
    idToken: string;
  }): Promise<{
    kind: "session" | "registration" | "linkRequired";
    oneTimeCode: string;
  }>;
}
export function validateChallenge(
  challenge: NativeOAuthChallenge,
  now = Date.now(),
) {
  if (
    !/^[A-Za-z0-9_-]{43}$/.test(challenge.state) ||
    !/^[A-Za-z0-9_-]{43}$/.test(challenge.nonce) ||
    !Number.isFinite(Date.parse(challenge.expiresAt)) ||
    Date.parse(challenge.expiresAt) <= now ||
    Date.parse(challenge.expiresAt) > now + 10 * 60 * 1000
  )
    throw Error("Desafio de autenticação inválido.");
  return challenge;
}
