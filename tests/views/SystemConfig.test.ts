import { Scope } from "@/plugins/api/interfaces";
import SystemConfig from "@/views/settings/SystemConfig.vue";
import { flushPromises, mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { ref } from "vue";
import { BUILTIN_ROLE_SCOPES, scopeChecker } from "../fixtures/scopes";

const { apiMock, hasScope, routerPush } = vi.hoisted(() => ({
  apiMock: {
    getCoreConfigs: vi.fn(),
    providerManifests: {},
  },
  hasScope: vi.fn<(scope: Scope) => boolean>(),
  routerPush: vi.fn(),
}));

vi.mock("@/plugins/api", () => ({ api: apiMock, default: apiMock }));
vi.mock("@/plugins/api/helpers", () => ({ requireServerVersion: () => true }));
vi.mock("@/plugins/auth", () => ({ authManager: { hasScope } }));
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
  hasScope.mockImplementation(scopeChecker(BUILTIN_ROLE_SCOPES.admin));
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

  it("offers the Storage page only to who may manage the music sources", async () => {
    hasScope.mockImplementation(
      scopeChecker([...BUILTIN_ROLE_SCOPES.guest, Scope.CONFIG_CORE_WRITE]),
    );

    const wrapper = await mountPage("card");

    expect(storageEntry(wrapper)).toBeUndefined();
    // the other pages under System stay
    expect(wrapper.text()).toContain("settings.diagnostics");
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
