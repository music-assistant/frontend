import type { MusicAssistantApi } from "@/plugins/api";
import { coreOwner } from "@/helpers/settings_pages";
import {
  ConfigEntryType,
  ProviderStatus,
  ProviderType,
  Scope,
  type ConfigEntry,
  type CoreConfig,
  type ProviderConfig,
} from "@/plugins/api/interfaces";
import { flushPromises } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { providerConfig } from "../../../tests/fixtures/providerConfig";
import { useSettingsPage } from "./useSettingsPage";

const { apiMock, hasScope, toastMock } = vi.hoisted(() => ({
  apiMock: {
    getCoreConfig: vi.fn<MusicAssistantApi["getCoreConfig"]>(),
    invokeCoreConfigAction:
      vi.fn<MusicAssistantApi["invokeCoreConfigAction"]>(),
    saveCoreConfig: vi.fn<MusicAssistantApi["saveCoreConfig"]>(),
    getProviderConfig: vi.fn<MusicAssistantApi["getProviderConfig"]>(),
    getProviderConfigs: vi.fn<MusicAssistantApi["getProviderConfigs"]>(),
    invokeProviderConfigAction:
      vi.fn<MusicAssistantApi["invokeProviderConfigAction"]>(),
    saveProviderConfig: vi.fn<MusicAssistantApi["saveProviderConfig"]>(),
    getCoreConfigs: vi.fn<MusicAssistantApi["getCoreConfigs"]>(),
    providerManifests: {} as Record<string, { name: string }>,
  },
  hasScope: vi.fn<(scope: Scope) => boolean>(),
  toastMock: { error: vi.fn(), success: vi.fn() },
}));

vi.mock("@/plugins/api", () => ({ api: apiMock, default: apiMock }));
vi.mock("@/plugins/auth", () => ({ authManager: { hasScope } }));
// a text with arguments shows them, so a test can tell what it names
vi.mock("@/plugins/i18n", () => ({
  $t: (key: string, args?: unknown[]) =>
    args ? `${key}:${args.join("|")}` : key,
}));
vi.mock("vue-sonner", () => ({ toast: toastMock }));

// the save names the owner of a failed save in a toast of its own
const QUIET_SAVE = { suppressGlobalError: true };

beforeEach(() => {
  vi.clearAllMocks();
  hasScope.mockReturnValue(true);
  apiMock.getCoreConfig.mockResolvedValue(streamsConfig());
  apiMock.saveCoreConfig.mockImplementation(async (domain, values) =>
    streamsConfig(values),
  );
});

describe("useSettingsPage", () => {
  it("loads nothing for a user who may not change the settings", async () => {
    hasScope.mockImplementation((scope) => scope !== Scope.CONFIG_CORE_WRITE);

    const page = useSettingsPage("audio_analysis");
    await flushPromises();

    expect(page.canEdit).toBe(false);
    expect(apiMock.getCoreConfig).not.toHaveBeenCalled();
    expect(page.loaded.value).toBe(false);
  });

  it("shows only the settings the page claims", async () => {
    const page = useSettingsPage("audio_analysis");
    await flushPromises();

    expect(apiMock.getCoreConfig).toHaveBeenCalledWith("streams");
    expect(page.loaded.value).toBe(true);
    expect(page.entries.value.map((entry) => entry.key)).toEqual([
      "background_scan_concurrency",
      "smart_fades_log_level",
    ]);
  });

  it("reports a failed load without a toast of its own", async () => {
    apiMock.getCoreConfig.mockRejectedValueOnce(new Error("offline"));

    const page = useSettingsPage("audio_analysis");
    await flushPromises();

    expect(page.loadFailed.value).toBe(true);
    expect(page.loaded.value).toBe(false);
    expect(toastMock.error).not.toHaveBeenCalled();
  });

  it("saves only what changed, to the owner of the settings", async () => {
    const page = useSettingsPage("audio_analysis");
    await flushPromises();

    await expect(
      page.save({
        background_scan_concurrency: 4,
        smart_fades_log_level: "GLOBAL",
      }),
    ).resolves.toMatchObject({ complete: true });

    expect(apiMock.saveCoreConfig).toHaveBeenCalledExactlyOnceWith(
      "streams",
      {
        background_scan_concurrency: 4,
      },
      QUIET_SAVE,
    );
  });

  it("takes what the server stored as saved", async () => {
    const page = useSettingsPage("audio_analysis");
    await flushPromises();
    await page.save({ background_scan_concurrency: 4 });

    await expect(
      page.save({ background_scan_concurrency: 4 }),
    ).resolves.toMatchObject({ complete: true });

    expect(apiMock.saveCoreConfig).toHaveBeenCalledOnce();
  });

  it("sends a reset to the default", async () => {
    const page = useSettingsPage("audio_analysis");
    await flushPromises();

    await page.save({ background_scan_concurrency: null });

    expect(apiMock.saveCoreConfig).toHaveBeenCalledWith(
      "streams",
      {
        background_scan_concurrency: null,
      },
      QUIET_SAVE,
    );
  });

  it("makes no call when nothing changed", async () => {
    const page = useSettingsPage("audio_analysis");
    await flushPromises();

    await expect(
      page.save({ background_scan_concurrency: 2, bind_port: 1234 }),
    ).resolves.toMatchObject({ complete: true });

    expect(apiMock.saveCoreConfig).not.toHaveBeenCalled();
  });

  it("reports a save that did not land", async () => {
    apiMock.saveCoreConfig.mockRejectedValueOnce(new Error("refused"));
    const page = useSettingsPage("audio_analysis");
    await flushPromises();

    await expect(
      page.save({ background_scan_concurrency: 4 }),
    ).resolves.toEqual({ stored: {}, complete: false });
    expect(page.busy.value).toBe(false);
    expect(toastMock.error).toHaveBeenCalledExactlyOnceWith(
      "settings.settings_save_failed_for:streams",
      { description: "refused" },
    );
  });

  it("runs an action on the owner of its entry and shows what it returns", async () => {
    const config = streamsConfig();
    config.values.background_scan_concurrency.action = "suggest_concurrency";
    apiMock.getCoreConfig.mockResolvedValueOnce(config);
    apiMock.invokeCoreConfigAction.mockResolvedValueOnce(
      Object.values(
        streamsConfig({ background_scan_concurrency: 8 }).values,
      ).map((entry) =>
        entry.key === "background_scan_concurrency"
          ? { ...entry, action: "suggest_concurrency" }
          : entry,
      ),
    );
    const page = useSettingsPage("audio_analysis");
    await flushPromises();

    await page.onAction("suggest_concurrency", {}, false);

    expect(apiMock.invokeCoreConfigAction).toHaveBeenCalledWith(
      "streams",
      "suggest_concurrency",
    );
    expect(page.entries.value.map((entry) => entry.key)).toEqual([
      "background_scan_concurrency",
      "smart_fades_log_level",
    ]);
    expect(page.entries.value[0].value).toBe(8);
    expect(apiMock.saveCoreConfig).not.toHaveBeenCalled();
  });
});

describe("useSettingsPage on a page with several owners", () => {
  beforeEach(() => {
    apiMock.getCoreConfig.mockImplementation(async (domain) =>
      networkConfig(domain),
    );
    apiMock.saveCoreConfig.mockImplementation(async (domain, values) =>
      networkConfig(domain, values),
    );
  });

  it("shows the settings of each owner, keyed by their owner, without their log levels", async () => {
    const page = useSettingsPage("network");
    await flushPromises();

    expect(page.entries.value.map((entry) => entry.key)).toEqual([
      "core/webserver/bind_port",
      "core/webserver/enable_ssl",
      "core/webserver/verify_ssl",
      "core/streams/bind_port",
      "core/discovery/upnp_network_scan",
    ]);
  });

  it("saves each owner its own changes, keyed the way it knows them", async () => {
    const page = useSettingsPage("network");
    await flushPromises();

    await expect(
      page.save({
        "core/webserver/bind_port": 8096,
        "core/streams/bind_port": 8098,
        "core/discovery/upnp_network_scan": false,
      }),
    ).resolves.toMatchObject({ complete: true });

    expect(apiMock.saveCoreConfig).toHaveBeenCalledTimes(2);
    expect(apiMock.saveCoreConfig).toHaveBeenCalledWith(
      "webserver",
      {
        bind_port: 8096,
      },
      QUIET_SAVE,
    );
    expect(apiMock.saveCoreConfig).toHaveBeenCalledWith(
      "streams",
      {
        bind_port: 8098,
      },
      QUIET_SAVE,
    );
  });

  it("sends a change again only to the owner that did not store it", async () => {
    apiMock.saveCoreConfig.mockImplementation(async (domain, values) => {
      if (domain === "streams") throw new Error("refused");
      return networkConfig(domain, values);
    });
    const page = useSettingsPage("network");
    await flushPromises();
    const values = {
      "core/webserver/bind_port": 8096,
      "core/streams/bind_port": 8098,
    };

    // what the other owner stored is reported as stored
    await expect(page.save(values)).resolves.toEqual({
      stored: { "core/webserver/bind_port": 8096 },
      complete: false,
    });
    apiMock.saveCoreConfig.mockClear();
    await page.save(values);

    expect(apiMock.saveCoreConfig).toHaveBeenCalledExactlyOnceWith(
      "streams",
      {
        bind_port: 8098,
      },
      QUIET_SAVE,
    );
  });

  it("runs an action on the owner of its entry, by the name it knows", async () => {
    apiMock.invokeCoreConfigAction.mockResolvedValueOnce({
      message: "Certificate is valid",
      open_url: null,
    });
    const page = useSettingsPage("network");
    await flushPromises();

    await page.onAction("core/webserver/verify_ssl", {}, false);

    expect(apiMock.invokeCoreConfigAction).toHaveBeenCalledExactlyOnceWith(
      "webserver",
      "verify_ssl",
    );
  });

  it("keeps what was typed when an action shows new entries", async () => {
    apiMock.invokeCoreConfigAction.mockResolvedValueOnce(
      Object.values(networkConfig("webserver").values).map((entry) => ({
        ...entry,
        value: entry.key === "enable_ssl" ? true : undefined,
      })),
    );
    const page = useSettingsPage("network");
    await flushPromises();

    await page.onAction(
      "core/webserver/verify_ssl",
      { "core/webserver/bind_port": 9000, "core/streams/bind_port": 9001 },
      false,
    );

    expect(valueOf(page, "core/webserver/bind_port")).toBe(9000);
    expect(valueOf(page, "core/webserver/enable_ssl")).toBe(true);
    expect(valueOf(page, "core/streams/bind_port")).toBe(9001);
  });

  it("finds the entry of a setting of an owner", async () => {
    const page = useSettingsPage("network");
    await flushPromises();

    expect(page.entryOf(coreOwner("streams"), "bind_port")?.key).toBe(
      "core/streams/bind_port",
    );
    expect(page.entryOf(coreOwner("streams"), "fade_in")).toBeUndefined();
  });
});

describe("useSettingsPage on the diagnostics page", () => {
  beforeEach(() => {
    apiMock.providerManifests = { cache: { name: "Cache" } };
    apiMock.getCoreConfig.mockImplementation(async (domain) =>
      moduleConfig(domain),
    );
    apiMock.getCoreConfigs.mockImplementation(async () =>
      ["streams", "cache", "statistics"].map((domain) => moduleConfig(domain)),
    );
    apiMock.saveCoreConfig.mockImplementation(async (domain, values) =>
      moduleConfig(domain, values),
    );
  });

  it("leads with the log level of every module, by name and always in view", async () => {
    const page = useSettingsPage("diagnostics");
    await flushPromises();

    // the configs carry their entries only on request
    expect(apiMock.getCoreConfigs).toHaveBeenCalledExactlyOnceWith(true);
    expect(
      page.entries.value.map(({ key, label, advanced, category }) => ({
        key,
        label,
        advanced,
        category,
      })),
    ).toEqual([
      {
        key: "core/cache/log_level",
        label: "Cache",
        advanced: false,
        category: "log_levels",
      },
      {
        key: "core/statistics/log_level",
        label: "statistics",
        advanced: false,
        category: "log_levels",
      },
      {
        key: "core/streams/log_level",
        label: "streams",
        advanced: false,
        category: "log_levels",
      },
      {
        key: "core/cache/clear_cache",
        label: "clear_cache",
        advanced: undefined,
        category: "core/cache",
      },
      {
        key: "core/cache/expire_after",
        label: "expire_after",
        advanced: undefined,
        category: "core/cache",
      },
    ]);
  });

  it("saves the log levels with the other settings, one call per module", async () => {
    const page = useSettingsPage("diagnostics");
    await flushPromises();

    await expect(
      page.save({
        "core/streams/log_level": "DEBUG",
        "core/cache/log_level": "INFO",
        "core/cache/expire_after": 60,
        "core/statistics/log_level": "GLOBAL",
      }),
    ).resolves.toMatchObject({ complete: true });

    expect(apiMock.saveCoreConfig).toHaveBeenCalledTimes(2);
    expect(apiMock.saveCoreConfig).toHaveBeenCalledWith(
      "streams",
      { log_level: "DEBUG" },
      QUIET_SAVE,
    );
    expect(apiMock.saveCoreConfig).toHaveBeenCalledWith(
      "cache",
      { log_level: "INFO", expire_after: 60 },
      QUIET_SAVE,
    );
  });

  it("names the modules that did not store their changes, and keeps them unsaved", async () => {
    apiMock.saveCoreConfig.mockImplementation(async (domain, values) => {
      if (domain !== "statistics") throw new Error(`${domain} refused`);
      return moduleConfig(domain, values);
    });
    const page = useSettingsPage("diagnostics");
    await flushPromises();
    const values = {
      "core/streams/log_level": "DEBUG",
      "core/cache/expire_after": 60,
      "core/statistics/log_level": "ERROR",
    };

    await expect(page.save(values)).resolves.toEqual({
      stored: { "core/statistics/log_level": "ERROR" },
      complete: false,
    });
    // one toast for the whole save, the reason of each module in it
    expect(toastMock.error).toHaveBeenCalledExactlyOnceWith(
      "settings.settings_save_failed_for:streams, Cache",
      { description: "streams refused; cache refused" },
    );

    apiMock.saveCoreConfig.mockClear();
    await page.save(values);
    expect(apiMock.saveCoreConfig).not.toHaveBeenCalledWith(
      "statistics",
      expect.anything(),
      expect.anything(),
    );
  });

  it("keeps a log level that was typed when an action shows new entries", async () => {
    // an action answers with the entries without their values
    apiMock.invokeCoreConfigAction.mockResolvedValueOnce(
      Object.values(moduleConfig("cache").values).map((entry) => ({
        ...entry,
        value: undefined,
      })),
    );
    const page = useSettingsPage("diagnostics");
    await flushPromises();

    await page.onAction(
      "core/cache/clear_cache",
      { "core/cache/log_level": "DEBUG", "core/streams/log_level": "ERROR" },
      false,
    );

    expect(valueOf(page, "core/cache/log_level")).toBe("DEBUG");
    expect(valueOf(page, "core/streams/log_level")).toBe("ERROR");
  });

  it("loads nothing for a user who may not change the core settings", async () => {
    hasScope.mockImplementation((scope) => scope !== Scope.CONFIG_CORE_WRITE);

    const page = useSettingsPage("diagnostics");
    await flushPromises();

    expect(page.canEdit).toBe(false);
    expect(apiMock.getCoreConfigs).not.toHaveBeenCalled();
  });
});

describe("useSettingsPage on the pages of the queue settings", () => {
  beforeEach(() => {
    apiMock.getCoreConfig.mockImplementation(async (domain) =>
      queuePagesConfig(domain),
    );
  });

  it("shows what clicking or playing an item does on Tap & play, in the order of the server", async () => {
    const page = useSettingsPage("tap_and_play");
    await flushPromises();

    expect(apiMock.getCoreConfig).toHaveBeenCalledExactlyOnceWith(
      "player_queues",
    );
    expect(page.entries.value.map((entry) => entry.key)).toEqual([
      "default_enqueue_select_artist",
      "default_enqueue_option_album",
      "default_click_action_album",
      "default_play_action_album_track",
    ]);
  });

  it("shows every other queue setting with the playback defaults, also of a category the server adds", async () => {
    const page = useSettingsPage("playback");
    await flushPromises();

    expect(page.entries.value.map((entry) => entry.key)).toEqual([
      "core/player_queues/smart_shuffle_enabled",
      "core/player_queues/autoplay_mode",
      "core/player_queues/crossfade_mode",
      "core/player_queues/volume_normalization",
      "core/player_queues/pause_timeout",
      "core/player_queues/radio_mode",
      "core/streams/buffer_size",
      "core/players/volume_step",
    ]);
  });
});

describe("useSettingsPage on the page of a provider", () => {
  beforeEach(() => {
    // the list of provider configs comes without their entries
    apiMock.getProviderConfigs.mockResolvedValue([
      { ...hassConfig(), values: {} },
    ]);
    apiMock.getProviderConfig.mockResolvedValue(hassConfig());
    apiMock.saveProviderConfig.mockImplementation(async (domain, values) =>
      hassConfig(values),
    );
  });

  it("loads nothing for a user who may not change provider settings", async () => {
    hasScope.mockImplementation(
      (scope) => scope !== Scope.CONFIG_PROVIDERS_WRITE,
    );

    const page = useSettingsPage("home_assistant");
    await flushPromises();

    expect(page.canEdit).toBe(false);
    expect(apiMock.getProviderConfigs).not.toHaveBeenCalled();
  });

  it("shows the settings of the instance of the provider, keyed as the provider knows them", async () => {
    const page = useSettingsPage("home_assistant");
    await flushPromises();

    expect(apiMock.getProviderConfigs).toHaveBeenCalledExactlyOnceWith(
      undefined,
      "hass",
    );
    expect(page.loaded.value).toBe(true);
    expect(page.entries.value.map((entry) => entry.key)).toEqual([
      "power_controls",
      "volume_controls",
    ]);
  });

  it("shows nothing while the provider is not set up", async () => {
    apiMock.getProviderConfigs.mockResolvedValueOnce([]);

    const page = useSettingsPage("home_assistant");
    await flushPromises();

    expect(page.loaded.value).toBe(true);
    expect(page.entries.value).toEqual([]);
  });

  it("saves only what changed, to the instance of the provider", async () => {
    const page = useSettingsPage("home_assistant");
    await flushPromises();

    await expect(
      page.save({
        power_controls: ["switch.amplifier"],
        volume_controls: [],
      }),
    ).resolves.toMatchObject({ complete: true });

    expect(apiMock.saveProviderConfig).toHaveBeenCalledExactlyOnceWith(
      "hass",
      { power_controls: ["switch.amplifier"] },
      "hass--1",
      QUIET_SAVE,
    );
  });

  it("runs an action on the instance of the provider", async () => {
    const config = hassConfig();
    config.values.power_controls.action = "refresh_entities";
    apiMock.getProviderConfig.mockResolvedValueOnce(config);
    apiMock.invokeProviderConfigAction.mockResolvedValueOnce({
      message: "Refreshed",
      open_url: null,
    });
    const page = useSettingsPage("home_assistant");
    await flushPromises();

    await page.onAction("refresh_entities", {}, false);

    expect(apiMock.invokeProviderConfigAction).toHaveBeenCalledExactlyOnceWith(
      "hass--1",
      "refresh_entities",
    );
    expect(apiMock.invokeCoreConfigAction).not.toHaveBeenCalled();
  });
});

function valueOf(page: ReturnType<typeof useSettingsPage>, key: string) {
  return page.entries.value.find((entry) => entry.key === key)?.value;
}

function entry(
  key: string,
  category: string,
  value: ConfigEntry["value"],
): ConfigEntry {
  return {
    key,
    category,
    type: ConfigEntryType.INTEGER,
    label: key,
    default_value: null,
    required: false,
    options: [],
    value,
  };
}

function streamsConfig(
  overrides: Record<string, ConfigEntry["value"]> = {},
): CoreConfig {
  const values: Record<string, ConfigEntry["value"]> = {
    bind_port: 8097,
    background_scan_concurrency: 2,
    smart_fades_log_level: "GLOBAL",
    ...overrides,
  };
  return {
    domain: "streams",
    last_error: null,
    values: {
      bind_port: entry("bind_port", "generic", values.bind_port),
      background_scan_concurrency: entry(
        "background_scan_concurrency",
        "audio_analysis",
        values.background_scan_concurrency,
      ),
      smart_fades_log_level: entry(
        "smart_fades_log_level",
        "audio_analysis",
        values.smart_fades_log_level,
      ),
    },
  };
}

// the network settings of each controller, with more in them than the page shows
function networkConfig(
  domain: string,
  overrides: Record<string, ConfigEntry["value"]> = {},
): CoreConfig {
  const entries: Record<string, ConfigEntry[]> = {
    webserver: [
      entry("bind_port", "generic", 8095),
      entry("enable_ssl", "generic", false),
      {
        ...entry("verify_ssl", "generic", null),
        type: ConfigEntryType.ACTION,
        action: "verify_ssl",
        depends_on: "enable_ssl",
      },
      entry("log_level", "generic", "GLOBAL"),
    ],
    streams: [
      entry("bind_port", "generic", 8097),
      entry("fade_in", "playback", 1),
      entry("log_level", "generic", "GLOBAL"),
    ],
    discovery: [
      entry("upnp_network_scan", "generic", false),
      entry("log_level", "generic", "GLOBAL"),
    ],
  };
  return {
    domain,
    last_error: null,
    values: Object.fromEntries(
      entries[domain].map((e) => [
        e.key,
        e.key in overrides ? { ...e, value: overrides[e.key] } : e,
      ]),
    ),
  };
}

// a core module as the server sends it: its log level, and the settings of the
// cache module, with a setting holding a value next to its action
function moduleConfig(
  domain: string,
  overrides: Record<string, ConfigEntry["value"]> = {},
): CoreConfig {
  const entries: ConfigEntry[] = [
    {
      ...entry("log_level", "generic", "GLOBAL"),
      type: ConfigEntryType.STRING,
      default_value: "GLOBAL",
      advanced: true,
    },
  ];
  if (domain === "cache") {
    entries.unshift(
      {
        ...entry("clear_cache", "generic", null),
        type: ConfigEntryType.ACTION,
      },
      entry("expire_after", "generic", 30),
    );
  }
  return {
    domain,
    last_error: null,
    values: Object.fromEntries(
      entries.map((e) => [
        e.key,
        e.key in overrides ? { ...e, value: overrides[e.key] } : e,
      ]),
    ),
  };
}

// the modules of the playback defaults and Tap & play, the queue settings with
// an entry of each category the server has and of one it may add
function queuePagesConfig(domain: string): CoreConfig {
  const entries: Record<string, ConfigEntry[]> = {
    player_queues: [
      entry("default_enqueue_select_artist", "items_to_select", "top_tracks"),
      entry("default_enqueue_option_album", "default_enqueue_option", "play"),
      entry("default_click_action_album", "click_actions", "browse"),
      entry("default_play_action_album_track", "click_actions", "play_track"),
      entry("smart_shuffle_enabled", "smart_shuffle", "disabled"),
      entry("autoplay_mode", "autoplay", "auto"),
      entry("crossfade_mode", "crossfade", "smart_crossfade"),
      entry("volume_normalization", "volume_normalization", "enabled"),
      entry("pause_timeout", "playback", 30),
      entry("radio_mode", "radio", "off"),
      entry("log_level", "generic", "GLOBAL"),
    ],
    streams: [
      entry("buffer_size", "playback", "auto"),
      entry("stream_source_mode", "source_selection", "best_quality"),
    ],
    players: [entry("volume_step", "generic", 0)],
  };
  return {
    domain,
    last_error: null,
    values: Object.fromEntries(entries[domain].map((e) => [e.key, e])),
  };
}

// the Home Assistant provider, with an entry outside the player controls
function hassConfig(
  overrides: Record<string, ConfigEntry["value"]> = {},
): ProviderConfig {
  const values: Record<string, ConfigEntry["value"]> = {
    power_controls: [],
    volume_controls: [],
    ...overrides,
  };
  return providerConfig({
    domain: "hass",
    type: ProviderType.PLUGIN,
    status: ProviderStatus.LOADED,
    values: {
      power_controls: {
        ...entry("power_controls", "player_controls", values.power_controls),
        type: ConfigEntryType.STRING,
        multi_value: true,
      },
      volume_controls: {
        ...entry("volume_controls", "player_controls", values.volume_controls),
        type: ConfigEntryType.STRING,
        multi_value: true,
      },
      url: entry("url", "generic", "http://supervisor/core/api"),
    },
  });
}
