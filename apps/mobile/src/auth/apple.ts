/** Prepared native-only adapter. Not enabled until the server broker is implemented. */
import { Platform } from "react-native";
import * as Apple from "expo-apple-authentication";
import { validateChallenge, type NativeIdentityBroker } from "./callback";
export async function prepareAppleIdentity(broker: NativeIdentityBroker) {
  if (Platform.OS !== "ios" || !(await Apple.isAvailableAsync()))
    throw Error(
      "Apple nativo requer iPhone compatível e development build configurado.",
    );
  const challenge = validateChallenge(await broker.challenge("apple", "ios"));
  const credential = await Apple.signInAsync({
    requestedScopes: [
      Apple.AppleAuthenticationScope.EMAIL,
      Apple.AppleAuthenticationScope.FULL_NAME,
    ],
    state: challenge.state,
    nonce: challenge.nonce,
  });
  if (credential.state !== challenge.state || !credential.identityToken)
    throw Error("Resposta Apple inválida. Inicie novamente.");
  validateChallenge(challenge);
  // Backend must verify signature, issuer, audience, nonce and consume state atomically.
  // Never derive a SorteX session or account link from unverified provider claims here.
  return broker.exchange({
    provider: "apple",
    state: challenge.state,
    nonce: challenge.nonce,
    idToken: credential.identityToken,
  });
}
