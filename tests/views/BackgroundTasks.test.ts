import SettingsFoldRows from "@/components/settings/SettingsFoldRows.vue";
import SettingsPageFoldRow from "@/components/settings/SettingsPageFoldRow.vue";
import SettingsPageHeader from "@/components/settings/SettingsPageHeader.vue";
import SettingsViewModeToggle from "@/components/settings/SettingsViewModeToggle.vue";
import BackgroundTaskItem from "@/components/settings/background-tasks/BackgroundTaskItem.vue";
import {
  type BackgroundTask,
  Scope,
  TaskScheduleType,
  TaskStatus,
} from "@/plugins/api/interfaces";
import { eventbus } from "@/plugins/eventbus";
import BackgroundTasks from "@/views/settings/BackgroundTasks.vue";
import {
  Ban,
  CalendarCheck,
  CalendarX,
  FileText,
  Play,
  RefreshCw,
  Timer,
  Trash2,
} from "@lucide/vue";
import {
  enableAutoUnmount,
  flushPromises,
  shallowMount,
} from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ref } from "vue";
import { BUILTIN_ROLE_SCOPES, scopeChecker } from "../fixtures/scopes";

const { hasScope, tasks } = vi.hoisted(() => ({
  hasScope: vi.fn<(scope: Scope) => boolean>(),
  tasks: [] as BackgroundTask[],
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
      tasks: ref(tasks),
    }),
  };
});
vi.mock("vue-i18n", async (importOriginal) => ({
  ...(await importOriginal<typeof import("vue-i18n")>()),
  useI18n: () => ({ t: (key: string) => key }),
}));

enableAutoUnmount(afterEach);

beforeEach(() => {
  vi.clearAllMocks();
  tasks.length = 0;
});

describe("BackgroundTasks", () => {
  it("heads the page with the header of the background tasks", async () => {
    hasScope.mockImplementation(scopeChecker(BUILTIN_ROLE_SCOPES.user));

    const wrapper = await mountPage();

    expect(wrapper.getComponent(SettingsPageHeader).props("page")).toBe(
      "background_tasks",
    );
  });

  it("folds the task settings open in place above the tasks for who may change the core settings", async () => {
    hasScope.mockImplementation(scopeChecker(BUILTIN_ROLE_SCOPES.admin));

    const wrapper = await mountPage();
    const card = wrapper.getComponent(SettingsFoldRows);

    expect(card.getComponent(SettingsPageFoldRow).props()).toMatchObject({
      page: "background_tasks",
      label: "background_tasks.settings.title",
      description: "background_tasks.settings.description",
    });
    expect(
      card.element.compareDocumentPosition(
        wrapper.get(".tasks-header").element,
      ) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
  });

  it("leaves the task settings out for who may only read the tasks", async () => {
    hasScope.mockImplementation(scopeChecker(BUILTIN_ROLE_SCOPES.user));

    const wrapper = await mountPage();

    expect(wrapper.findComponent(SettingsFoldRows).exists()).toBe(false);
  });

  it("leaves the task settings out without the core write scope", async () => {
    hasScope.mockImplementation((scope) => scope !== Scope.CONFIG_CORE_WRITE);

    const wrapper = await mountPage();

    expect(wrapper.findComponent(SettingsFoldRows).exists()).toBe(false);
  });

  it.each([true, false])(
    "uses component icons for a scheduled task with enabled=%s",
    async (enabled) => {
      hasScope.mockImplementation(scopeChecker(BUILTIN_ROLE_SCOPES.admin));
      tasks.push({
        id: "task-1",
        name: "Scheduled task",
        status: TaskStatus.SUCCESS,
        report: null,
        logs: [],
        schedule: { type: TaskScheduleType.DAILY, enabled, hour: 3, minute: 0 },
        last_run: null,
        next_run: null,
        user_id: null,
        last_run_user_id: null,
        created_at: "2026-08-23T00:00:00Z",
        updated_at: "2026-08-23T00:00:00Z",
        started_at: null,
        finished_at: null,
        last_error: null,
        failure_count: 0,
        failure_messages: [],
        metadata: {},
        progress: null,
        progress_text: null,
        allow_retry: false,
        allow_cancel: false,
      });

      const wrapper = await mountPage();
      wrapper
        .getComponent(BackgroundTaskItem)
        .vm.$emit(
          "menu",
          new MouseEvent("click", { clientX: 20, clientY: 30 }),
          tasks[0],
        );

      expect(eventbus.emit).toHaveBeenCalledWith(
        "contextmenu",
        expect.objectContaining({
          posX: 20,
          posY: 30,
          items: expect.arrayContaining([
            expect.objectContaining({
              label: "background_tasks.view_details",
              icon: FileText,
            }),
            expect.objectContaining({
              label: "background_tasks.edit_schedule",
              icon: Timer,
              hide: false,
            }),
            expect.objectContaining({
              label: "background_tasks.run_now",
              icon: Play,
              hide: false,
            }),
            expect.objectContaining({
              label: enabled
                ? "background_tasks.disable_schedule"
                : "background_tasks.enable_schedule",
              icon: enabled ? CalendarX : CalendarCheck,
              hide: false,
            }),
            expect.objectContaining({
              label: "background_tasks.retry",
              icon: RefreshCw,
              hide: true,
            }),
            expect.objectContaining({
              label: "background_tasks.cancel",
              icon: Ban,
              hide: true,
            }),
            expect.objectContaining({
              label: "background_tasks.remove_history",
              icon: Trash2,
              hide: true,
            }),
          ]),
        }),
      );
    },
  );

  it.each([
    ["who may manage the tasks", BUILTIN_ROLE_SCOPES.admin],
    ["who may only read them", BUILTIN_ROLE_SCOPES.user],
  ])(
    "switches the view from the header of the list, for %s",
    async (_role, scopes) => {
      hasScope.mockImplementation(scopeChecker(scopes));
      const toggleViewMode = vi.fn();

      const wrapper = await mountPage({ toggleViewMode });
      const toggle = wrapper
        .get(".tasks-header")
        .getComponent(SettingsViewModeToggle);
      toggle.vm.$emit("toggle");

      expect(toggle.props("mode")).toBe("list");
      expect(toggleViewMode).toHaveBeenCalledOnce();
    },
  );
});

async function mountPage({ toggleViewMode = vi.fn() } = {}) {
  const wrapper = shallowMount(BackgroundTasks, {
    global: {
      provide: {
        tasksViewMode: { viewMode: ref("list"), toggleViewMode },
      },
      renderStubDefaultSlot: true,
    },
  });
  await flushPromises();
  return wrapper;
}
