import { authManager } from "@/plugins/auth";
import { store } from "@/plugins/store";
import { useColorMode } from "@vueuse/core";
import { readonly, ref } from "vue";
import { useTheme } from "vuetify";

const THEME_STORAGE_KEY = "frontend.settings.theme";
const GUEST_THEME_STORAGE_KEY = "frontend.settings.guest_theme";

export const THEME_PREFERENCES = ["auto", "light", "dark"] as const;
export type ThemePreference = (typeof THEME_PREFERENCES)[number];

export function isThemePreference(value: unknown): value is ThemePreference {
  return THEME_PREFERENCES.includes(value as ThemePreference);
}

export function useThemePreference() {
  const theme = useTheme();
  const initialThemePreference = getThemePreference();
  const colorMode = useColorMode({
    initialValue: initialThemePreference,
    storageKey: null,
  });
  const themePreference = ref(initialThemePreference);

  function applyThemePreference(): void {
    applyTheme(getThemePreference());
  }

  function setGuestThemePreference(preference: ThemePreference): void {
    localStorage.setItem(GUEST_THEME_STORAGE_KEY, preference);
    applyTheme(preference);
  }

  return {
    themePreference: readonly(themePreference),
    applyThemePreference,
    setGuestThemePreference,
  };

  function applyTheme(preference: ThemePreference): void {
    const resolvedTheme =
      preference === "dark" ||
      (preference === "auto" &&
        typeof window.matchMedia === "function" &&
        window.matchMedia("(prefers-color-scheme: dark)").matches)
        ? "dark"
        : "light";

    themePreference.value = preference;
    theme.change(resolvedTheme);
    colorMode.value = preference === "auto" ? "auto" : resolvedTheme;
  }
}

function getThemePreference(): ThemePreference {
  const preference = authManager.isGuestAccessSession()
    ? localStorage.getItem(GUEST_THEME_STORAGE_KEY)
    : store.currentUser?.preferences?.theme ||
      localStorage.getItem(THEME_STORAGE_KEY);
  return isThemePreference(preference) ? preference : "auto";
}
