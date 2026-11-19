import SettingsTiles, {
  type SettingsTile,
} from "@/components/settings/SettingsTiles.vue";
import { Scope, type CoreConfig } from "@/plugins/api/interfaces";
import SystemConfig from "@/views/settings/SystemConfig.vue";
import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { apiMock, hasScope } = vi.hoisted(() => ({
  apiMock: {
    getCoreConfigs: vi.fn(),
    providerManifests: {
      radio_tuner: { name: "Radio tuner", description: "Tunes the radio" },
      metrics: { name: "Metrics", description: "Counts things" },
    } as Record<string, { name: string; description: string }>,
  },
  hasScope: vi.fn<(scope: Scope) => boolean>(),
}));

vi.mock("@/plugins/api", () => ({ api: apiMock, default: apiMock }));
vi.mock("@/plugins/auth", () => ({ authManager: { hasScope } }));
vi.mock("@/plugins/i18n", () => ({ $t: (key: string) => key }));

enableAutoUnmount(afterEach);

// the core modules the server offers settings of, which settings pages show
const KNOWN_MODULES = [
  "ai",
  "cache",
  "discovery",
  "metadata",
  "music",
  "player_queues",
  "players",
  "statistics",
  "streams",
  "tasks",
  "webserver",
];

const RouterLinkStub = {
  props: ["to"],
  template: '<a :href="JSON.stringify(to)"><slot /></a>',
};

beforeEach(() => {
  vi.clearAllMocks();
  hasScope.mockReturnValue(true);
  apiMock.getCoreConfigs.mockResolvedValue(KNOWN_MODULES.map(coreConfig));
});

describe("SystemConfig", () => {
  it("heads the page as the System hub", async () => {
    const wrapper = await mountPage();

    const header = wrapper.get('[data-testid="settings-page-header"]');
    expect(header.get("h1").text()).toBe("settings.system");
    expect(header.get("p").text()).toBe("settings.system_description");
    expect(
      header.get('[data-testid="settings-page-icon"]').attributes("style"),
    ).toContain("rgb(168, 85, 247)");
  });

  it("gives each page its own tile, a module no settings page shows a plain one", async () => {
    apiMock.getCoreConfigs.mockResolvedValue([
      ...KNOWN_MODULES.map(coreConfig),
      coreConfig("radio_tuner"),
    ]);

    const wrapper = await mountPage();

    expect(
      wrapper
        .getComponent(SettingsTiles)
        .props("tiles")
        .map(({ key, color }: SettingsTile) => [key, color]),
    ).toEqual([
      ["network", "blue"],
      ["storage", "orange"],
      ["home_assistant", "cyan"],
      ["background_tasks", "green"],
      ["diagnostics", "red"],
      ["core_radio_tuner", "grey-darken-1"],
    ]);
  });

  it("leads to the network, the storage, Home Assistant, the background tasks and the diagnostics", async () => {
    const wrapper = await mountPage();

    expect(rowKeys(wrapper)).toEqual([
      "network",
      "storage",
      "home_assistant",
      "background_tasks",
      "diagnostics",
    ]);
    expect(linkOf(wrapper, "network")).toEqual({ name: "networksettings" });
    expect(linkOf(wrapper, "storage")).toEqual({ name: "storagesettings" });
    expect(linkOf(wrapper, "home_assistant")).toEqual({
      name: "homeassistantsettings",
    });
    expect(linkOf(wrapper, "background_tasks")).toEqual({
      name: "backgroundtasks",
    });
    expect(linkOf(wrapper, "diagnostics")).toEqual({ name: "diagnostics" });
  });

  it("lists no module a settings page shows", async () => {
    const wrapper = await mountPage();

    expect(rowKeys(wrapper).filter((key) => key.startsWith("core_"))).toEqual(
      [],
    );
  });

  it("leads to the plain page of a module no settings page shows, by name", async () => {
    apiMock.getCoreConfigs.mockResolvedValue([
      ...KNOWN_MODULES.map(coreConfig),
      coreConfig("radio_tuner"),
      coreConfig("metrics"),
    ]);

    const wrapper = await mountPage();

    expect(rowKeys(wrapper)).toEqual([
      "network",
      "storage",
      "home_assistant",
      "background_tasks",
      "diagnostics",
      "core_metrics",
      "core_radio_tuner",
    ]);
    const row = wrapper.get('[data-testid="system-link-core_radio_tuner"]');
    expect(row.text()).toContain("Radio tuner");
    expect(row.text()).toContain("Tunes the radio");
    expect(linkOf(wrapper, "core_radio_tuner")).toEqual({
      name: "editcore",
      params: { domain: "radio_tuner" },
    });
  });

  it.each([
    [Scope.CONFIG_CORE_WRITE, ["network"]],
    [Scope.CONFIG_PROVIDERS_WRITE, ["storage", "home_assistant"]],
    [Scope.SYSTEM_READ, ["background_tasks"]],
    [Scope.SYSTEM_MANAGE, ["diagnostics"]],
  ])(
    "leaves the pages out without %s, which they need",
    async (scope, keys) => {
      hasScope.mockImplementation((granted) => granted !== scope);

      const wrapper = await mountPage();

      expect(rowKeys(wrapper)).toHaveLength(5 - keys.length);
      for (const key of keys) expect(rowKeys(wrapper)).not.toContain(key);
    },
  );
});

async function mountPage() {
  const wrapper = mount(SystemConfig, {
    global: {
      stubs: { RouterLink: RouterLinkStub, UnsupportedInstallBanner: true },
    },
  });
  await flushPromises();
  return wrapper;
}

const ROW_PREFIX = "system-link-";

function rowKeys(wrapper: Awaited<ReturnType<typeof mountPage>>) {
  return wrapper
    .findAll(`[data-testid^="${ROW_PREFIX}"]`)
    .map((row) => row.attributes("data-testid")!.slice(ROW_PREFIX.length));
}

function linkOf(wrapper: Awaited<ReturnType<typeof mountPage>>, key: string) {
  const href = wrapper
    .get(`[data-testid="${ROW_PREFIX}${key}"]`)
    .attributes("href");
  return JSON.parse(href!);
}

function coreConfig(domain: string): CoreConfig {
  return { domain, last_error: null, values: {} };
}
