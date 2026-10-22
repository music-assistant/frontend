/**
 * @vitest-environment jsdom
 */
import BackgroundTaskDetailsDialog from "@/components/settings/background-tasks/BackgroundTaskDetailsDialog.vue";
import {
  type BackgroundTask,
  type Scope,
  TaskScheduleType,
  TaskStatus,
} from "@/plugins/api/interfaces";
import { mount, type VueWrapper } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BUILTIN_ROLE_SCOPES, scopeChecker } from "../fixtures/scopes";

const { hasScope } = vi.hoisted(() => ({
  hasScope: vi.fn<(scope: Scope) => boolean>(),
}));

vi.mock("@/plugins/api", () => ({ api: {} }));

vi.mock("@/plugins/breakpoint", () => ({
  getBreakpointValue: vi.fn(() => false),
}));

vi.mock("@/plugins/router", () => ({
  default: { push: vi.fn() },
}));

vi.mock("@/plugins/store", () => ({
  store: { currentUser: null },
}));

vi.mock("@/plugins/auth", () => ({ authManager: { hasScope } }));

vi.mock("vue-i18n", async (importOriginal) => {
  const actual = await importOriginal<typeof import("vue-i18n")>();
  return {
    ...actual,
    useI18n: () => ({
      t: (key: string) => key,
      te: () => false,
    }),
  };
});

const passthrough = { template: "<div><slot /></div>" };

describe("BackgroundTaskDetailsDialog", () => {
  beforeEach(() => {
    hasScope.mockImplementation(scopeChecker(BUILTIN_ROLE_SCOPES.user));
  });

  it.each([
    TaskStatus.SUCCESS,
    TaskStatus.PARTIAL_SUCCESS,
    TaskStatus.FAILED,
    TaskStatus.CANCELLED,
  ])("renders a Markdown report for a %s task", (status) => {
    const wrapper = mountDialog(
      makeTask({
        status,
        report: "Imported **12 playlists**.",
      }),
    );

    const report = wrapper.get(".task-report");
    expect(report.get("strong").text()).toBe("12 playlists");
    expect(report.text()).not.toContain("**");
    expect(wrapper.text()).toContain("background_tasks.report_title");

    const sectionTitles = wrapper
      .findAll(".section-title")
      .map((title) => title.text());
    expect(sectionTitles.indexOf("background_tasks.report_title")).toBeLessThan(
      sectionTitles.indexOf("background_tasks.log_title"),
    );
  });

  it("does not render a report section without a report", () => {
    const wrapper = mountDialog(makeTask());

    expect(wrapper.find(".task-report").exists()).toBe(false);
    expect(wrapper.text()).not.toContain("background_tasks.report_title");
  });

  it("links the users and offers editing the schedule to an admin", () => {
    hasScope.mockImplementation(scopeChecker(BUILTIN_ROLE_SCOPES.admin));

    const wrapper = mountDialog(scheduledTask());

    expect(wrapper.findAll(".detail-link")).toHaveLength(2);
    expect(
      wrapper.find('[title="background_tasks.edit_schedule"]').exists(),
    ).toBe(true);
  });

  it("offers a member neither the user links nor editing the schedule", () => {
    const wrapper = mountDialog(scheduledTask());

    expect(wrapper.find(".detail-link").exists()).toBe(false);
    expect(
      wrapper.find('[title="background_tasks.edit_schedule"]').exists(),
    ).toBe(false);
  });
});

function scheduledTask(): BackgroundTask {
  return makeTask({
    schedule: {
      type: TaskScheduleType.DAILY,
      enabled: true,
      hour: 3,
      minute: 0,
    },
    user_id: "user-1",
    last_run_user_id: "user-2",
  });
}

function mountDialog(task: BackgroundTask): VueWrapper {
  return mount(BackgroundTaskDetailsDialog, {
    props: {
      open: true,
      task,
      logText: "Task log",
    },
    global: {
      stubs: {
        Badge: passthrough,
        Button: passthrough,
        Dialog: passthrough,
        DialogContent: passthrough,
        DialogHeader: passthrough,
        DialogTitle: passthrough,
        ScrollArea: passthrough,
        Separator: { template: "<hr />" },
      },
    },
  });
}

function makeTask(overrides: Partial<BackgroundTask> = {}): BackgroundTask {
  return {
    id: "task-1",
    name: "Import playlists",
    status: TaskStatus.SUCCESS,
    report: null,
    logs: [],
    schedule: null,
    last_run: "2026-08-23T00:00:00Z",
    next_run: null,
    user_id: null,
    last_run_user_id: null,
    created_at: "2026-08-23T00:00:00Z",
    updated_at: "2026-08-23T00:00:00Z",
    started_at: "2026-08-23T00:00:00Z",
    finished_at: "2026-08-23T00:01:00Z",
    last_error: null,
    failure_count: 0,
    failure_messages: [],
    metadata: {},
    progress: 1,
    progress_text: null,
    allow_retry: false,
    allow_cancel: false,
    ...overrides,
  };
}
