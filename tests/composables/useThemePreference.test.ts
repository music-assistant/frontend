import { useThemePreference } from "@/composables/useThemePreference";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  changeTheme: vi.fn(),
  colorMode: { value: "auto" },
  colorModeOptions: undefined as unknown,
  isGuestSession: { value: false },
  store: {
    currentUser: {
      preferences: {} as Record<string, unknown>,
    },
  },
}));

vi.mock("@/plugins/auth", () => ({
  authManager: {
    isGuestAccessSession: () => mocks.isGuestSession.value,
  },
}));

vi.mock("@/plugins/store", () => ({
  store: mocks.store,
}));

vi.mock("@vueuse/core", () => ({
  useColorMode: (options: unknown) => {
    mocks.colorModeOptions = options;
    return mocks.colorMode;
  },
}));

vi.mock("vuetify", () => ({
  useTheme: () => ({
    change: mocks.changeTheme,
  }),
}));

describe("useThemePreference", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("localStorage", createStorage());
    mocks.colorMode.value = "auto";
    mocks.colorModeOptions = undefined;
    mocks.isGuestSession.value = false;
    mocks.store.currentUser.preferences = {};
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn().mockReturnValue({ matches: false }),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("applies the regular user's preference", () => {
    mocks.store.currentUser.preferences.theme = "dark";
    const { applyThemePreference, themePreference } = useThemePreference();

    applyThemePreference();

    expect(themePreference.value).toBe("dark");
    expect(mocks.changeTheme).toHaveBeenCalledWith("dark");
    expect(mocks.colorMode.value).toBe("dark");
    expect(mocks.colorModeOptions).toEqual({
      initialValue: "dark",
      storageKey: null,
    });
  });

  function createStorage(): Storage {
    const values = new Map<string, string>();
    return {
      get length() {
        return values.size;
      },
      clear() {
        values.clear();
      },
      getItem(key) {
        return values.get(key) ?? null;
      },
      key(index) {
        return Array.from(values.keys())[index] ?? null;
      },
      removeItem(key) {
        values.delete(key);
      },
      setItem(key, value) {
        values.set(key, value);
      },
    };
  }

  it("keeps guest appearance separate from the regular preference", () => {
    mocks.isGuestSession.value = true;
    mocks.store.currentUser.preferences.theme = "dark";
    localStorage.setItem("frontend.settings.guest_theme", "light");
    const { applyThemePreference, themePreference } = useThemePreference();

    applyThemePreference();

    expect(themePreference.value).toBe("light");
    expect(mocks.changeTheme).toHaveBeenCalledWith("light");
  });

  it("persists and applies a guest appearance selection", () => {
    mocks.isGuestSession.value = true;
    const { setGuestThemePreference, themePreference } = useThemePreference();

    setGuestThemePreference("dark");

    expect(localStorage.getItem("frontend.settings.guest_theme")).toBe("dark");
    expect(themePreference.value).toBe("dark");
    expect(mocks.changeTheme).toHaveBeenCalledWith("dark");
  });

  it("follows the system appearance in auto mode", () => {
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn().mockReturnValue({ matches: true }),
    });
    const { applyThemePreference } = useThemePreference();

    applyThemePreference();

    expect(mocks.changeTheme).toHaveBeenCalledWith("dark");
    expect(mocks.colorMode.value).toBe("auto");
  });
});
