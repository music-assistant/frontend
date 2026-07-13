import { EventType, ProviderType } from "@/plugins/api/interfaces";
import { shallowMount, type VueWrapper } from "@vue/test-utils";
import { nextTick } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const {
  apiMock,
  authManagerMock,
  guestType,
  mockInitializeCompanionIntegration,
  mockInitializeWebPlayerModeSync,
  mockProxyEnsureReady,
  mockProxySetTransport,
  mockPruneStaleProviderFilters,
  mockRememberCurrentRemoteConnection,
  mockRouterPush,
  mockSetPreference,
  routeState,
  storeMock,
  webPlayerMock,
} = vi.hoisted(() => {
  const guestType = { value: null as "party" | "music_quiz" | null };
  const apiMock = {
    baseUrl: "http://music-assistant.test",
    fetchState: vi.fn(),
    fetchProviders: vi.fn(),
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
    initialize: vi.fn(),
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
    bindPersistentToken: vi.fn(),
    getToken: vi.fn(),
    isGuestAccessSession: vi.fn(() => guestType.value !== null),
    isMusicQuizGuest: vi.fn(() => guestType.value === "music_quiz"),
    isPartyGuest: vi.fn(() => guestType.value === "party"),
    setBaseUrl: vi.fn(),
    setCurrentUser: vi.fn(),
    setToken: vi.fn(),
  };

  return {
    apiMock,
    authManagerMock,
    guestType,
    mockInitializeCompanionIntegration: vi.fn(),
    mockInitializeWebPlayerModeSync: vi.fn(),
    mockProxyEnsureReady: vi.fn(),
    mockProxySetTransport: vi.fn(),
    mockPruneStaleProviderFilters: vi.fn(),
    mockRememberCurrentRemoteConnection: vi.fn(),
    mockRouterPush: vi.fn(),
    mockSetPreference: vi.fn(),
    routeState: {
      current: null as { meta: Record<string, unknown> } | null,
    },
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

vi.mock("@/helpers/connection_identity", () => ({
  createLocalConnectionIdentity: () => "local:http://music-assistant.test",
  createRemoteConnectionIdentity: () => "remote:REMOTE",
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
    rememberCurrentRemoteConnection: mockRememberCurrentRemoteConnection,
    setAuthenticated: vi.fn(),
  },
}));

vi.mock("@/plugins/remote/http-proxy", () => ({
  httpProxyBridge: {
    ensureReady: mockProxyEnsureReady,
    isReady: { value: true },
    setTransport: mockProxySetTransport,
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

vi.mock("vue-router", async () => {
  const { shallowReactive } =
    await vi.importActual<typeof import("vue")>("vue");
  routeState.current = shallowReactive({ meta: {} });
  return {
    useRoute: () => routeState.current,
    useRouter: () => ({
      push: mockRouterPush,
    }),
  };
});

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
  default: { name: "SendspinPlayer", template: "<div />" },
}));

vi.mock("@/layouts/default/PlayerOSD/PlayerBrowserMediaControls.vue", () => ({
  default: { name: "PlayerBrowserMediaControls", template: "<div />" },
}));

vi.mock("@/views/Login.vue", () => ({
  default: {
    name: "Login",
    emits: ["authenticated"],
    template: "<div />",
  },
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
    apiMock.fetchProviders.mockResolvedValue(undefined);
    apiMock.initialize.mockResolvedValue(undefined);
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
    mockProxyEnsureReady.mockResolvedValue(undefined);
    mockProxySetTransport.mockResolvedValue(undefined);
    mockPruneStaleProviderFilters.mockResolvedValue(undefined);
    storeMock.currentUser = undefined;
    storeMock.enabledPlugins = new Set<string>();
    storeMock.isOnboarding = false;
    webPlayerMock.audioSource = "disabled";
    webPlayerMock.interacted = false;
    webPlayerMock.player_id = null;
    webPlayerMock.tabMode = "disabled";
    if (routeState.current) routeState.current.meta = {};
    vi.stubGlobal("localStorage", createStorage());
    localStorage.setItem("frontend.settings.theme", "dark");
    Object.defineProperty(window, "matchMedia", {
      configurable: true,
      value: vi.fn().mockReturnValue({
        addEventListener: vi.fn(),
        matches: false,
      }),
    });
    Object.defineProperty(navigator, "mediaSession", {
      configurable: true,
      value: undefined,
    });
  });

  afterEach(() => {
    wrapper?.unmount();
    wrapper = undefined;
    vi.unstubAllGlobals();
  });

  it.each(["party", "music_quiz"] as const)(
    "avoids regular-user commands for a %s guest while initializing audio",
    async (type) => {
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
      expect(mockRememberCurrentRemoteConnection).not.toHaveBeenCalled();
      expect(apiMock.getProviderConfigs).not.toHaveBeenCalled();
      expect(apiMock.fetchProviders).toHaveBeenCalledOnce();
      expectLibraryCountsNotCalled();
      expect(webPlayerMock.setBaseUrl).toHaveBeenCalledWith(apiMock.baseUrl);
      expect(mockInitializeWebPlayerModeSync).toHaveBeenCalledOnce();
      expect(mockRouterPush).toHaveBeenCalledWith("/guest");

      await signalProvidersUpdated();
      expect(apiMock.getProviderConfigs).not.toHaveBeenCalled();
      expect(mockPruneStaleProviderFilters).not.toHaveBeenCalled();
    },
  );

  it("keeps full initialization and plugin discovery for regular users", async () => {
    wrapper = await mountApp();

    expect(mockSetPreference).toHaveBeenCalledWith("theme", "dark");
    expect(apiMock.fetchState).toHaveBeenCalledOnce();
    expect(apiMock.fetchProviders).not.toHaveBeenCalled();
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
    expect(apiMock.getProviderConfigs).toHaveBeenNthCalledWith(
      3,
      ProviderType.PLUGIN,
      "ai_radio",
    );
    expect(storeMock.enabledPlugins).toEqual(
      new Set<string>(["party", "music_quiz", "ai_radio"]),
    );
    expect(mockInitializeWebPlayerModeSync).toHaveBeenCalledOnce();

    await signalProvidersUpdated();
    expect(apiMock.getProviderConfigs).toHaveBeenCalledTimes(6);
    expect(mockPruneStaleProviderFilters).toHaveBeenCalledTimes(2);
  });

  it.each(["party", "music_quiz"] as const)(
    "does not mount browser media controls for a %s guest fallback tab",
    async (type) => {
      guestType.value = type;
      apiMock.getCurrentUserInfo.mockResolvedValue({
        preferences: {},
        role: "guest",
        user_id: "guest-id",
        username: type === "party" ? "party_guest" : "music_quiz_guest",
      });
      webPlayerMock.audioSource = "controls_only";
      webPlayerMock.interacted = true;
      webPlayerMock.tabMode = "controls_only";

      wrapper = await mountApp();

      expect(
        wrapper.findComponent({ name: "PlayerBrowserMediaControls" }).exists(),
      ).toBe(false);
    },
  );

  it("keeps browser media controls for regular fallback tabs", async () => {
    Object.defineProperty(navigator, "mediaSession", {
      configurable: true,
      value: {},
    });
    webPlayerMock.audioSource = "controls_only";
    webPlayerMock.interacted = true;
    webPlayerMock.tabMode = "controls_only";

    wrapper = await mountApp();

    expect(
      wrapper.findComponent({ name: "PlayerBrowserMediaControls" }).exists(),
    ).toBe(true);
  });

  it("clears browser media controls on participant routes for regular users", async () => {
    const mediaSession = {
      metadata: {} as MediaMetadata | null,
      playbackState: "playing" as MediaSessionPlaybackState,
      setActionHandler: vi.fn(),
      setPositionState: vi.fn(),
    };
    Object.defineProperty(navigator, "mediaSession", {
      configurable: true,
      value: mediaSession,
    });
    webPlayerMock.audioSource = "controls_only";
    webPlayerMock.interacted = true;
    webPlayerMock.tabMode = "controls_only";
    wrapper = await mountApp();

    if (routeState.current) {
      routeState.current.meta = { disableMediaSession: true };
    }
    await nextTick();

    expect(
      wrapper.findComponent({ name: "PlayerBrowserMediaControls" }).exists(),
    ).toBe(false);
    expect(mediaSession.metadata).toBeNull();
    expect(mediaSession.playbackState).toBe("none");
    expect(mediaSession.setPositionState).toHaveBeenCalledWith();
    expect(mediaSession.setActionHandler).toHaveBeenCalledTimes(7);

    if (routeState.current) routeState.current.meta = {};
    await nextTick();

    expect(
      wrapper.findComponent({ name: "PlayerBrowserMediaControls" }).exists(),
    ).toBe(true);
  });

  it("remembers a temporary remote connection after regular login", async () => {
    apiMock.state.value = "auth_required";
    const { default: App } = await import("@/App.vue");
    wrapper = shallowMount(App, {
      global: {
        stubs: {
          RouterView: true,
        },
      },
    });

    wrapper.findComponent({ name: "Login" }).vm.$emit("authenticated", {
      token: "regular-token",
      user: {
        preferences: {},
        role: "user",
        user_id: "user-id",
        username: "regular-user",
      },
    });

    await vi.waitFor(() => {
      expect(mockRememberCurrentRemoteConnection).toHaveBeenCalledOnce();
    });
    expect(authManagerMock.setToken).toHaveBeenCalledWith(
      "regular-token",
      "local:http://music-assistant.test",
    );
  });

  it("clears proxy mode before connecting to a local server", async () => {
    apiMock.state.value = "disconnected";
    const { default: App } = await import("@/App.vue");
    wrapper = shallowMount(App, {
      global: {
        stubs: {
          RouterView: true,
        },
      },
    });

    wrapper
      .findComponent({ name: "Login" })
      .vm.$emit("local-connect", "http://music-assistant.local:8095");

    await vi.waitFor(() => {
      expect(apiMock.initialize).toHaveBeenCalledWith(
        "http://music-assistant.local:8095",
      );
    });
    expect(mockProxyEnsureReady).toHaveBeenCalledOnce();
    expect(mockProxySetTransport).toHaveBeenCalledWith(null);
    expect(mockProxySetTransport.mock.invocationCallOrder[0]).toBeLessThan(
      apiMock.initialize.mock.invocationCallOrder[0],
    );
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
