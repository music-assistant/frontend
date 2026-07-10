import { EventType, ProviderType } from "@/plugins/api/interfaces";
import { shallowMount, type VueWrapper } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  apiMock,
  authManagerMock,
  guestType,
  mockInitializeCompanionIntegration,
  mockInitializeWebPlayerModeSync,
  mockPruneStaleProviderFilters,
  mockRouterPush,
  mockSetPreference,
  storeMock,
  webPlayerMock,
} = vi.hoisted(() => {
  const guestType = { value: null as "party" | "music_quiz" | null };
  const apiMock = {
    baseUrl: "http://music-assistant.test",
    fetchState: vi.fn(),
    getCurrentUserInfo: vi.fn(),
    getLibraryAlbumsCount: vi.fn(),
    getLibraryArtistsCount: vi.fn(),
    getLibraryAudiobooksCount: vi.fn(),
    getLibraryGenresCount: vi.fn(),
    getLibraryPlaylistsCount: vi.fn(),
    getLibraryPodcastsCount: vi.fn(),
    getLibraryRadiosCount: vi.fn(),
    getLibraryTracksCount: vi.fn(),
    getProviderConfigs: vi.fn(),
    isRemoteConnection: { value: false },
    serverInfo: {
      value: {
        onboard_done: true,
        server_id: "server-id",
        status: "running",
      },
    },
    setLocale: vi.fn(),
    state: { value: "authenticated" },
    subscribe: vi.fn((_event: string, _callback: CallableFunction) => () => {}),
    supportsServerSideTranslations: false,
  };
  const authManagerMock = {
    getToken: vi.fn(),
    isGuestAccessSession: vi.fn(() => guestType.value !== null),
    isMusicQuizGuest: vi.fn(() => guestType.value === "music_quiz"),
    isPartyGuest: vi.fn(() => guestType.value === "party"),
    setCurrentUser: vi.fn(),
  };

  return {
    apiMock,
    authManagerMock,
    guestType,
    mockInitializeCompanionIntegration: vi.fn(),
    mockInitializeWebPlayerModeSync: vi.fn(),
    mockPruneStaleProviderFilters: vi.fn(),
    mockRouterPush: vi.fn(),
    mockSetPreference: vi.fn(),
    storeMock: {
      currentUser: undefined as
        | {
            preferences?: Record<string, unknown>;
            role: string;
            user_id: string;
            username: string;
          }
        | undefined,
      enabledPlugins: new Set<string>(),
      forceMobileLayout: false,
      isInPWAMode: false,
      isIngressSession: false,
      isOnboarding: false,
      serverInfo: undefined as unknown,
    },
    webPlayerMock: {
      audioSource: "disabled",
      interacted: false,
      player_id: null,
      setBaseUrl: vi.fn(),
      setInteracted: vi.fn(),
      tabMode: "disabled",
    },
  };
});

vi.mock("@/plugins/api", () => ({
  api: apiMock,
  ConnectionState: {
    AUTHENTICATED: "authenticated",
    CONNECTED: "connected",
    DISCONNECTED: "disconnected",
    INITIALIZED: "initialized",
    RECONNECTING: "reconnecting",
  },
  default: apiMock,
}));

vi.mock("@/plugins/auth", () => ({
  authManager: authManagerMock,
  default: authManagerMock,
}));

vi.mock("@/plugins/store", () => ({
  store: storeMock,
}));

vi.mock("@/composables/userPreferences", () => ({
  pruneStaleProviderFilters: mockPruneStaleProviderFilters,
  useUserPreferences: () => ({
    setPreference: mockSetPreference,
  }),
}));

vi.mock("@/composables/useShortcuts", () => ({
  initGlobalShortcutsSync: vi.fn(),
}));

vi.mock("@/plugins/web_player", () => ({
  initializeWebPlayerModeSync: mockInitializeWebPlayerModeSync,
  webPlayer: webPlayerMock,
  WebPlayerMode: {
    CONTROLS_ONLY: "controls_only",
    SENDSPIN_ONLY: "sendspin_only",
    SENDSPIN_WITH_CONTROLS: "sendspin_with_controls",
  },
}));

vi.mock("@/plugins/companion", () => ({
  initializeCompanionIntegration: mockInitializeCompanionIntegration,
}));

vi.mock("@/plugins/remote", () => ({
  remoteConnectionManager: {
    setAuthenticated: vi.fn(),
  },
}));

vi.mock("@/plugins/remote/http-proxy", () => ({
  httpProxyBridge: {
    isReady: { value: true },
  },
}));

vi.mock("@/plugins/i18n", () => ({
  i18n: {
    global: {
      locale: { value: "en" },
      t: (key: string) => key,
    },
  },
}));

vi.mock("@vueuse/core", () => ({
  useColorMode: () => ({ value: "auto" }),
}));

vi.mock("vuetify", () => ({
  useTheme: () => ({
    change: vi.fn(),
  }),
}));

vi.mock("vue-router", () => ({
  useRouter: () => ({
    push: mockRouterPush,
  }),
}));

vi.mock("vue-sonner", () => ({
  toast: {
    dismiss: vi.fn(),
    info: vi.fn(),
    warning: vi.fn(),
  },
}));

vi.mock("@/components/ui/sonner", () => ({
  Toaster: { template: "<div />" },
}));

vi.mock("@/components/SendspinPlayer.vue", () => ({
  default: { template: "<div />" },
}));

vi.mock("@/layouts/default/PlayerOSD/PlayerBrowserMediaControls.vue", () => ({
  default: { template: "<div />" },
}));

vi.mock("@/views/Login.vue", () => ({
  default: { template: "<div />" },
}));

let wrapper: VueWrapper | undefined;

describe("App initialization", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
    guestType.value = null;
    apiMock.state.value = "authenticated";
    apiMock.serverInfo.value = {
      onboard_done: true,
      server_id: "server-id",
      status: "running",
    };
    apiMock.getCurrentUserInfo.mockResolvedValue({
      preferences: {},
      role: "user",
      user_id: "user-id",
      username: "regular-user",
    });
    apiMock.fetchState.mockResolvedValue(undefined);
    apiMock.getProviderConfigs.mockResolvedValue([{ enabled: true }]);
    for (const method of [
      apiMock.getLibraryAlbumsCount,
      apiMock.getLibraryArtistsCount,
      apiMock.getLibraryAudiobooksCount,
      apiMock.getLibraryGenresCount,
      apiMock.getLibraryPlaylistsCount,
      apiMock.getLibraryPodcastsCount,
      apiMock.getLibraryRadiosCount,
      apiMock.getLibraryTracksCount,
    ]) {
      method.mockResolvedValue(1);
    }
    mockInitializeWebPlayerModeSync.mockResolvedValue(undefined);
    mockPruneStaleProviderFilters.mockResolvedValue(undefined);
    storeMock.currentUser = undefined;
    storeMock.enabledPlugins = new Set<string>();
    storeMock.isOnboarding = false;
    vi.stubGlobal("localStorage", createStorage());
    localStorage.setItem("frontend.settings.theme", "dark");
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn().mockReturnValue({
        addEventListener: vi.fn(),
        matches: false,
      }),
    });
  });

  afterEach(() => {
    wrapper?.unmount();
    wrapper = undefined;
    vi.unstubAllGlobals();
  });

  it.each([
    ["party", "/guest"],
    ["music_quiz", "/music-quiz/play"],
  ] as const)(
    "avoids regular-user commands for a %s guest while initializing audio",
    async (type, destination) => {
      guestType.value = type;
      apiMock.getCurrentUserInfo.mockResolvedValue({
        preferences: {},
        role: "guest",
        user_id: "guest-id",
        username: type === "party" ? "party_guest" : "music_quiz_guest",
      });

      wrapper = await mountApp();

      expect(apiMock.getCurrentUserInfo).toHaveBeenCalledOnce();
      expect(mockSetPreference).not.toHaveBeenCalled();
      expect(apiMock.fetchState).not.toHaveBeenCalled();
      expect(mockPruneStaleProviderFilters).not.toHaveBeenCalled();
      expect(apiMock.getProviderConfigs).not.toHaveBeenCalled();
      expectLibraryCountsNotCalled();
      expect(webPlayerMock.setBaseUrl).toHaveBeenCalledWith(apiMock.baseUrl);
      expect(mockInitializeWebPlayerModeSync).toHaveBeenCalledOnce();
      expect(mockRouterPush).toHaveBeenCalledWith(destination);

      await signalProvidersUpdated();
      expect(apiMock.getProviderConfigs).not.toHaveBeenCalled();
      expect(mockPruneStaleProviderFilters).not.toHaveBeenCalled();
    },
  );

  it("keeps full initialization and plugin discovery for regular users", async () => {
    wrapper = await mountApp();

    expect(mockSetPreference).toHaveBeenCalledWith("theme", "dark");
    expect(apiMock.fetchState).toHaveBeenCalledOnce();
    expect(mockPruneStaleProviderFilters).toHaveBeenCalledOnce();
    expectLibraryCountsCalled();
    expect(apiMock.getProviderConfigs).toHaveBeenNthCalledWith(
      1,
      ProviderType.PLUGIN,
      "party",
    );
    expect(apiMock.getProviderConfigs).toHaveBeenNthCalledWith(
      2,
      ProviderType.PLUGIN,
      "music_quiz",
    );
    expect(storeMock.enabledPlugins).toEqual(
      new Set<string>(["party", "music_quiz"]),
    );
    expect(mockInitializeWebPlayerModeSync).toHaveBeenCalledOnce();

    await signalProvidersUpdated();
    expect(apiMock.getProviderConfigs).toHaveBeenCalledTimes(3);
    expect(mockPruneStaleProviderFilters).toHaveBeenCalledTimes(2);
  });
});

async function mountApp() {
  const { default: App } = await import("@/App.vue");
  const mounted = shallowMount(App, {
    global: {
      stubs: {
        RouterView: true,
      },
    },
  });
  await vi.waitFor(() => {
    expect(apiMock.state.value).toBe("initialized");
    expect(mockInitializeWebPlayerModeSync).toHaveBeenCalledOnce();
    expect(apiMock.subscribe).toHaveBeenCalledTimes(3);
  });
  return mounted;
}

async function signalProvidersUpdated() {
  const callbacks = apiMock.subscribe.mock.calls
    .filter(([event]) => event === EventType.PROVIDERS_UPDATED)
    .map(([, callback]) => callback as () => void | Promise<void>);
  expect(callbacks).toHaveLength(2);
  await Promise.all(callbacks.map((callback) => callback()));
}

function expectLibraryCountsNotCalled() {
  expect(apiMock.getLibraryAlbumsCount).not.toHaveBeenCalled();
  expect(apiMock.getLibraryArtistsCount).not.toHaveBeenCalled();
  expect(apiMock.getLibraryAudiobooksCount).not.toHaveBeenCalled();
  expect(apiMock.getLibraryGenresCount).not.toHaveBeenCalled();
  expect(apiMock.getLibraryPlaylistsCount).not.toHaveBeenCalled();
  expect(apiMock.getLibraryPodcastsCount).not.toHaveBeenCalled();
  expect(apiMock.getLibraryRadiosCount).not.toHaveBeenCalled();
  expect(apiMock.getLibraryTracksCount).not.toHaveBeenCalled();
}

function expectLibraryCountsCalled() {
  expect(apiMock.getLibraryAlbumsCount).toHaveBeenCalledOnce();
  expect(apiMock.getLibraryArtistsCount).toHaveBeenCalledOnce();
  expect(apiMock.getLibraryAudiobooksCount).toHaveBeenCalledOnce();
  expect(apiMock.getLibraryGenresCount).toHaveBeenCalledOnce();
  expect(apiMock.getLibraryPlaylistsCount).toHaveBeenCalledOnce();
  expect(apiMock.getLibraryPodcastsCount).toHaveBeenCalledOnce();
  expect(apiMock.getLibraryRadiosCount).toHaveBeenCalledOnce();
  expect(apiMock.getLibraryTracksCount).toHaveBeenCalledOnce();
}

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
