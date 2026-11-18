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
  it("leads to the network, the background tasks and the diagnostics", async () => {
    const wrapper = await mountPage();

    expect(rowKeys(wrapper)).toEqual([
      "network",
      "background_tasks",
      "diagnostics",
    ]);
    expect(linkOf(wrapper, "network")).toEqual({ name: "networksettings" });
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
    [Scope.CONFIG_CORE_WRITE, "network"],
    [Scope.SYSTEM_READ, "background_tasks"],
    [Scope.SYSTEM_MANAGE, "diagnostics"],
  ])("leaves a page out without %s, which it needs", async (scope, key) => {
    hasScope.mockImplementation((granted) => granted !== scope);

    const wrapper = await mountPage();

    expect(rowKeys(wrapper)).not.toContain(key);
    expect(rowKeys(wrapper)).toHaveLength(2);
  });
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
