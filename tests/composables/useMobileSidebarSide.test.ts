import { saveDeviceSetting } from "@/helpers/device_settings";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const STORAGE_KEY = "frontend.settings.mobile_sidebar_side";

const createLocalStorageMock = (): Storage => {
  const store = new Map<string, string>();
  return {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key: string) {
      return store.get(key) ?? null;
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null;
    },
    removeItem(key: string) {
      store.delete(key);
    },
    setItem(key: string, value: string) {
      store.set(key, value);
    },
  };
};

// the composable keeps one shared value, read when its module first loads
async function loadMobileSidebarSide() {
  vi.resetModules();
  const { useMobileSidebarSide } =
    await import("@/composables/useMobileSidebarSide");
  return useMobileSidebarSide();
}

describe("useMobileSidebarSide", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", createLocalStorageMock());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("opens from the left by default", async () => {
    expect((await loadMobileSidebarSide()).value).toBe("left");
  });

  it("uses the stored side", async () => {
    localStorage.setItem(STORAGE_KEY, "right");

    expect((await loadMobileSidebarSide()).value).toBe("right");
  });

  it("follows the setting without a reload", async () => {
    const side = await loadMobileSidebarSide();

    saveDeviceSetting("mobile_sidebar_side", "right");
    expect(side.value).toBe("right");

    saveDeviceSetting("mobile_sidebar_side", null);
    expect(side.value).toBe("left");
  });

  it("ignores other device settings", async () => {
    const side = await loadMobileSidebarSide();
    localStorage.setItem(STORAGE_KEY, "right");

    saveDeviceSetting("force_mobile_layout", "true");

    expect(side.value).toBe("left");
  });
});
