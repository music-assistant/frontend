import type { SettingsPageId } from "@/helpers/settings_pages";
import type { MusicAssistantApi } from "@/plugins/api";
import {
  ConfigEntryType,
  type ConfigEntry,
  type CoreConfig,
  type Scope,
} from "@/plugins/api/interfaces";
import SettingsPageFormView from "@/views/settings/SettingsPageFormView.vue";
import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { apiMock, hasScope } = vi.hoisted(() => ({
  apiMock: {
    getCoreConfig: vi.fn<MusicAssistantApi["getCoreConfig"]>(),
    invokeCoreConfigAction:
      vi.fn<MusicAssistantApi["invokeCoreConfigAction"]>(),
    saveCoreConfig: vi.fn<MusicAssistantApi["saveCoreConfig"]>(),
  },
  hasScope: vi.fn<(scope: Scope) => boolean>(),
}));

vi.mock("@/plugins/api", () => ({ api: apiMock, default: apiMock }));
vi.mock("@/plugins/auth", () => ({ authManager: { hasScope } }));
vi.mock("@/plugins/i18n", () => ({ $t: (key: string) => key }));
vi.mock("vue-sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

enableAutoUnmount(afterEach);

// the form itself is covered where it lives
const editConfigStub = {
  name: "EditConfig",
  props: { configEntries: Array, disabled: Boolean, inlineSave: Boolean },
  template: "<div />",
};

beforeEach(() => {
  vi.clearAllMocks();
  hasScope.mockReturnValue(true);
});

describe("SettingsPageFormView on the playback defaults", () => {
  it("shows the playback defaults of each module in one form, by category, without their log levels", async () => {
    apiMock.getCoreConfig.mockImplementation(async (domain) =>
      playbackConfig(domain, STREAMS_ENTRIES),
    );

    expect(await formEntries("playback")).toEqual([
      { key: "core/player_queues/crossfade_mode", category: "crossfade" },
      {
        key: "core/player_queues/volume_normalization",
        category: "volume_normalization",
      },
      { key: "core/streams/buffer_size", category: "playback" },
      {
        key: "core/streams/volume_normalization_tracks",
        category: "volume_normalization",
      },
      { key: "core/streams/allow_crossfade_same_album", category: "crossfade" },
      { key: "core/players/volume_step", category: "generic" },
      { key: "core/players/announce_tts_engine", category: "announcements" },
    ]);
  });

  it("shows the playback settings of the streams that are all in one category", async () => {
    apiMock.getCoreConfig.mockImplementation(async (domain) =>
      playbackConfig(domain, [
        entry("buffer_size", "playback"),
        entry("volume_normalization_tracks", "playback"),
        entry("allow_crossfade_same_album", "playback"),
        entry("stream_source_mode", "source_selection"),
        entry("log_level", "generic"),
      ]),
    );

    expect(
      (await formEntries("playback")).filter(({ key }) =>
        key.startsWith("core/streams"),
      ),
    ).toEqual([
      { key: "core/streams/buffer_size", category: "playback" },
      { key: "core/streams/volume_normalization_tracks", category: "playback" },
      { key: "core/streams/allow_crossfade_same_album", category: "playback" },
    ]);
  });
});

// the streams settings as the server sends them once the playback settings
// share the categories of the queue settings, with what other pages show
const STREAMS_ENTRIES: ConfigEntry[] = [
  entry("buffer_size", "playback"),
  entry("volume_normalization_tracks", "volume_normalization"),
  entry("allow_crossfade_same_album", "crossfade"),
  entry("stream_source_mode", "source_selection"),
  entry("bind_port", "generic"),
  entry("log_level", "generic"),
];

describe("SettingsPageFormView on the metadata settings", () => {
  it("shows every setting of the metadata module but its log level", async () => {
    apiMock.getCoreConfig.mockResolvedValue(
      coreConfig("metadata", [
        entry("language", "generic"),
        entry("enable_online_metadata", "generic"),
        entry("log_level", "generic"),
      ]),
    );

    expect(await formEntries("metadata")).toEqual([
      { key: "language", category: "generic" },
      { key: "enable_online_metadata", category: "generic" },
    ]);
    expect(apiMock.getCoreConfig).toHaveBeenCalledExactlyOnceWith("metadata");
  });
});

describe("SettingsPageFormView on the task settings", () => {
  it("shows every setting of the tasks module but its log level", async () => {
    apiMock.getCoreConfig.mockResolvedValue(
      coreConfig("tasks", [
        entry("max_concurrent_tasks", "generic"),
        entry("log_level", "generic"),
      ]),
    );

    expect(await formEntries("task_settings")).toEqual([
      { key: "max_concurrent_tasks", category: "generic" },
    ]);
    expect(apiMock.getCoreConfig).toHaveBeenCalledExactlyOnceWith("tasks");
  });
});

describe("SettingsPageFormView", () => {
  it("loads the form of the page the route hands it", async () => {
    apiMock.getCoreConfig.mockImplementation(async (domain) =>
      domain === "metadata"
        ? coreConfig("metadata", [entry("language", "generic")])
        : playbackConfig(domain, STREAMS_ENTRIES),
    );
    const wrapper = mount(SettingsPageFormView, {
      props: { page: "playback" },
      global: { stubs: { EditConfig: editConfigStub } },
    });
    await flushPromises();

    await wrapper.setProps({ page: "metadata" });
    await flushPromises();

    expect(
      (
        wrapper
          .getComponent(editConfigStub)
          .props("configEntries") as ConfigEntry[]
      ).map(({ key }) => key),
    ).toEqual(["language"]);
  });
});

/** The key and category of each entry the form of a page gets. */
async function formEntries(page: SettingsPageId) {
  const wrapper = mount(SettingsPageFormView, {
    props: { page },
    global: { stubs: { EditConfig: editConfigStub } },
  });
  await flushPromises();
  return (
    wrapper.getComponent(editConfigStub).props("configEntries") as ConfigEntry[]
  ).map(({ key, category }) => ({ key, category }));
}

function entry(key: string, category: string): ConfigEntry {
  return {
    key,
    category,
    type: ConfigEntryType.STRING,
    label: key,
    default_value: null,
    required: false,
    options: [],
  };
}

function playbackConfig(domain: string, streams: ConfigEntry[]): CoreConfig {
  const values: Record<string, ConfigEntry[]> = {
    player_queues: [
      entry("crossfade_mode", "crossfade"),
      entry("volume_normalization", "volume_normalization"),
      entry("log_level", "generic"),
    ],
    streams,
    players: [
      entry("volume_step", "generic"),
      entry("announce_tts_engine", "announcements"),
      entry("log_level", "generic"),
    ],
  };
  return coreConfig(domain, values[domain]);
}

function coreConfig(domain: string, entries: ConfigEntry[]): CoreConfig {
  return {
    domain,
    last_error: null,
    values: Object.fromEntries(entries.map((e) => [e.key, e])),
  };
}
