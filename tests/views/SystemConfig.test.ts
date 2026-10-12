import SystemConfig from "@/views/settings/SystemConfig.vue";
import { flushPromises, mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ref } from "vue";

const { apiMock, routerPush } = vi.hoisted(() => ({
  apiMock: {
    getCoreConfigs: vi.fn(),
    providerManifests: {},
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

function storageEntry(wrapper: Awaited<ReturnType<typeof mountPage>>) {
  return wrapper
    .findAll(".setting-card, .list-item")
    .find((entry) => entry.text().includes("settings.storage.title"));
}
