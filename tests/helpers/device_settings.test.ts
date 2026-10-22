import {
  BROWSER_MEDIA_CONTROLS,
  BrowserMediaControlsMode,
  getBrowserMediaControlsMode,
  saveDeviceSetting,
} from "@/helpers/device_settings";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("getBrowserMediaControlsMode", () => {
  beforeEach(() => {
    const values = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => values.get(key) ?? null,
      removeItem: (key: string) => values.delete(key),
      setItem: (key: string, value: string) => values.set(key, value),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it.each([
    [null, BrowserMediaControlsMode.WEB_PLAYER],
    ["true", BrowserMediaControlsMode.WEB_PLAYER],
    ["false", BrowserMediaControlsMode.DISABLED],
    [
      BrowserMediaControlsMode.ACTIVE_PLAYER,
      BrowserMediaControlsMode.ACTIVE_PLAYER,
    ],
    [BrowserMediaControlsMode.WEB_PLAYER, BrowserMediaControlsMode.WEB_PLAYER],
    [BrowserMediaControlsMode.DISABLED, BrowserMediaControlsMode.DISABLED],
  ])("maps %s to %s", (storedValue, expectedMode) => {
    saveDeviceSetting(BROWSER_MEDIA_CONTROLS, storedValue);

    expect(getBrowserMediaControlsMode()).toBe(expectedMode);
  });
});
