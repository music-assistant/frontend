import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

const { authState, routerAfterEach } = vi.hoisted(() => {
  vi.stubGlobal(
    "BroadcastChannel",
    class {
      onmessage: ((event: MessageEvent) => void) | null = null;

      postMessage() {}
    },
  );

  return {
    authState: {
      guest: null as "music_quiz" | "party" | null,
    },
    routerAfterEach: vi.fn(),
  };
});

vi.mock("@/plugins/auth", () => ({
  default: {
    isMusicQuizGuest: () => authState.guest === "music_quiz",
    isPartyGuest: () => authState.guest === "party",
    isGuestAccessSession: () => authState.guest !== null,
  },
}));

vi.mock("@/plugins/api", () => ({
  default: {
    subscribe: vi.fn(() => () => {}),
  },
}));

vi.mock("@/plugins/companion", async () => {
  const { ref } = await vi.importActual<typeof import("vue")>("vue");
  return { companionMode: ref(false) };
});

vi.mock("@/plugins/router", async () => {
  const { ref } = await vi.importActual<typeof import("vue")>("vue");
  return {
    default: {
      afterEach: routerAfterEach,
      currentRoute: ref({ matched: [] }),
      isReady: vi.fn().mockResolvedValue(undefined),
    },
  };
});

vi.mock("@/plugins/sendspin-connection", () => ({
  resetSendspinConnection: vi.fn(),
}));

import { companionMode } from "@/plugins/companion";
import { BrowserMediaControlsMode } from "@/helpers/device_settings";
import {
  clearWebPlayerAudioUnlock,
  initializeWebPlayerModeSync,
  partyListenInEnabled,
  registerWebPlayerAudioUnlock,
  webPlayer,
  WebPlayerMode,
} from "@/plugins/web_player";

function createStorage(): Storage {
  const values = new Map<string, string>();
  return {
    get length() {
      return values.size;
    },
    clear: () => values.clear(),
    getItem: (key) => values.get(key) ?? null,
    key: (index) => Array.from(values.keys())[index] ?? null,
    removeItem: (key) => values.delete(key),
    setItem: (key, value) => values.set(key, value),
  };
}

async function applyPreferredMode(): Promise<WebPlayerMode> {
  webPlayer.mode = WebPlayerMode.CONTROLS_ONLY;
  webPlayer.tabMode = WebPlayerMode.CONTROLS_ONLY;
  await initializeWebPlayerModeSync();
  return webPlayer.mode;
}

function setRegularPreferences(
  webPlayerEnabled: boolean,
  browserControlsMode: string | null,
): void {
  window.localStorage.setItem(
    "frontend.settings.web_player_enabled",
    String(webPlayerEnabled),
  );
  if (browserControlsMode === null) {
    window.localStorage.removeItem("frontend.settings.enable_browser_controls");
  } else {
    window.localStorage.setItem(
      "frontend.settings.enable_browser_controls",
      browserControlsMode,
    );
  }
}

// Mirrors saveDeviceSetting: the settings page writes the value and announces it.
function saveWebPlayerEnabled(enabled: boolean): void {
  const key = "frontend.settings.web_player_enabled";
  window.localStorage.setItem(key, String(enabled));
  window.dispatchEvent(
    new StorageEvent("storage", { key, newValue: String(enabled) }),
  );
}

describe("web player preferred mode", () => {
  beforeAll(() => {
    vi.spyOn(webPlayer, "setMode").mockImplementation(async (mode) => {
      webPlayer.mode = mode;
      webPlayer.tabMode = mode;
    });
  });

  afterAll(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  beforeEach(() => {
    authState.guest = null;
    companionMode.value = false;
    partyListenInEnabled.value = false;
    vi.stubGlobal("localStorage", createStorage());
    window.localStorage.clear();
  });

  it("reports whether an audio unlock handler is ready", () => {
    const handler = vi.fn(() => true);

    expect(webPlayer.primeAudio()).toBe(false);
    registerWebPlayerAudioUnlock(handler);
    expect(webPlayer.primeAudio()).toBe(true);
    expect(handler).toHaveBeenCalledOnce();
    clearWebPlayerAudioUnlock(handler);
    expect(webPlayer.primeAudio()).toBe(false);
  });

  it("uses receive-only Sendspin for Music Quiz guests", async () => {
    authState.guest = "music_quiz";
    setRegularPreferences(false, "true");

    expect(await applyPreferredMode()).toBe(WebPlayerMode.SENDSPIN_ONLY);
  });

  it.each([
    [WebPlayerMode.DISABLED, false],
    [WebPlayerMode.SENDSPIN_ONLY, true],
  ])(
    "keeps Party guests in %s when listen-in is %s",
    async (expectedMode, listenInEnabled) => {
      authState.guest = "party";
      partyListenInEnabled.value = listenInEnabled;

      expect(await applyPreferredMode()).toBe(expectedMode);
    },
  );

  it.each([
    [
      true,
      BrowserMediaControlsMode.ACTIVE_PLAYER,
      WebPlayerMode.SENDSPIN_WITH_CONTROLS,
      BrowserMediaControlsMode.ACTIVE_PLAYER,
    ],
    [
      true,
      BrowserMediaControlsMode.WEB_PLAYER,
      WebPlayerMode.SENDSPIN_WITH_CONTROLS,
      BrowserMediaControlsMode.WEB_PLAYER,
    ],
    [
      true,
      BrowserMediaControlsMode.DISABLED,
      WebPlayerMode.SENDSPIN_ONLY,
      BrowserMediaControlsMode.DISABLED,
    ],
    [
      false,
      BrowserMediaControlsMode.ACTIVE_PLAYER,
      WebPlayerMode.CONTROLS_ONLY,
      BrowserMediaControlsMode.ACTIVE_PLAYER,
    ],
    [
      false,
      BrowserMediaControlsMode.WEB_PLAYER,
      WebPlayerMode.DISABLED,
      BrowserMediaControlsMode.WEB_PLAYER,
    ],
    [
      false,
      BrowserMediaControlsMode.DISABLED,
      WebPlayerMode.DISABLED,
      BrowserMediaControlsMode.DISABLED,
    ],
    [
      false,
      "true",
      WebPlayerMode.DISABLED,
      BrowserMediaControlsMode.WEB_PLAYER,
    ],
    [
      true,
      "false",
      WebPlayerMode.SENDSPIN_ONLY,
      BrowserMediaControlsMode.DISABLED,
    ],
    [
      true,
      null,
      WebPlayerMode.SENDSPIN_WITH_CONTROLS,
      BrowserMediaControlsMode.WEB_PLAYER,
    ],
  ])(
    "maps web player %s and browser controls %s to %s",
    async (
      webPlayerEnabled,
      browserControlsMode,
      expectedMode,
      expectedControlsMode,
    ) => {
      setRegularPreferences(webPlayerEnabled, browserControlsMode);

      expect(await applyPreferredMode()).toBe(expectedMode);
      expect(webPlayer.browserControlsMode).toBe(expectedControlsMode);
    },
  );

  it("drops the web player as soon as the setting is switched off", async () => {
    setRegularPreferences(true, BrowserMediaControlsMode.ACTIVE_PLAYER);
    expect(await applyPreferredMode()).toBe(
      WebPlayerMode.SENDSPIN_WITH_CONTROLS,
    );

    // The settings page reloads right after saving, so waiting for the next
    // navigation would leave the server holding a player nobody listens to.
    saveWebPlayerEnabled(false);
    await vi.waitUntil(() => webPlayer.mode === WebPlayerMode.CONTROLS_ONLY);
  });
});
