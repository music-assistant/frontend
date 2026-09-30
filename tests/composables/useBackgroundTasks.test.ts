import { useBackgroundTasks } from "@/composables/background-tasks/useBackgroundTasks";
import type { Scope } from "@/plugins/api/interfaces";
import { flushPromises, mount } from "@vue/test-utils";
import { defineComponent, h } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  BUILTIN_ROLE_SCOPES,
  OWN_SOURCES_ROLE_SCOPES,
  scopeChecker,
} from "../fixtures/scopes";

const { apiMock, hasScope } = vi.hoisted(() => ({
  apiMock: { getTasks: vi.fn(), subscribe: vi.fn() },
  hasScope: vi.fn<(scope: Scope) => boolean>(),
}));

vi.mock("@/plugins/api", () => ({ api: apiMock }));

vi.mock("@/plugins/auth", () => ({ authManager: { hasScope } }));

function mountConsumer() {
  return mount(
    defineComponent({
      setup() {
        useBackgroundTasks();
        return () => h("div");
      },
    }),
  );
}

describe("useBackgroundTasks", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiMock.getTasks.mockResolvedValue([]);
    apiMock.subscribe.mockReturnValue(vi.fn());
  });

  it("lists and follows the tasks for a role that may read them", async () => {
    hasScope.mockImplementation(scopeChecker(BUILTIN_ROLE_SCOPES.user));

    const wrapper = mountConsumer();
    await flushPromises();

    expect(apiMock.getTasks).toHaveBeenCalledOnce();
    expect(apiMock.subscribe).toHaveBeenCalledOnce();
    wrapper.unmount();
  });

  it("asks nothing of the server for a role that may not read the tasks", async () => {
    hasScope.mockImplementation(scopeChecker(OWN_SOURCES_ROLE_SCOPES));

    const wrapper = mountConsumer();
    await flushPromises();

    expect(apiMock.getTasks).not.toHaveBeenCalled();
    expect(apiMock.subscribe).not.toHaveBeenCalled();
    wrapper.unmount();
  });
});
