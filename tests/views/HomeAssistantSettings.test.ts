import SettingsPageHeader from "@/components/settings/SettingsPageHeader.vue";
import type { MusicAssistantApi } from "@/plugins/api";
import {
  type AIEngine,
  AIEngineKind,
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
import HomeAssistantSettings from "@/views/settings/HomeAssistantSettings.vue";
import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ref } from "vue";
import { providerConfig } from "../fixtures/providerConfig";
import { providerManifest } from "../fixtures/providerManifest";

const { apiMock, hasScope, startAddProvider } = vi.hoisted(() => ({
  apiMock: {
    getAIEngines: vi.fn<MusicAssistantApi["getAIEngines"]>(),
    getAIUsage: vi.fn<MusicAssistantApi["getAIUsage"]>(),
    getProviderConfigs: vi.fn<MusicAssistantApi["getProviderConfigs"]>(),
    getRemoteAccessInfo: vi.fn<MusicAssistantApi["getRemoteAccessInfo"]>(),
    subscribe: vi.fn(),
    players: {} as Record<string, Pick<Player, "provider">>,
    providerManifests: {} as Record<string, ProviderManifest>,
    serverInfo: undefined as unknown as { value: ServerInfoMessage },
  },
  hasScope: vi.fn<(scope: Scope) => boolean>(),
  startAddProvider: vi.fn(),
}));

vi.mock("@/plugins/api", () => ({ api: apiMock, default: apiMock }));
vi.mock("@/plugins/auth", () => ({ authManager: { hasScope } }));
// the key, with the count it is given in brackets
vi.mock("@/plugins/i18n", () => ({
  $t: (key: string, count?: unknown) =>
    typeof count === "number" ? `${key}(${count})` : key,
}));
vi.mock("@/helpers/provider_add", () => ({ startAddProvider }));

enableAutoUnmount(afterEach);

// the form is covered where it lives
const settingsPageFormStub = {
  name: "SettingsPageForm",
  props: { page: String },
  template: "<div data-testid='settings-page-form' />",
};
const RouterLinkStub = {
  props: ["to"],
  template: '<a :href="JSON.stringify(to)"><slot /></a>',
};

// what the server has set up, by domain
let configs: Record<string, ProviderConfig[]>;

beforeEach(() => {
  vi.clearAllMocks();
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
  apiMock.subscribe.mockReturnValue(vi.fn());
  apiMock.players = {
    kitchen: { provider: "hass_players" },
    living: { provider: "hass_players" },
    garden: { provider: "sonos--1" },
  };
  apiMock.providerManifests = {
    hass: providerManifest({ domain: "hass", type: ProviderType.PLUGIN }),
    hass_players: providerManifest({
      domain: "hass_players",
      type: ProviderType.PLAYER,
      depends_on: "hass",
    }),
  };
  apiMock.serverInfo = ref({
    homeassistant_addon: false,
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

    expect(startAddProvider).toHaveBeenCalledExactlyOnceWith(
      apiMock.providerManifests.hass,
    );
  });
});

describe("HomeAssistantSettings while Home Assistant is connected", () => {
  it("leads to the provider page that manages the connection", async () => {
    const wrapper = await mountPage();

    expect(rowKeys(wrapper)).toEqual([
      "connection",
      "players",
      "ai",
      "sign_in",
      "remote_access",
    ]);
    const connection = row(wrapper, "connection");
    expect(linkOf(connection)).toEqual({
      name: "editprovider",
      params: { instanceId: "hass" },
    });
    expect(stateOf(connection)).toBe("settings.home_assistant.state_connected");
    expect(connection.text()).toContain(
      "settings.home_assistant.connection_description",
    );
    expect(
      wrapper.find('[data-testid="home-assistant-not-connected"]').exists(),
    ).toBe(false);
  });

  it("leads to the provider of its players, with how many it has", async () => {
    const wrapper = await mountPage();

    const players = row(wrapper, "players");
    expect(linkOf(players)).toEqual({
      name: "editprovider",
      params: { instanceId: "hass_players" },
    });
    expect(stateOf(players)).toBe("2");
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
    );
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

  it("leads to signing in with Home Assistant and to remote access through its cloud", async () => {
    const wrapper = await mountPage();

    expect(linkOf(row(wrapper, "sign_in"))).toEqual({ name: "usersettings" });
    const remote = row(wrapper, "remote_access");
    expect(linkOf(remote)).toEqual({ name: "remoteaccesssettings" });
    expect(stateOf(remote)).toBe(
      "settings.home_assistant.remote_access_ha_cloud",
    );
  });

  it("says when remote access runs without Home Assistant Cloud", async () => {
    apiMock.getRemoteAccessInfo.mockResolvedValue(remoteAccess(true, false));

    const wrapper = await mountPage();

    expect(stateOf(row(wrapper, "remote_access"))).toBe(
      "settings.home_assistant.remote_access_without_ha_cloud",
    );
  });

  it("shows the player controls below the rows", async () => {
    const wrapper = await mountPage();

    expect(wrapper.getComponent(settingsPageFormStub).props("page")).toBe(
      "home_assistant",
    );
  });

  it.each([
    [Scope.CONFIG_CORE_WRITE, "ai"],
    [Scope.USERS_READ, "sign_in"],
    [Scope.SYSTEM_MANAGE, "remote_access"],
  ])(
    "leaves a row out without %s, which its page needs",
    async (scope, key) => {
      hasScope.mockImplementation((granted) => granted !== scope);

      const wrapper = await mountPage();

      expect(rowKeys(wrapper)).not.toContain(key);
      expect(rowKeys(wrapper)).toHaveLength(4);
    },
  );

  it("asks nothing about remote access of a user who may not manage it", async () => {
    hasScope.mockImplementation((scope) => scope !== Scope.SYSTEM_MANAGE);

    await mountPage();

    expect(apiMock.getRemoteAccessInfo).not.toHaveBeenCalled();
  });

  it("says that the add-on connects Music Assistant", async () => {
    apiMock.serverInfo.value = {
      homeassistant_addon: true,
    } as ServerInfoMessage;

    const wrapper = await mountPage();

    expect(row(wrapper, "connection").text()).toContain(
      "settings.home_assistant.connection_addon",
    );
    expect(
      wrapper.find('[data-testid="home-assistant-connect"]').exists(),
    ).toBe(false);
  });

  it("follows the server when the providers change", async () => {
    vi.useFakeTimers();
    try {
      const wrapper = await mountPage();
      const [event, onProvidersUpdated] = apiMock.subscribe.mock.calls[0];
      expect(event).toBe(EventType.PROVIDERS_UPDATED);

      configs.hass = [hassConfig(ProviderStatus.ERROR)];
      onProvidersUpdated();
      await vi.runAllTimersAsync();
      await flushPromises();

      expect(stateOf(row(wrapper, "connection"))).toBe(
        "settings.home_assistant.state_needs_attention",
      );
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("HomeAssistantSettings while the connection needs attention", () => {
  beforeEach(() => {
    configs.hass = [hassConfig(ProviderStatus.AUTH_REQUIRED)];
  });

  it("says why, and still leads to the provider page", async () => {
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
    expect(linkOf(connection)).toEqual({
      name: "editprovider",
      params: { instanceId: "hass" },
    });
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

    const wrapper = mount(HomeAssistantSettings, {
      global: {
        stubs: {
          SettingsPageForm: settingsPageFormStub,
          RouterLink: RouterLinkStub,
        },
      },
    });

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

async function mountPage() {
  const wrapper = mount(HomeAssistantSettings, {
    global: {
      stubs: {
        SettingsPageForm: settingsPageFormStub,
        RouterLink: RouterLinkStub,
      },
    },
  });
  await flushPromises();
  return wrapper;
}

type Wrapper = Awaited<ReturnType<typeof mountPage>>;

const ROW_PREFIX = "home-assistant-link-";

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
