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
import {
  initializeWebPlayerModeSync,
  partyListenInEnabled,
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
  browserControlsEnabled: boolean,
): void {
  window.localStorage.setItem(
    "frontend.settings.web_player_enabled",
    String(webPlayerEnabled),
  );
  window.localStorage.setItem(
    "frontend.settings.enable_browser_controls",
    String(browserControlsEnabled),
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

  it("uses receive-only Sendspin for Music Quiz guests", async () => {
    authState.guest = "music_quiz";
    setRegularPreferences(false, true);

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
    [true, true, WebPlayerMode.SENDSPIN_WITH_CONTROLS],
    [true, false, WebPlayerMode.SENDSPIN_ONLY],
    [false, true, WebPlayerMode.CONTROLS_ONLY],
    [false, false, WebPlayerMode.DISABLED],
  ])(
    "keeps regular user preferences (%s, %s) mapped to %s",
    async (webPlayerEnabled, browserControlsEnabled, expectedMode) => {
      setRegularPreferences(webPlayerEnabled, browserControlsEnabled);

      expect(await applyPreferredMode()).toBe(expectedMode);
    },
  );
});
