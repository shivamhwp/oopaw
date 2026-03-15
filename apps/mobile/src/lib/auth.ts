import * as SecureStore from "expo-secure-store";
import { tokenCache } from "@clerk/expo/token-cache";

export const secureTokenCache = {
  ...tokenCache,
  saveToken: (key: string, value: string) =>
    SecureStore.setItemAsync(key, value, {
      keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
    }),
  getToken: (key: string) => SecureStore.getItemAsync(key),
};
