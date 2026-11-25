import { Platform } from "react-native";
import * as SecureStore from "expo-secure-store";
import { SortexClient, type Vault } from "../api/client";
import { QA_API, validateApiUrl } from "../api/config";
import type { Tokens } from "../../../../packages/contracts/src/mobile";
let webMemory: Tokens | null = null;
const key = "sortex.development.session.v1";
export const vault: Vault =
  Platform.OS === "web"
    ? {
        read: async () => webMemory,
        write: async (value) => {
          webMemory = value;
        },
        clear: async () => {
          webMemory = null;
        },
      }
    : {
        read: async () => {
          const value = await SecureStore.getItemAsync(key);
          if (!value) return null;
          const data = JSON.parse(value) as Tokens;
          if (
            typeof data.accessToken !== "string" ||
            typeof data.refreshToken !== "string"
          )
            throw new Error("Sessão inválida");
          return data;
        },
        write: (tokens) =>
          SecureStore.setItemAsync(key, JSON.stringify(tokens), {
            keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
          }),
        clear: () => SecureStore.deleteItemAsync(key),
      };
export const API_URL = validateApiUrl(
  process.env.EXPO_PUBLIC_API_URL || QA_API,
  process.env.EXPO_PUBLIC_ALLOW_LOCAL_API === "1",
);
export const client = new SortexClient(API_URL, vault);
