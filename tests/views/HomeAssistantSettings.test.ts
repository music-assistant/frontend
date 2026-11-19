import SettingsPageHeader from "@/components/settings/SettingsPageHeader.vue";
import { useSettingsPageMenu } from "@/composables/useSettingsPageMenu";
import type { MusicAssistantApi } from "@/plugins/api";
import {
  type AIEngine,
  AIEngineKind,
  type ConfigEntry,
  ConfigEntryType,
  type CoreConfig,
  EventType,
  type Player,
  type ProviderConfig,
  type ProviderManifest,
  ProviderStatus,
  ProviderType,
  type RemoteAccessInfo,
  Scope,
  type ServerInfoMessage,
} from "@/plugins/api/interfaces";
import type {
  DeleteConfirmationDialogEvent,
  SetupFlowEndedCallback,
} from "@/plugins/eventbus";
import HomeAssistantSettings from "@/views/settings/HomeAssistantSettings.vue";
import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ref } from "vue";
import { providerConfig } from "../fixtures/providerConfig";
import { providerManifest } from "../fixtures/providerManifest";

const {
  apiMock,
  eventbusMock,
  hasScope,
  openLinkInNewTab,
  startAddProvider,
  toastMock,
} = vi.hoisted(() => ({
  apiMock: {
    getAIEngines: vi.fn<MusicAssistantApi["getAIEngines"]>(),
    getAIUsage: vi.fn<MusicAssistantApi["getAIUsage"]>(),
    getCoreConfig: vi.fn<MusicAssistantApi["getCoreConfig"]>(),
    saveCoreConfig: vi.fn<MusicAssistantApi["saveCoreConfig"]>(),
    getProviderConfigs: vi.fn<MusicAssistantApi["getProviderConfigs"]>(),
    saveProviderConfig: vi.fn<MusicAssistantApi["saveProviderConfig"]>(),
    reloadProvider: vi.fn<MusicAssistantApi["reloadProvider"]>(),
    removeProviderConfig: vi.fn<MusicAssistantApi["removeProviderConfig"]>(),
    getRemoteAccessInfo: vi.fn<MusicAssistantApi["getRemoteAccessInfo"]>(),
    configureRemoteAccess: vi.fn<MusicAssistantApi["configureRemoteAccess"]>(),
    getProvider: vi.fn(),
    subscribe: vi.fn(),
    players: {} as Record<string, Pick<Player, "provider">>,
    providers: {} as Record<string, unknown>,
    providerManifests: {} as Record<string, ProviderManifest>,
    serverInfo: undefined as unknown as { value: ServerInfoMessage },
  },
  eventbusMock: { emit: vi.fn() },
  hasScope: vi.fn<(scope: Scope) => boolean>(),
  openLinkInNewTab: vi.fn(),
  startAddProvider: vi.fn(),
  toastMock: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/plugins/api", () => ({ api: apiMock, default: apiMock }));
vi.mock("@/plugins/auth", () => ({ authManager: { hasScope } }));
vi.mock("@/plugins/eventbus", () => ({ eventbus: eventbusMock }));
vi.mock("@/plugins/router", () => ({ default: { push: vi.fn() } }));
vi.mock("vue-sonner", () => ({ toast: toastMock }));
vi.mock("@/helpers/utils", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/helpers/utils")>()),
  openLinkInNewTab,
}));
// one menu for the test to read what the page publishes into it
vi.mock("@/composables/useSettingsPageMenu", async () => {
  const { ref } = await import("vue");
  const menu = ref([]);
  return { useSettingsPageMenu: () => menu };
});
// the key, with the count it is given in brackets
vi.mock("@/plugins/i18n", () => ({
  $t: (key: string, count?: unknown) =>
    typeof count === "number" ? `${key}(${count})` : key,
}));
vi.mock("@/helpers/provider_add", () => ({ startAddProvider }));

enableAutoUnmount(afterEach);

// the form and the dialog are covered where they live
const settingsPageFormStub = {
  name: "SettingsPageForm",
  props: { page: String, embedded: Boolean },
  template: "<div data-testid='settings-page-form' />",
};
const providerSettingsDialogStub = {
  name: "ProviderSettingsDialog",
  props: { open: Boolean, instanceId: String },
  template: "<div data-testid='provider-settings-dialog' />",
};
const RouterLinkStub = {
  props: ["to"],
  template: '<a :href="JSON.stringify(to)"><slot /></a>',
};

// what the server has set up, by domain
let configs: Record<string, ProviderConfig[]>;

beforeEach(() => {
  vi.clearAllMocks();
  useSettingsPageMenu().value = [];
  hasScope.mockReturnValue(true);
  configs = {
    hass: [hassConfig(ProviderStatus.LOADED)],
    hass_players: [playersConfig(ProviderStatus.LOADED)],
  };
  apiMock.getProviderConfigs.mockImplementation(
    async (_type, domain) => configs[domain!] ?? [],
  );
  apiMock.getRemoteAccessInfo.mockResolvedValue(remoteAccess(true, true));
  apiMock.getAIEngines.mockResolvedValue([
    engine("ai_task.openai", AIEngineKind.TEXT, "hass"),
    engine("tts.piper", AIEngineKind.SPEECH, "hass"),
    engine("tts.cloud", AIEngineKind.SPEECH, "hass"),
    engine("gpt", AIEngineKind.TEXT, "openai_compatible--1"),
  ]);
  apiMock.getAIUsage.mockResolvedValue([]);
  apiMock.getCoreConfig.mockResolvedValue(webserverConfig(true));
  apiMock.saveCoreConfig.mockImplementation(async (_domain, values) =>
    webserverConfig(values[SELF_REGISTRATION] as boolean),
  );
  apiMock.saveProviderConfig.mockResolvedValue(
    hassConfig(ProviderStatus.LOADED),
  );
  apiMock.reloadProvider.mockResolvedValue(undefined);
  apiMock.removeProviderConfig.mockResolvedValue(undefined);
  apiMock.configureRemoteAccess.mockImplementation(async (enabled) =>
    remoteAccess(enabled, true),
  );
  apiMock.getProvider.mockReturnValue(undefined);
  apiMock.subscribe.mockReturnValue(vi.fn());
  apiMock.players = {
    kitchen: { provider: "hass_players" },
    living: { provider: "hass_players" },
    garden: { provider: "sonos--1" },
  };
  apiMock.providerManifests = {
    hass: providerManifest({
      domain: "hass",
      name: "Home Assistant",
      type: ProviderType.PLUGIN,
      has_setup_flow: true,
      documentation: HASS_DOCS,
    }),
    hass_players: providerManifest({
      domain: "hass_players",
      type: ProviderType.PLAYER,
      depends_on: "hass",
    }),
  };
  apiMock.serverInfo = ref({
    homeassistant_addon: false,
    has_remote_access: true,
  } as ServerInfoMessage);
});

describe("HomeAssistantSettings while Home Assistant is not set up", () => {
  it("heads the page with the header of Home Assistant", async () => {
    configs = {};
    const wrapper = await mountPage();

    expect(wrapper.getComponent(SettingsPageHeader).props("page")).toBe(
      "home_assistant",
    );
  });

  beforeEach(() => {
    configs = {};
  });

  it("explains the connection and offers to connect", async () => {
    const wrapper = await mountPage();

    const notConnected = wrapper.get(
      '[data-testid="home-assistant-not-connected"]',
    );
    expect(notConnected.text()).toContain(
      "settings.home_assistant.connect_description",
    );
    expect(rowKeys(wrapper)).toEqual([]);
    expect(wrapper.find('[data-testid="settings-page-form"]').exists()).toBe(
      false,
    );
    expect(apiMock.getRemoteAccessInfo).not.toHaveBeenCalled();
  });

  it("starts the setup of the Home Assistant provider", async () => {
    const wrapper = await mountPage();

    await wrapper
      .get('[data-testid="home-assistant-connect"]')
      .trigger("click");

    expect(startAddProvider).toHaveBeenCalledOnce();
    expect(startAddProvider.mock.calls[0][0]).toBe(
      apiMock.providerManifests.hass,
    );
  });
});

describe("HomeAssistantSettings while Home Assistant is connected", () => {
  it("shows its rows, with the connection to reconfigure on the spot", async () => {
    const wrapper = await mountPage();

    expect(rowKeys(wrapper)).toEqual([
      "connection",
      "players",
      "ai",
      "sign_in",
      "remote_access",
    ]);
    const connection = row(wrapper, "connection");
    expect(connection.element.tagName).toBe("DIV");
    expect(stateOf(connection)).toBe("settings.home_assistant.state_connected");
    expect(connection.text()).toContain(
      "settings.home_assistant.connection_description",
    );

    await connection
      .get('[data-testid="home-assistant-connection-action"]')
      .trigger("click");

    expect(eventbusMock.emit).toHaveBeenCalledExactlyOnceWith(
      "setupFlowDialog",
      { kind: "reconfigure", instanceId: "hass", name: "Home Assistant" },
    );
    expect(
      wrapper.find('[data-testid="home-assistant-not-connected"]').exists(),
    ).toBe(false);
  });

  it("chooses its players in a dialog, with how many it has", async () => {
    const wrapper = await mountPage();

    const players = row(wrapper, "players");
    expect(players.element.tagName).toBe("DIV");
    expect(stateOf(players)).toBe("2");
    expect(playersDialog(wrapper).props()).toEqual({
      open: false,
      instanceId: "hass_players",
    });

    await players
      .get('[data-testid="home-assistant-players-choose"]')
      .trigger("click");

    expect(playersDialog(wrapper).props("open")).toBe(true);
  });

  it("leads to the page of the provider of its players while it is not running", async () => {
    configs.hass_players = [playersConfig(ProviderStatus.ERROR)];
    const wrapper = await mountPage();

    const players = row(wrapper, "players");
    expect(linkOf(players)).toEqual({
      name: "editprovider",
      params: { instanceId: "hass_players" },
    });
    expect(
      wrapper.findComponent({ name: "ProviderSettingsDialog" }).exists(),
    ).toBe(false);
  });

  it("offers to add the provider of its players while it is not set up", async () => {
    configs.hass_players = [];
    const wrapper = await mountPage();

    const players = row(wrapper, "players");
    expect(players.element.tagName).toBe("BUTTON");
    expect(stateOf(players)).toBe("settings.home_assistant.players_add");

    await players.trigger("click");

    expect(startAddProvider).toHaveBeenCalledExactlyOnceWith(
      apiMock.providerManifests.hass_players,
      undefined,
      expect.any(Function),
    );
  });

  it("chooses the players of the provider it added once that runs", async () => {
    configs.hass_players = [];
    const wrapper = await mountPage();
    await row(wrapper, "players").trigger("click");
    const onFlowEnded = startAddProvider.mock
      .calls[0][2] as SetupFlowEndedCallback;

    onFlowEnded(true);
    configs.hass_players = [playersConfig(ProviderStatus.LOADING)];
    await providersUpdated();
    expect(
      wrapper.findComponent({ name: "ProviderSettingsDialog" }).exists(),
    ).toBe(false);

    configs.hass_players = [playersConfig(ProviderStatus.LOADED)];
    await providersUpdated();

    expect(playersDialog(wrapper).props("open")).toBe(true);
  });

  it("chooses no players after a setup that was cancelled", async () => {
    configs.hass_players = [];
    const wrapper = await mountPage();
    await row(wrapper, "players").trigger("click");
    const onFlowEnded = startAddProvider.mock
      .calls[0][2] as SetupFlowEndedCallback;

    onFlowEnded(false);
    configs.hass_players = [playersConfig(ProviderStatus.LOADED)];
    await providersUpdated();

    expect(playersDialog(wrapper).props("open")).toBe(false);
  });

  it("leads to the AI page, with the engines Home Assistant provides", async () => {
    const wrapper = await mountPage();

    const ai = row(wrapper, "ai");
    expect(linkOf(ai)).toEqual({ name: "aisettings" });
    expect(ai.text()).toContain("settings.home_assistant.ai_description");
    expect(stateOf(ai)).toBe(
      "settings.ai.engine_count.text(1) · settings.ai.engine_count.speech(2)",
    );
  });

  it("says when Home Assistant provides no engines", async () => {
    apiMock.getAIEngines.mockResolvedValue([]);

    const wrapper = await mountPage();

    expect(stateOf(row(wrapper, "ai"))).toBe("settings.home_assistant.ai_none");
  });

  it("shows no engine state until the engines are in", async () => {
    apiMock.getAIEngines.mockRejectedValue(new Error("unavailable"));

    const wrapper = await mountPage();

    expect(
      row(wrapper, "ai").find('[data-testid="home-assistant-state"]').exists(),
    ).toBe(false);
  });

  it("switches accounts for new Home Assistant users on the spot", async () => {
    const wrapper = await mountPage();

    const signIn = row(wrapper, "sign_in");
    expect(signIn.element.tagName).toBe("DIV");
    expect(signIn.text()).toContain(
      "settings.home_assistant.sign_in_new_users",
    );
    expect(apiMock.getCoreConfig).toHaveBeenCalledWith("webserver");
    const toggle = signIn.get(SIGN_IN_SWITCH);
    expect(toggle.attributes("data-state")).toBe("checked");
    expect(toggle.attributes("aria-label")).toBe(
      "settings.home_assistant.sign_in",
    );

    await toggle.trigger("click");
    await flushPromises();

    expect(apiMock.saveCoreConfig).toHaveBeenCalledExactlyOnceWith(
      "webserver",
      { [SELF_REGISTRATION]: false },
      { suppressGlobalError: true },
    );
    expect(toastMock.success).toHaveBeenCalledOnce();
    expect(signIn.get(SIGN_IN_SWITCH).attributes("data-state")).toBe(
      "unchecked",
    );
  });

  it("switches remote access off on the spot", async () => {
    const wrapper = await mountPage();

    const remote = row(wrapper, "remote_access");
    expect(remote.element.tagName).toBe("DIV");
    expect(stateOf(remote)).toBe(
      "settings.home_assistant.remote_access_ha_cloud",
    );
    expect(JSON.parse(remote.get(REMOTE_DETAILS).attributes("href")!)).toEqual({
      name: "remoteaccesssettings",
    });

    await remote.get(REMOTE_SWITCH).trigger("click");
    await flushPromises();

    expect(apiMock.configureRemoteAccess).toHaveBeenCalledExactlyOnceWith(
      false,
    );
    expect(toastMock.success).toHaveBeenCalledOnce();
    expect(remote.get(REMOTE_SWITCH).attributes("data-state")).toBe(
      "unchecked",
    );
    // the id and QR code only exist while it is on
    expect(remote.find(REMOTE_DETAILS).exists()).toBe(false);
    expect(remote.find('[data-testid="home-assistant-state"]').exists()).toBe(
      false,
    );
  });

  it("switches remote access on on the spot", async () => {
    apiMock.serverInfo.value.has_remote_access = false;
    apiMock.getRemoteAccessInfo.mockResolvedValue(remoteAccess(false, false));
    const wrapper = await mountPage();

    const remote = row(wrapper, "remote_access");
    expect(remote.get(REMOTE_SWITCH).attributes("data-state")).toBe(
      "unchecked",
    );
    expect(remote.find(REMOTE_DETAILS).exists()).toBe(false);

    await remote.get(REMOTE_SWITCH).trigger("click");
    await flushPromises();

    expect(apiMock.configureRemoteAccess).toHaveBeenCalledExactlyOnceWith(true);
    expect(stateOf(remote)).toBe(
      "settings.home_assistant.remote_access_ha_cloud",
    );
    expect(remote.find(REMOTE_DETAILS).exists()).toBe(true);
  });

  it("says when remote access runs without Home Assistant Link", async () => {
    apiMock.getRemoteAccessInfo.mockResolvedValue(remoteAccess(true, false));

    const wrapper = await mountPage();

    expect(stateOf(row(wrapper, "remote_access"))).toBe(
      "settings.home_assistant.remote_access_without_ha_cloud",
    );
  });

  it("shows the player controls below the rows, leaving the menu to the page", async () => {
    const wrapper = await mountPage();

    expect(wrapper.getComponent(settingsPageFormStub).props()).toEqual({
      page: "home_assistant",
      embedded: true,
    });
  });

  it.each([
    [Scope.CONFIG_CORE_WRITE, ["ai", "sign_in"]],
    [Scope.SYSTEM_MANAGE, ["remote_access"]],
  ])("leaves rows out without %s, which they need", async (scope, keys) => {
    hasScope.mockImplementation((granted) => granted !== scope);

    const wrapper = await mountPage();

    for (const key of keys) expect(rowKeys(wrapper)).not.toContain(key);
    expect(rowKeys(wrapper)).toHaveLength(5 - keys.length);
  });

  it("asks nothing about remote access of a user who may not manage it", async () => {
    hasScope.mockImplementation((scope) => scope !== Scope.SYSTEM_MANAGE);

    await mountPage();

    expect(apiMock.getRemoteAccessInfo).not.toHaveBeenCalled();
  });

  it("says that the add-on connects Music Assistant, with nothing to reconfigure", async () => {
    apiMock.serverInfo.value = {
      homeassistant_addon: true,
    } as ServerInfoMessage;

    const wrapper = await mountPage();

    const connection = row(wrapper, "connection");
    expect(connection.text()).toContain(
      "settings.home_assistant.connection_addon",
    );
    expect(connection.element.tagName).toBe("DIV");
    expect(connection.find(CONNECTION_ACTION).exists()).toBe(false);
    expect(
      wrapper.find('[data-testid="home-assistant-connect"]').exists(),
    ).toBe(false);
  });

  it("follows the server when the providers change", async () => {
    const wrapper = await mountPage();
    const [event] = apiMock.subscribe.mock.calls[0];
    expect(event).toBe(EventType.PROVIDERS_UPDATED);

    configs.hass = [hassConfig(ProviderStatus.ERROR)];
    await providersUpdated();

    expect(stateOf(row(wrapper, "connection"))).toBe(
      "settings.home_assistant.state_needs_attention",
    );
  });
});

describe("HomeAssistantSettings menu", () => {
  it("disables, reloads, documents and removes the connection", async () => {
    await mountPage();

    expect(visibleMenuLabels()).toEqual([
      "settings.disable",
      "settings.reload",
      "settings.documentation",
      "settings.remove_provider",
    ]);
  });

  it("disables the connection", async () => {
    await mountPage();

    menuItem("settings.disable").action?.();
    await flushPromises();

    expect(apiMock.saveProviderConfig).toHaveBeenCalledExactlyOnceWith(
      "hass",
      { enabled: false },
      "hass",
    );
    expect(toastMock.success).toHaveBeenCalledWith("settings.provider_saved");
  });

  it("reloads the connection", async () => {
    await mountPage();

    menuItem("settings.reload").action?.();
    await flushPromises();

    expect(apiMock.reloadProvider).toHaveBeenCalledExactlyOnceWith("hass");
    expect(toastMock.success).toHaveBeenCalledWith(
      "settings.provider_reloading",
    );
  });

  it("opens the documentation", async () => {
    await mountPage();

    menuItem("settings.documentation").action?.();

    expect(openLinkInNewTab).toHaveBeenCalledExactlyOnceWith(HASS_DOCS);
  });

  it("removes the connection once that is confirmed", async () => {
    await mountPage();

    menuItem("settings.remove_provider").action?.();
    const [event, request] = eventbusMock.emit.mock.calls[0] as [
      string,
      DeleteConfirmationDialogEvent,
    ];
    expect(event).toBe("deleteConfirmationDialog");
    expect(apiMock.removeProviderConfig).not.toHaveBeenCalled();

    await request.onConfirm();

    expect(apiMock.removeProviderConfig).toHaveBeenCalledExactlyOnceWith(
      "hass",
    );
    expect(toastMock.success).toHaveBeenCalledWith("settings.provider_removed");
  });

  it("is empty while Home Assistant is not set up", async () => {
    configs = {};

    await mountPage();

    expect(useSettingsPageMenu().value).toEqual([]);
  });

  it("is emptied when the page closes", async () => {
    const wrapper = await mountPage();

    wrapper.unmount();

    expect(useSettingsPageMenu().value).toEqual([]);
  });
});

describe("HomeAssistantSettings while the connection is disabled", () => {
  beforeEach(() => {
    configs.hass = [{ ...hassConfig(ProviderStatus.DISABLED), enabled: false }];
  });

  it("enables it on the spot", async () => {
    const wrapper = await mountPage();

    const connection = row(wrapper, "connection");
    expect(stateOf(connection)).toBe("settings.home_assistant.state_disabled");
    const enable = connection.get(CONNECTION_ACTION);
    expect(enable.text()).toBe("settings.enable");

    await enable.trigger("click");
    await flushPromises();

    expect(apiMock.saveProviderConfig).toHaveBeenCalledExactlyOnceWith(
      "hass",
      { enabled: true },
      "hass",
    );
    expect(toastMock.success).toHaveBeenCalledWith("settings.provider_saved");
  });

  it("offers to enable it in the menu as well", async () => {
    await mountPage();

    expect(visibleMenuLabels()[0]).toBe("settings.enable");
  });
});

describe("HomeAssistantSettings while the connection needs attention", () => {
  beforeEach(() => {
    configs.hass = [hassConfig(ProviderStatus.AUTH_REQUIRED)];
  });

  it("says why, and offers to reconfigure it", async () => {
    const wrapper = await mountPage();

    const connection = row(wrapper, "connection");
    expect(stateOf(connection)).toBe(
      "settings.home_assistant.state_needs_attention",
    );
    expect(
      connection.get('[data-testid="home-assistant-description"]').text(),
    ).toBe("The token expired");
    expect(
      connection.get('[data-testid="home-assistant-description"]').classes(),
    ).toContain("text-destructive");
    expect(connection.get(CONNECTION_ACTION).text()).toBe(
      "settings.reconfigure",
    );
  });

  it("leaves out what only a live connection has", async () => {
    const wrapper = await mountPage();

    expect(rowKeys(wrapper)).toEqual([
      "connection",
      "players",
      "remote_access",
    ]);
    expect(wrapper.find('[data-testid="settings-page-form"]').exists()).toBe(
      false,
    );
  });

  it("offers no provider of players to add", async () => {
    configs.hass_players = [];

    const wrapper = await mountPage();

    expect(rowKeys(wrapper)).not.toContain("players");
  });
});

describe("HomeAssistantSettings while loading", () => {
  it("reserves the room for the page", async () => {
    apiMock.getProviderConfigs.mockReturnValue(new Promise(() => {}));

    const wrapper = mount(HomeAssistantSettings, { global: { stubs: STUBS } });

    expect(wrapper.find(".min-h-24").exists()).toBe(true);
    expect(rowKeys(wrapper)).toEqual([]);
  });

  it("says so when the connection could not be loaded", async () => {
    apiMock.getProviderConfigs.mockRejectedValue(new Error("offline"));

    const wrapper = await mountPage();

    expect(wrapper.text()).toContain("settings.settings_load_failed");
    expect(
      wrapper.find('[data-testid="home-assistant-not-connected"]').exists(),
    ).toBe(false);
  });
});

const STUBS = {
  SettingsPageForm: settingsPageFormStub,
  ProviderSettingsDialog: providerSettingsDialogStub,
  RouterLink: RouterLinkStub,
};

async function mountPage() {
  const wrapper = mount(HomeAssistantSettings, { global: { stubs: STUBS } });
  await flushPromises();
  return wrapper;
}

type Wrapper = Awaited<ReturnType<typeof mountPage>>;

const ROW_PREFIX = "home-assistant-link-";
const CONNECTION_ACTION = '[data-testid="home-assistant-connection-action"]';
const SIGN_IN_SWITCH = '[data-testid="home-assistant-sign-in-switch"]';
const REMOTE_SWITCH = '[data-testid="home-assistant-remote-access-switch"]';
const REMOTE_DETAILS = '[data-testid="home-assistant-remote-access-details"]';
const SELF_REGISTRATION = "auth_allow_self_registration";
const HASS_DOCS = "https://music-assistant.io/ha-plugin/";

// lets the debounced reload after a provider event run
async function providersUpdated() {
  vi.useFakeTimers();
  try {
    const [, onProvidersUpdated] = apiMock.subscribe.mock.calls[0];
    onProvidersUpdated();
    await vi.runAllTimersAsync();
  } finally {
    vi.useRealTimers();
  }
  await flushPromises();
}

function playersDialog(wrapper: Wrapper) {
  return wrapper.getComponent(providerSettingsDialogStub);
}

function visibleMenuLabels() {
  return useSettingsPageMenu()
    .value.filter((item) => !item.hide)
    .map((item) => item.label);
}

function menuItem(label: string) {
  const found = useSettingsPageMenu().value.find(
    (item) => item.label === label,
  );
  if (!found) throw new Error(`no menu item ${label}`);
  return found;
}

function rowKeys(wrapper: Wrapper) {
  return wrapper
    .findAll(`[data-testid^="${ROW_PREFIX}"]`)
    .map((found) => found.attributes("data-testid")!.slice(ROW_PREFIX.length));
}

function row(wrapper: Wrapper, key: string) {
  return wrapper.get(`[data-testid="${ROW_PREFIX}${key}"]`);
}

function linkOf(found: ReturnType<typeof row>) {
  return JSON.parse(found.attributes("href")!);
}

function stateOf(found: ReturnType<typeof row>) {
  return found.get('[data-testid="home-assistant-state"]').text();
}

function engine(uid: string, kind: AIEngineKind, provider: string): AIEngine {
  return { uid, name: uid, kind, provider };
}

function hassConfig(status: ProviderStatus): ProviderConfig {
  return providerConfig({
    domain: "hass",
    instance_id: "hass",
    type: ProviderType.PLUGIN,
    status,
    last_error:
      status === ProviderStatus.LOADED
        ? null
        : { error_code: 1, message: "The token expired" },
  });
}

function playersConfig(status: ProviderStatus): ProviderConfig {
  return providerConfig({
    domain: "hass_players",
    instance_id: "hass_players",
    type: ProviderType.PLAYER,
    status,
  });
}

function webserverConfig(selfRegistration: boolean): CoreConfig {
  const entry: ConfigEntry = {
    key: SELF_REGISTRATION,
    category: "account_access",
    type: ConfigEntryType.BOOLEAN,
    label: SELF_REGISTRATION,
    default_value: true,
    required: false,
    options: [],
    value: selfRegistration,
  };
  return {
    domain: "webserver",
    last_error: null,
    values: { [SELF_REGISTRATION]: entry },
  };
}

function remoteAccess(
  enabled: boolean,
  usingHaCloud: boolean,
): RemoteAccessInfo {
  return {
    enabled,
    running: enabled,
    connected: enabled,
    remote_id: "MA-TEST",
    using_ha_cloud: usingHaCloud,
    signaling_url: "wss://signaling.example",
  };
}
