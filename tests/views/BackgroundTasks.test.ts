import { Scope } from "@/plugins/api/interfaces";
import BackgroundTasks from "@/views/settings/BackgroundTasks.vue";
import {
  enableAutoUnmount,
  flushPromises,
  shallowMount,
} from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ref } from "vue";
import { BUILTIN_ROLE_SCOPES, scopeChecker } from "../fixtures/scopes";

const { hasScope } = vi.hoisted(() => ({
  hasScope: vi.fn<(scope: Scope) => boolean>(),
}));

vi.mock("@/plugins/api", () => ({ api: {}, default: {} }));
vi.mock("@/plugins/auth", () => ({ authManager: { hasScope } }));
vi.mock("@/plugins/eventbus", () => ({ eventbus: { emit: vi.fn() } }));
vi.mock("@/composables/background-tasks/useBackgroundTasks", async () => {
  const { ref } = await vi.importActual<typeof import("vue")>("vue");
  return {
    useBackgroundTasks: () => ({
      loading: ref(false),
      refreshTasks: vi.fn(),
      tasks: ref([]),
    }),
  };
});
vi.mock("vue-i18n", async (importOriginal) => ({
  ...(await importOriginal<typeof import("vue-i18n")>()),
  useI18n: () => ({ t: (key: string) => key }),
}));

const SETTINGS_ROW = '[data-testid="background-tasks-link-settings"]';

enableAutoUnmount(afterEach);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("BackgroundTasks", () => {
  it("leads who may change the core settings to the task settings", async () => {
    hasScope.mockImplementation(scopeChecker(BUILTIN_ROLE_SCOPES.admin));

    const wrapper = await mountPage();

    const row = wrapper.get(SETTINGS_ROW);
    expect(JSON.parse(row.attributes("href")!)).toEqual({
      name: "tasksettings",
    });
    expect(row.text()).toContain("background_tasks.settings.title");
  });

  it("leaves the task settings out for who may only read the tasks", async () => {
    hasScope.mockImplementation(scopeChecker(BUILTIN_ROLE_SCOPES.user));

    const wrapper = await mountPage();

    expect(wrapper.find(SETTINGS_ROW).exists()).toBe(false);
  });

  it("leaves the task settings out without the core write scope", async () => {
    hasScope.mockImplementation((scope) => scope !== Scope.CONFIG_CORE_WRITE);

    const wrapper = await mountPage();

    expect(wrapper.find(SETTINGS_ROW).exists()).toBe(false);
  });
});

async function mountPage() {
  const wrapper = shallowMount(BackgroundTasks, {
    global: {
      provide: {
        tasksViewMode: { viewMode: ref("list"), toggleViewMode: vi.fn() },
      },
      stubs: {
        RouterLink: {
          props: ["to"],
          template: '<a :href="JSON.stringify(to)"><slot /></a>',
        },
        SettingsLinkRows: false,
      },
    },
  });
  await flushPromises();
  return wrapper;
}
