import type { CoreConfig } from "@/plugins/api/interfaces";
import SystemConfig from "@/views/settings/SystemConfig.vue";
import { flushPromises, mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ref } from "vue";

const { apiMock, routerPush } = vi.hoisted(() => ({
  apiMock: {
    getCoreConfigs: vi.fn(),
    providerManifests: {
      discovery: { name: "Discovery" },
      player_queues: { name: "Player queues" },
      players: { name: "Players" },
      streams: { name: "Streams" },
      tasks: { name: "Background tasks" },
      webserver: { name: "Webserver" },
    } as Record<string, { name: string }>,
  },
  routerPush: vi.fn(),
}));

vi.mock("@/plugins/api", () => ({ api: apiMock, default: apiMock }));
vi.mock("vue-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("vue-router")>()),
  useRouter: () => ({ push: routerPush }),
}));
vi.mock("vue-i18n", async (importOriginal) => ({
  ...(await importOriginal<typeof import("vue-i18n")>()),
  useI18n: () => ({ t: (key: string) => key }),
}));

beforeEach(() => {
  vi.clearAllMocks();
  apiMock.getCoreConfigs.mockResolvedValue([]);
});

describe("SystemConfig", () => {
  it.each(["card", "list"] as const)(
    "offers the Storage page in the %s view",
    async (viewMode) => {
      const wrapper = await mountPage(viewMode);

      const entry = storageEntry(wrapper);
      expect(entry).toBeDefined();
      await entry!.trigger("click");

      expect(routerPush).toHaveBeenCalledWith("/settings/storage");
    },
  );

  it.each(["card", "list"] as const)(
    "lists Background tasks once, as its page, in the %s view",
    async (viewMode) => {
      apiMock.getCoreConfigs.mockResolvedValue([
        coreConfig("streams"),
        coreConfig("tasks"),
      ]);
      const wrapper = await mountPage(viewMode);

      const text = entryTitles(wrapper).join("\n");
      expect(text).toContain("Streams");
      // the controller itself, by the name of its manifest
      expect(text).not.toContain("Background tasks");
      const tasks = entries(wrapper).filter((entry) =>
        entry.text().includes("background_tasks.title"),
      );
      expect(tasks).toHaveLength(1);
      await tasks[0].trigger("click");

      expect(routerPush).toHaveBeenCalledWith("/settings/tasks");
    },
  );

  it.each(["card", "list"] as const)(
    "lists the Network page in place of the modules it shows, in the %s view",
    async (viewMode) => {
      apiMock.getCoreConfigs.mockResolvedValue([
        coreConfig("discovery"),
        coreConfig("streams"),
        coreConfig("webserver"),
      ]);
      const wrapper = await mountPage(viewMode);

      const text = entryTitles(wrapper).join("\n");
      // the streams keep their other settings here
      expect(text).toContain("Streams");
      expect(text).not.toContain("Webserver");
      expect(text).not.toContain("Discovery");
      const network = entries(wrapper).find((entry) =>
        entry.text().includes("settings.network.title"),
      );
      await network!.trigger("click");

      expect(routerPush).toHaveBeenCalledWith("/settings/network");
    },
  );

  it("leaves the modules of the playback defaults to the Playback page", async () => {
    apiMock.getCoreConfigs.mockResolvedValue([
      coreConfig("player_queues"),
      coreConfig("players"),
      coreConfig("streams"),
    ]);
    const wrapper = await mountPage("list");

    const text = entryTitles(wrapper).join("\n");
    // the streams keep their other settings here
    expect(text).toContain("Streams");
    expect(text).not.toContain("Player queues");
    expect(text).not.toContain("Players");
  });

  it("no longer lists the audio analysis status", async () => {
    const wrapper = await mountPage("list");

    expect(entryTitles(wrapper).join(" ")).not.toContain("audio_analysis");
  });
});

async function mountPage(viewMode: "card" | "list") {
  const wrapper = mount(SystemConfig, {
    global: {
      provide: { systemViewMode: { viewMode: ref(viewMode) } },
      stubs: {
        Container: { template: "<div><slot /></div>" },
        VIcon: true,
        VList: { template: "<div><slot /></div>" },
        ListItem: {
          emits: ["click"],
          template:
            '<div class="list-item" @click="$emit(\'click\')"><slot name="title" /></div>',
        },
        ProviderIcon: true,
        UnsupportedInstallBanner: true,
      },
    },
  });
  await flushPromises();
  return wrapper;
}

function entries(wrapper: Awaited<ReturnType<typeof mountPage>>) {
  return wrapper.findAll(".setting-card, .list-item");
}

function entryTitles(wrapper: Awaited<ReturnType<typeof mountPage>>) {
  return entries(wrapper).map((entry) => entry.text());
}

function storageEntry(wrapper: Awaited<ReturnType<typeof mountPage>>) {
  return entries(wrapper).find((entry) =>
    entry.text().includes("settings.storage.title"),
  );
}

function coreConfig(domain: string): CoreConfig {
  return { domain, last_error: null, values: {} };
}
