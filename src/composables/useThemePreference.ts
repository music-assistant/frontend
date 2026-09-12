import { authManager } from "@/plugins/auth";
import { store } from "@/plugins/store";
import { setUserPreference } from "@/composables/userPreferences";
import { setStatusBarThemeColor } from "./useStatusBarColor";
import { useColorMode } from "@vueuse/core";
import { computed, readonly, ref } from "vue";
import { useTheme } from "vuetify";

const THEME_STORAGE_KEY = "frontend.settings.theme";
const GUEST_THEME_STORAGE_KEY = "frontend.settings.guest_theme";

// While the preference is "auto", the OS scheme can change during the session
// (e.g. macOS switching appearance at sunset). The tailwind side (useColorMode)
// follows that on its own, but Vuetify resolves the theme once at apply time —
// so keep a single module-level listener that re-applies the Vuetify theme.
let systemSchemeQuery: MediaQueryList | undefined;
let systemSchemeListener: (() => void) | undefined;

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
  const isDarkTheme = computed(() => theme.current.value.dark);

  function applyThemePreference(): void {
    applyTheme(getThemePreference());
  }

  function setGuestThemePreference(preference: ThemePreference): void {
    localStorage.setItem(GUEST_THEME_STORAGE_KEY, preference);
    applyTheme(preference);
  }

  async function setThemePreference(
    preference: ThemePreference,
  ): Promise<void> {
    if (authManager.isGuestAccessSession()) {
      setGuestThemePreference(preference);
      return;
    }

    localStorage.setItem(THEME_STORAGE_KEY, preference);
    applyTheme(preference);
    await setUserPreference("theme", preference);
  }

  return {
    themePreference: readonly(themePreference),
    isDarkTheme,
    applyThemePreference,
    setThemePreference,
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
    setStatusBarThemeColor(theme.themes.value[resolvedTheme].colors.background);
    syncVuetifyToSystemScheme(preference);
  }

  function syncVuetifyToSystemScheme(preference: ThemePreference): void {
    if (preference === "auto") {
      if (!systemSchemeListener && typeof window.matchMedia === "function") {
        systemSchemeQuery = window.matchMedia("(prefers-color-scheme: dark)");
        systemSchemeListener = () => {
          const resolvedTheme = systemSchemeQuery!.matches ? "dark" : "light";
          theme.change(resolvedTheme);
          setStatusBarThemeColor(
            theme.themes.value[resolvedTheme].colors.background,
          );
        };
        systemSchemeQuery.addEventListener("change", systemSchemeListener);
      }
    } else if (systemSchemeQuery && systemSchemeListener) {
      systemSchemeQuery.removeEventListener("change", systemSchemeListener);
      systemSchemeQuery = undefined;
      systemSchemeListener = undefined;
    }
  }
}

function getThemePreference(): ThemePreference {
  const preference = authManager.isGuestAccessSession()
    ? localStorage.getItem(GUEST_THEME_STORAGE_KEY)
    : store.currentUser?.preferences?.theme ||
      localStorage.getItem(THEME_STORAGE_KEY);
  return isThemePreference(preference) ? preference : "auto";
}
