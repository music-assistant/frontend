import {
  EventType,
  ProviderStatus,
  ProviderType,
  UserRole,
  type ProviderConfig,
} from "@/plugins/api/interfaces";
import { saveDeviceSetting } from "@/helpers/device_settings";
import type { MusicAssistantApi } from "@/plugins/api";
import { flushPromises, shallowMount, type VueWrapper } from "@vue/test-utils";
import { nextTick } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { providerConfig } from "./fixtures/providerConfig";
import { user } from "./fixtures/user";

const {
  apiMock,
  authManagerMock,
  guestType,
  i18nMock,
  haStateMock,
  mockInitializeCompanionIntegration,
  mockInitializeWebPlayerModeSync,
  mockSubscribeToHAProperties,
  mockGetKioskModePreference,
  mockProxyEnsureReady,
  mockProxySetTransport,
  mockPruneStaleProviderFilters,
  mockRememberCurrentRemoteConnection,
  mockRouterPush,
  mockSetPreference,
  proxyState,
  routeState,
  storeMock,
  webPlayerMock,
} = vi.hoisted(() => {
  const guestType = { value: null as "party" | "music_quiz" | null };
  const apiMock = {
    authenticateWithToken: vi.fn<MusicAssistantApi["authenticateWithToken"]>(),
    baseUrl: "http://music-assistant.test",
    fetchState: vi.fn<MusicAssistantApi["fetchState"]>(),
    fetchProviders: vi.fn<MusicAssistantApi["fetchProviders"]>(),
    getCurrentUserInfo: vi.fn<MusicAssistantApi["getCurrentUserInfo"]>(),
    getLibraryAlbumsCount: vi.fn<MusicAssistantApi["getLibraryAlbumsCount"]>(),
    getLibraryArtistsCount:
      vi.fn<MusicAssistantApi["getLibraryArtistsCount"]>(),
    getLibraryAudiobooksCount:
      vi.fn<MusicAssistantApi["getLibraryAudiobooksCount"]>(),
    getLibraryGenresCount: vi.fn<MusicAssistantApi["getLibraryGenresCount"]>(),
    getLibraryPlaylistsCount:
      vi.fn<MusicAssistantApi["getLibraryPlaylistsCount"]>(),
    getLibraryPodcastsCount:
      vi.fn<MusicAssistantApi["getLibraryPodcastsCount"]>(),
    getLibraryRadiosCount: vi.fn<MusicAssistantApi["getLibraryRadiosCount"]>(),
    getLibraryTracksCount: vi.fn<MusicAssistantApi["getLibraryTracksCount"]>(),
    getProviderConfigs: vi.fn<MusicAssistantApi["getProviderConfigs"]>(),
    initialize: vi.fn<MusicAssistantApi["initialize"]>(),
    isRemoteConnection: { value: false },
    requireAuthentication: vi.fn<MusicAssistantApi["requireAuthentication"]>(),
    serverInfo: {
      value: {
        onboard_done: true,
        server_id: "server-id",
        status: "running",
      },
    },
    setLocale: vi.fn<MusicAssistantApi["setLocale"]>(),
    state: { value: "authenticated" },
    subscribe: vi.fn((_event: string, _callback: CallableFunction) => () => {}),
    supportsServerSideTranslations: false,
  };
  const authManagerMock = {
    bindPersistentToken: vi.fn(),
    clearGuestSession: vi.fn(),
    endRejectedGuestSession: vi.fn(),
    getToken: vi.fn(),
    guestSessionKind: vi.fn(() => guestType.value),
    isDashboardViewer: vi.fn(() => false),
    isGuestAccessSession: vi.fn(() => guestType.value !== null),
    isMusicQuizGuest: vi.fn(() => guestType.value === "music_quiz"),
    isPartyGuest: vi.fn(() => guestType.value === "party"),
    returnToFullApp: vi.fn(),
    setBaseUrl: vi.fn(),
    setCurrentUser: vi.fn(),
    setToken: vi.fn(),
  };

  return {
    apiMock,
    authManagerMock,
    guestType,
    i18nMock: {
      global: {
        locale: { value: "en" },
        t: (key: string) => key,
      },
    },
    haStateMock: { isSubscribed: false, kioskModeEnabled: false },
    mockInitializeCompanionIntegration: vi.fn(),
    mockInitializeWebPlayerModeSync: vi.fn(),
    mockSubscribeToHAProperties: vi.fn(),
    mockGetKioskModePreference: vi.fn(() => true),
    mockProxyEnsureReady: vi.fn(),
    mockProxySetTransport: vi.fn(),
    mockPruneStaleProviderFilters: vi.fn(),
    mockRememberCurrentRemoteConnection: vi.fn(),
    mockRouterPush: vi.fn(),
    mockSetPreference: vi.fn(),
    proxyState: { isReady: { value: true } },
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

vi.mock("@/plugins/api", async () => {
  // App.vue watches api.state, so the mock has to carry a real ref: assignments
  // to a plain { value } would never reach the watcher.
  const { ref } = await vi.importActual<typeof import("vue")>("vue");
  apiMock.state = ref(apiMock.state.value);
  return {
    api: apiMock,
    ConnectionState: {
      AUTHENTICATED: "authenticated",
      CONNECTED: "connected",
      DISCONNECTED: "disconnected",
      INITIALIZED: "initialized",
      RECONNECTING: "reconnecting",
    },
    default: apiMock,
  };
});

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

vi.mock("@/plugins/homeassistant", () => ({
  haState: haStateMock,
  subscribeToHAProperties: mockSubscribeToHAProperties,
  unsubscribeFromHAProperties: vi.fn(),
  getKioskModePreference: mockGetKioskModePreference,
}));

vi.mock("@/plugins/remote", () => ({
  remoteConnectionManager: {
    currentRemoteId: { value: null as string | null },
    rememberCurrentRemoteConnection: mockRememberCurrentRemoteConnection,
    setAuthenticated: vi.fn(),
  },
}));

vi.mock("@/plugins/remote/http-proxy", async () => {
  // showMainApp reads this, so the mock has to carry a real ref: the gate only
  // re-evaluates once the service worker reports ready if the read is tracked.
  const { ref } = await vi.importActual<typeof import("vue")>("vue");
  proxyState.isReady = ref(proxyState.isReady.value);
  return {
    httpProxyBridge: {
      ensureReady: mockProxyEnsureReady,
      isReady: proxyState.isReady,
      setTransport: mockProxySetTransport,
    },
  };
});

vi.mock("@/plugins/i18n", async () => {
  // App.vue watches the UI locale to push it to the server, so the mock has to
  // carry a real ref: assignments to a plain { value } never reach the watcher.
  const { ref } = await vi.importActual<typeof import("vue")>("vue");
  i18nMock.global.locale = ref(i18nMock.global.locale.value);
  return { i18n: i18nMock };
});

vi.mock("@vueuse/core", () => ({
  useColorMode: () => ({ value: "auto" }),
}));

vi.mock("vuetify", () => ({
  useTheme: () => ({
    change: vi.fn(),
    themes: {
      value: {
        light: { colors: { background: "#f5f5f5" } },
        dark: { colors: { background: "#181818" } },
      },
    },
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
    i18nMock.global.locale.value = "en";
    apiMock.state.value = "authenticated";
    apiMock.isRemoteConnection.value = false;
    apiMock.supportsServerSideTranslations = false;
    proxyState.isReady.value = true;
    apiMock.serverInfo.value = {
      onboard_done: true,
      server_id: "server-id",
      status: "running",
    };
    apiMock.getCurrentUserInfo.mockResolvedValue(
      user({
        role: UserRole.USER,
        user_id: "user-id",
        username: "regular-user",
      }),
    );
    apiMock.fetchState.mockResolvedValue(undefined);
    apiMock.fetchProviders.mockResolvedValue(undefined);
    apiMock.initialize.mockResolvedValue(undefined);
    apiMock.getProviderConfigs.mockResolvedValue([partyPluginConfig()]);
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
    haStateMock.isSubscribed = false;
    haStateMock.kioskModeEnabled = false;
    mockGetKioskModePreference.mockReturnValue(true);
    storeMock.currentUser = undefined;
    storeMock.enabledPlugins = new Set<string>();
    storeMock.isIngressSession = false;
    storeMock.isOnboarding = false;
    webPlayerMock.audioSource = "disabled";
    webPlayerMock.interacted = false;
    webPlayerMock.player_id = null;
    webPlayerMock.tabMode = "disabled";
    if (routeState.current) routeState.current.meta = {};
    vi.stubGlobal("localStorage", createStorage());
    vi.stubGlobal("sessionStorage", createStorage());
    authManagerMock.endRejectedGuestSession.mockImplementation(() => {
      const kind = authManagerMock.guestSessionKind();
      if (!kind) return { outcome: "no-guest-session" };
      authManagerMock.clearGuestSession();
      if (authManagerMock.getToken()) {
        authManagerMock.returnToFullApp();
        return { outcome: "own-session-restored" };
      }
      sessionStorage.setItem("ma_guest_session_ended", kind);
      return { outcome: "ended", kind };
    });
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
      apiMock.getCurrentUserInfo.mockResolvedValue(
        user({
          role: UserRole.GUEST,
          user_id: "guest-id",
          username: type === "party" ? "party_guest" : "music_quiz_guest",
        }),
      );

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

  it("follows the force mobile layout setting without a reload", async () => {
    wrapper = await mountApp();
    expect(storeMock.forceMobileLayout).toBe(false);

    saveDeviceSetting("force_mobile_layout", "true");
    expect(storeMock.forceMobileLayout).toBe(true);

    saveDeviceSetting("force_mobile_layout", null);
    expect(storeMock.forceMobileLayout).toBe(false);
  });

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
    expect(apiMock.getProviderConfigs).toHaveBeenNthCalledWith(
      4,
      ProviderType.PLUGIN,
      "milkdrop_visualizer",
    );
    expect(apiMock.getProviderConfigs).toHaveBeenNthCalledWith(
      5,
      ProviderType.PLUGIN,
      "library_automations",
    );
    expect(storeMock.enabledPlugins).toEqual(
      new Set<string>([
        "party",
        "music_quiz",
        "ai_radio",
        "milkdrop_visualizer",
        "library_automations",
      ]),
    );
    expect(mockInitializeWebPlayerModeSync).toHaveBeenCalledOnce();
    expectStartupDataRequestedBeforeReveal();

    await signalProvidersUpdated();
    expect(apiMock.getProviderConfigs).toHaveBeenCalledTimes(10);
    expect(mockPruneStaleProviderFilters).toHaveBeenCalledTimes(2);
  });

  it("waits for the startup data before revealing the main app", async () => {
    const serverState = createDeferred<void>();
    const pluginConfigs = createDeferred<ProviderConfig[]>();
    apiMock.fetchState.mockReturnValue(serverState.promise);
    apiMock.getProviderConfigs.mockReturnValue(pluginConfigs.promise);
    wrapper = await mountAppWithoutSettling();

    await flushPromises();
    expect(apiMock.fetchState).toHaveBeenCalledOnce();
    expectLibraryCountsNotCalled();
    expect(apiMock.getProviderConfigs).not.toHaveBeenCalled();
    expect(apiMock.state.value).not.toBe("initialized");

    serverState.resolve();
    await flushPromises();
    expectLibraryCountsCalled();
    expect(apiMock.getProviderConfigs).toHaveBeenCalledTimes(5);
    // The plugin lookups are still in flight: revealing the app here would
    // render it with an unknown set of enabled plugins.
    expect(apiMock.state.value).not.toBe("initialized");
    expect(mockInitializeWebPlayerModeSync).not.toHaveBeenCalled();
    expect(wrapper.find("router-view-stub").exists()).toBe(false);

    pluginConfigs.resolve([partyPluginConfig()]);
    await flushPromises();
    expect(apiMock.state.value).toBe("initialized");
    expect(wrapper.find("router-view-stub").exists()).toBe(true);
    expectStartupDataRequestedBeforeReveal();
  });

  it.each(["party", "music_quiz"] as const)(
    "does not mount browser media controls for a %s guest fallback tab",
    async (type) => {
      guestType.value = type;
      apiMock.getCurrentUserInfo.mockResolvedValue(
        user({
          role: UserRole.GUEST,
          user_id: "guest-id",
          username: type === "party" ? "party_guest" : "music_quiz_guest",
        }),
      );
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
    wrapper = await mountAppWithoutSettling();

    wrapper.findComponent({ name: "Login" }).vm.$emit("authenticated", {
      token: "regular-token",
      user: {
        preferences: {},
        role: "user",
        user_id: "user-id",
        username: "regular-user",
      },
    });

    await flushPromises();
    expect(mockRememberCurrentRemoteConnection).toHaveBeenCalledOnce();
    expect(authManagerMock.setToken).toHaveBeenCalledWith(
      "regular-token",
      "local:http://music-assistant.test",
    );
  });

  it("clears proxy mode before connecting to a local server", async () => {
    apiMock.state.value = "disconnected";
    wrapper = await mountAppWithoutSettling();

    wrapper
      .findComponent({ name: "Login" })
      .vm.$emit("local-connect", "http://music-assistant.local:8095");

    await flushPromises();
    expect(apiMock.initialize).toHaveBeenCalledWith(
      "http://music-assistant.local:8095",
    );
    expect(mockProxyEnsureReady).toHaveBeenCalledOnce();
    expect(mockProxySetTransport).toHaveBeenCalledWith(null);
    expect(mockProxySetTransport.mock.invocationCallOrder[0]).toBeLessThan(
      apiMock.initialize.mock.invocationCallOrder[0],
    );
  });

  it("withholds the main app on a remote connection until the proxy is ready", async () => {
    apiMock.isRemoteConnection.value = true;
    proxyState.isReady.value = false;

    wrapper = await mountApp();

    expect(wrapper.find("router-view-stub").exists()).toBe(false);
    // The login screen is gone too: this is the proxy gate, not a sign-in prompt.
    expect(wrapper.findComponent({ name: "Login" }).exists()).toBe(false);
  });

  it("shows the main app on a remote connection once the proxy is ready", async () => {
    apiMock.isRemoteConnection.value = true;
    proxyState.isReady.value = true;

    wrapper = await mountApp();

    expect(wrapper.find("router-view-stub").exists()).toBe(true);
  });

  it("reveals the main app when the proxy turns ready after mount", async () => {
    apiMock.isRemoteConnection.value = true;
    proxyState.isReady.value = false;
    wrapper = await mountApp();

    // The service worker reports ready asynchronously, so the gate has to lift
    // on a connection that mounted before it was controlling the page.
    proxyState.isReady.value = true;
    await nextTick();

    expect(wrapper.find("router-view-stub").exists()).toBe(true);
  });

  it.each(["party", "music_quiz"] as const)(
    "records an ended %s guest session when reconnecting is rejected",
    async (type) => {
      guestType.value = type;
      wrapper = await mountApp();
      // Second call runs after the guest session is cleared: nothing is left.
      authManagerMock.getToken
        .mockReturnValueOnce("guest-token")
        .mockReturnValue(null);
      apiMock.authenticateWithToken.mockRejectedValue(new Error("revoked"));

      await reconnect();

      expect(sessionStorage.getItem("ma_guest_session_ended")).toBe(type);
      expect(authManagerMock.clearGuestSession).toHaveBeenCalledOnce();
      expect(authManagerMock.returnToFullApp).not.toHaveBeenCalled();
      expect(apiMock.requireAuthentication).toHaveBeenCalledOnce();
    },
  );

  it("hands a reconnecting guest back to its own session when it has one", async () => {
    guestType.value = "party";
    wrapper = await mountApp();
    authManagerMock.getToken
      .mockReturnValueOnce("guest-token")
      .mockReturnValue("admin-token");
    apiMock.authenticateWithToken.mockRejectedValue(new Error("revoked"));

    await reconnect();

    expect(authManagerMock.returnToFullApp).toHaveBeenCalledOnce();
    expect(sessionStorage.getItem("ma_guest_session_ended")).toBeNull();
    expect(apiMock.requireAuthentication).not.toHaveBeenCalled();
  });

  it("keeps a rejected regular reconnect on the sign-in path", async () => {
    wrapper = await mountApp();
    authManagerMock.getToken.mockReturnValue("admin-token");
    apiMock.authenticateWithToken.mockRejectedValue(new Error("expired"));

    await reconnect();

    expect(sessionStorage.getItem("ma_guest_session_ended")).toBeNull();
    expect(authManagerMock.clearGuestSession).not.toHaveBeenCalled();
    expect(apiMock.requireAuthentication).toHaveBeenCalledOnce();
  });

  it("takes the safe area padding over in an ingress session", async () => {
    storeMock.isIngressSession = true;

    wrapper = await mountApp();

    expect(mockSubscribeToHAProperties).toHaveBeenCalledWith({
      handleSafeArea: true,
      kioskMode: true,
    });
  });

  it("leaves the Home Assistant chrome up when kiosk mode is turned off", async () => {
    storeMock.isIngressSession = true;
    mockGetKioskModePreference.mockReturnValue(false);

    wrapper = await mountApp();

    expect(mockSubscribeToHAProperties).toHaveBeenCalledWith({
      handleSafeArea: true,
      kioskMode: false,
    });
  });

  it("keeps a way back to Home Assistant while the server is away", async () => {
    haStateMock.kioskModeEnabled = true;
    wrapper = await mountApp();
    expect(wrapper.find(".ha-escape-button").exists()).toBe(false);

    // This screen replaces the whole app, sidebar and all, and kiosk mode has
    // left Home Assistant nothing on screen either: without this the panel is a
    // spinner with nowhere to go for as long as the server stays away.
    apiMock.state.value = "reconnecting";
    await nextTick();

    expect(wrapper.find(".ha-escape-button").exists()).toBe(true);
  });

  it("leaves the escape button off while Home Assistant shows its own menu", async () => {
    haStateMock.kioskModeEnabled = false;
    wrapper = await mountApp();

    apiMock.state.value = "reconnecting";
    await nextTick();

    expect(wrapper.find(".ha-escape-button").exists()).toBe(false);
  });

  it("leaves the safe area to the host outside an ingress session", async () => {
    wrapper = await mountApp();

    expect(mockSubscribeToHAProperties).not.toHaveBeenCalled();
  });

  it("keeps the safe area subscription it already has across a reconnect", async () => {
    storeMock.isIngressSession = true;
    haStateMock.isSubscribed = true;

    wrapper = await mountApp();

    expect(mockSubscribeToHAProperties).not.toHaveBeenCalled();
  });

  it("re-authenticates an ingress session through the proxy on reconnect", async () => {
    storeMock.isIngressSession = true;
    wrapper = await mountApp();
    const ingressUser = user({
      role: UserRole.ADMIN,
      user_id: "ingress-user",
      username: "ingress-user",
    });
    apiMock.getCurrentUserInfo.mockResolvedValue(ingressUser);

    await startReconnect();

    await flushPromises();
    expect(authManagerMock.setCurrentUser).toHaveBeenCalledWith(ingressUser);
    expect(apiMock.authenticateWithToken).not.toHaveBeenCalled();
    expect(apiMock.requireAuthentication).not.toHaveBeenCalled();
  });

  it("asks for authentication when an ingress reconnect finds no user", async () => {
    storeMock.isIngressSession = true;
    wrapper = await mountApp();
    apiMock.getCurrentUserInfo.mockClear();
    apiMock.getCurrentUserInfo.mockResolvedValue(null);

    await startReconnect();

    await flushPromises();
    expect(apiMock.requireAuthentication).toHaveBeenCalledOnce();
    expect(apiMock.getCurrentUserInfo).toHaveBeenCalledOnce();
  });

  it("asks for authentication when an ingress reconnect fails", async () => {
    storeMock.isIngressSession = true;
    wrapper = await mountApp();
    apiMock.getCurrentUserInfo.mockClear();
    apiMock.getCurrentUserInfo.mockRejectedValue(new Error("proxy down"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    await startReconnect();

    await flushPromises();
    expect(apiMock.requireAuthentication).toHaveBeenCalledOnce();
    expect(apiMock.getCurrentUserInfo).toHaveBeenCalledOnce();
  });

  it("pushes a locale change to a server that localizes its own strings", async () => {
    apiMock.supportsServerSideTranslations = true;
    wrapper = await mountAuthenticatedApp();

    i18nMock.global.locale.value = "de";

    await flushPromises();
    expect(apiMock.setLocale).toHaveBeenCalledWith("de");
    expect(apiMock.fetchState).toHaveBeenCalledOnce();
  });

  it("keeps the locale local on a server without server-side translations", async () => {
    wrapper = await mountAuthenticatedApp();

    i18nMock.global.locale.value = "de";
    await flushPromises();

    expect(apiMock.setLocale).not.toHaveBeenCalled();
    expect(apiMock.fetchState).not.toHaveBeenCalled();
  });

  it("skips the state refresh for a guest after a locale change", async () => {
    apiMock.supportsServerSideTranslations = true;
    guestType.value = "party";
    wrapper = await mountAuthenticatedApp();

    i18nMock.global.locale.value = "de";

    await flushPromises();
    expect(apiMock.setLocale).toHaveBeenCalledWith("de");
    expect(apiMock.fetchState).not.toHaveBeenCalled();
  });

  it("survives a failed locale push", async () => {
    apiMock.supportsServerSideTranslations = true;
    apiMock.setLocale.mockRejectedValue(new Error("offline"));
    wrapper = await mountAuthenticatedApp();

    i18nMock.global.locale.value = "de";

    await flushPromises();
    expect(apiMock.setLocale).toHaveBeenCalledWith("de");
    expect(apiMock.fetchState).not.toHaveBeenCalled();
  });
});

/**
 * Drive the connection through a reconnect, which re-authenticates the token.
 */
async function reconnect() {
  await startReconnect();
  await flushPromises();
  expect(apiMock.authenticateWithToken).toHaveBeenCalled();
}

/**
 * Take the connection down and back up, without waiting for a particular
 * re-authentication route.
 */
async function startReconnect() {
  apiMock.state.value = "reconnecting";
  await nextTick();
  apiMock.state.value = "connected";
  await nextTick();
}

/**
 * Mount the app and leave it in the authenticated state, with the calls made
 * during initialization cleared so later assertions only see fresh ones.
 */
async function mountAuthenticatedApp() {
  const mounted = await mountApp();
  apiMock.state.value = "authenticated";
  await nextTick();
  apiMock.fetchState.mockClear();
  return mounted;
}

/**
 * Mount the app, register it for teardown, and wait for initialization to
 * settle.
 *
 * Initialization runs entirely on the microtask queue, so one flush covers it;
 * a timer anywhere in that path would need vi.waitFor instead.
 */
async function mountApp() {
  const mounted = await mountAppWithoutSettling();
  await flushPromises();
  expect(apiMock.state.value).toBe("initialized");
  expect(mockInitializeWebPlayerModeSync).toHaveBeenCalledOnce();
  expect(apiMock.subscribe).toHaveBeenCalledTimes(3);
  return mounted;
}

/**
 * Mount the app and register it for teardown, without waiting for
 * initialization to settle; the test drives what happens next.
 */
async function mountAppWithoutSettling() {
  const { default: App } = await import("@/App.vue");
  // Registered at mount time so afterEach unmounts the app even when a
  // caller's assertion throws: a live instance keeps reacting to api.state
  // and corrupts every later test.
  wrapper = shallowMount(App, {
    global: {
      stubs: {
        RouterView: true,
      },
    },
  });
  return wrapper;
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

/**
 * Assert that every startup request is made before the app reveals itself,
 * which it does right after marking the connection initialized.
 */
function expectStartupDataRequestedBeforeReveal() {
  expect(mockInitializeWebPlayerModeSync).toHaveBeenCalledOnce();
  const [revealed] = mockInitializeWebPlayerModeSync.mock.invocationCallOrder;
  for (const method of [
    apiMock.fetchState,
    apiMock.getLibraryAlbumsCount,
    apiMock.getLibraryArtistsCount,
    apiMock.getLibraryAudiobooksCount,
    apiMock.getLibraryGenresCount,
    apiMock.getLibraryPlaylistsCount,
    apiMock.getLibraryPodcastsCount,
    apiMock.getLibraryRadiosCount,
    apiMock.getLibraryTracksCount,
    apiMock.getProviderConfigs,
  ]) {
    expect(method).toHaveBeenCalled();
    expect(Math.max(...method.mock.invocationCallOrder)).toBeLessThan(revealed);
  }
}

/**
 * Create a promise the test resolves itself, to hold a startup step open.
 */
function createDeferred<T = void>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
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

/**
 * The party plugin config, as returned for the plugin lookups App runs on init.
 */
function partyPluginConfig(): ProviderConfig {
  return providerConfig({
    type: ProviderType.PLUGIN,
    domain: "party",
    name: "Party",
    status: ProviderStatus.LOADED,
  });
}
