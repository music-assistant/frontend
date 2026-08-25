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
    themes: {
      value: {
        light: { colors: { background: "#f5f5f5" } },
        dark: { colors: { background: "#181818" } },
      },
    },
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
    stubMatchMedia(createMediaQueryMock(false));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.head
      .querySelectorAll('meta[name="theme-color"]')
      .forEach((meta) => {
        meta.remove();
      });
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
    stubMatchMedia(createMediaQueryMock(true));
    const { applyThemePreference } = useThemePreference();

    applyThemePreference();

    expect(mocks.changeTheme).toHaveBeenCalledWith("dark");
    expect(mocks.colorMode.value).toBe("auto");
  });

  it("matches the status bar to the resolved theme background", () => {
    mocks.store.currentUser.preferences.theme = "light";
    const meta = createThemeColorMeta();
    const { applyThemePreference } = useThemePreference();

    applyThemePreference();

    expect(meta.content).toBe("#f5f5f5");
  });

  it("moves the status bar with the system scheme in auto mode", async () => {
    const media = createMediaQueryMock(false);
    stubMatchMedia(media);
    const meta = createThemeColorMeta();
    const { applyThemePreference } = await freshComposable();

    applyThemePreference();
    expect(meta.content).toBe("#f5f5f5");

    media.matches = true;
    media.dispatch();

    expect(meta.content).toBe("#181818");
  });

  function createThemeColorMeta(): HTMLMetaElement {
    const meta = document.createElement("meta");
    meta.name = "theme-color";
    document.head.appendChild(meta);
    return meta;
  }

  it("re-applies the Vuetify theme when the system scheme changes in auto mode", async () => {
    const media = createMediaQueryMock(false);
    stubMatchMedia(media);
    const { applyThemePreference } = await freshComposable();

    applyThemePreference();
    expect(mocks.changeTheme).toHaveBeenLastCalledWith("light");

    media.matches = true;
    media.dispatch();

    expect(mocks.changeTheme).toHaveBeenLastCalledWith("dark");
  });

  it("stops following the system scheme once a fixed theme is chosen", async () => {
    const media = createMediaQueryMock(false);
    stubMatchMedia(media);
    const { applyThemePreference } = await freshComposable();
    applyThemePreference();

    mocks.store.currentUser.preferences.theme = "light";
    applyThemePreference();
    expect(media.removeEventListener).toHaveBeenCalled();

    media.matches = true;
    media.dispatch();

    expect(mocks.changeTheme).toHaveBeenLastCalledWith("light");
  });

  // the composable keeps module-level listener state, so these tests import a
  // fresh module copy to stay order-independent
  async function freshComposable() {
    vi.resetModules();
    const mod = await import("@/composables/useThemePreference");
    return mod.useThemePreference();
  }

  function stubMatchMedia(media: ReturnType<typeof createMediaQueryMock>) {
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn().mockReturnValue(media),
    });
  }

  function createMediaQueryMock(matches: boolean) {
    const listeners: Array<() => void> = [];
    return {
      matches,
      addEventListener: vi.fn((_event: string, cb: () => void) => {
        listeners.push(cb);
      }),
      removeEventListener: vi.fn((_event: string, cb: () => void) => {
        const idx = listeners.indexOf(cb);
        if (idx >= 0) listeners.splice(idx, 1);
      }),
      dispatch() {
        for (const cb of listeners) cb();
      },
    };
  }
});
