import type { MusicAssistantApi } from "@/plugins/api";
import {
  ConfigEntryType,
  Scope,
  type ConfigEntry,
  type CoreConfig,
} from "@/plugins/api/interfaces";
import LibrarySettings from "@/views/settings/LibrarySettings.vue";
import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { apiMock, hasScope, toastSuccess } = vi.hoisted(() => ({
  apiMock: {
    getCoreConfig: vi.fn<MusicAssistantApi["getCoreConfig"]>(),
    invokeCoreConfigAction:
      vi.fn<MusicAssistantApi["invokeCoreConfigAction"]>(),
    saveCoreConfig: vi.fn<MusicAssistantApi["saveCoreConfig"]>(),
  },
  hasScope: vi.fn<(scope: Scope) => boolean>(),
  toastSuccess: vi.fn(),
}));

vi.mock("@/plugins/api", () => ({ api: apiMock, default: apiMock }));
vi.mock("@/plugins/auth", () => ({ authManager: { hasScope } }));
vi.mock("@/plugins/i18n", () => ({ $t: (key: string) => key }));
vi.mock("vue-sonner", () => ({
  toast: { error: vi.fn(), success: toastSuccess },
}));

enableAutoUnmount(afterEach);

// the form itself is covered where it lives
const editConfigStub = {
  name: "EditConfig",
  props: { configEntries: Array, disabled: Boolean, inlineSave: Boolean },
  emits: ["submit", "action", "immediateApply"],
  template: "<div data-testid='edit-config' />",
};
const RouterLinkStub = {
  props: ["to"],
  template: '<a :href="JSON.stringify(to)"><slot /></a>',
};

beforeEach(() => {
  vi.clearAllMocks();
  hasScope.mockReturnValue(true);
  apiMock.getCoreConfig.mockImplementation(async (domain) =>
    libraryConfig(domain),
  );
});

describe("LibrarySettings", () => {
  it("leads to the music locations and the genres", async () => {
    const wrapper = await mountPage();

    const rows = wrapper.findAll('[data-testid^="library-link-"]');
    expect(rows.map((row) => JSON.parse(row.attributes("href")!))).toEqual([
      { name: "storagesettings" },
      { name: "genremanagement" },
    ]);
    expect(rows[0].text()).toContain("settings.storage.music_locations");
    expect(rows[1].text()).toContain("genres");
  });

  it.each([
    [Scope.CONFIG_PROVIDERS_WRITE, "genres"],
    [Scope.LIBRARY_MANAGE, "music_locations"],
  ])(
    "leaves a row out for a role without %s",
    async (missingScope, leftRow) => {
      hasScope.mockImplementation((scope) => scope !== missingScope);

      const wrapper = await mountPage();

      expect(
        wrapper
          .findAll('[data-testid^="library-link-"]')
          .map((row) => row.attributes("data-testid")),
      ).toEqual([`library-link-${leftRow}`]);
      expect(wrapper.find('[data-testid="edit-config"]').exists()).toBe(true);
    },
  );

  it("shows which source plays first and the library maintenance after it, each under a heading of its own", async () => {
    const wrapper = await mountPage();

    expect(
      formEntries(wrapper).map(({ key, category, category_label }) => ({
        key,
        category,
        category_label,
      })),
    ).toEqual([
      {
        key: "core/streams/stream_source_mode",
        category: "core/streams",
        category_label: "settings.library.source_selection",
      },
      {
        key: "core/streams/upgrade_below_quality",
        category: "core/streams",
        category_label: "settings.library.source_selection",
      },
      {
        key: "core/music/keep_remasters_apart",
        category: "core/music",
        category_label: "settings.library.maintenance",
      },
      {
        key: "core/music/reset_db",
        category: "core/music",
        category_label: "settings.library.maintenance",
      },
    ]);
  });

  it("resets the library on the music module", async () => {
    apiMock.invokeCoreConfigAction.mockResolvedValueOnce({
      message: "The database has been reset.",
      open_url: null,
    });
    const wrapper = await mountPage();

    wrapper
      .getComponent(editConfigStub)
      .vm.$emit("action", "core/music/reset_db", {}, false);
    await flushPromises();

    expect(apiMock.invokeCoreConfigAction).toHaveBeenCalledExactlyOnceWith(
      "music",
      "reset_db",
    );
    expect(toastSuccess).toHaveBeenCalledWith("The database has been reset.");
  });
});

async function mountPage() {
  const wrapper = mount(LibrarySettings, {
    global: {
      stubs: { EditConfig: editConfigStub, RouterLink: RouterLinkStub },
    },
  });
  await flushPromises();
  return wrapper;
}

function formEntries(wrapper: Awaited<ReturnType<typeof mountPage>>) {
  return wrapper
    .getComponent(editConfigStub)
    .props("configEntries") as ConfigEntry[];
}

function libraryConfig(domain: string): CoreConfig {
  const entry = (
    key: string,
    category: string,
    type = ConfigEntryType.STRING,
  ): ConfigEntry => ({
    key,
    category,
    category_label: category,
    type,
    label: key,
    default_value: null,
    required: false,
    options: [],
  });
  const values: Record<string, ConfigEntry[]> = {
    streams: [
      entry("bind_port", "generic"),
      entry("stream_source_mode", "source_selection"),
      entry("upgrade_below_quality", "source_selection"),
      entry("buffer_size", "playback"),
      entry("log_level", "generic"),
    ],
    music: [
      entry("keep_remasters_apart", "generic", ConfigEntryType.BOOLEAN),
      entry("reset_db", "generic", ConfigEntryType.ACTION),
      entry("log_level", "generic"),
    ],
  };
  return {
    domain,
    last_error: null,
    values: Object.fromEntries(values[domain].map((e) => [e.key, e])),
  };
}
