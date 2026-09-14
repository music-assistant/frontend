/**
 * Saving a queue as a playlist runs as a background task; its toast offers the
 * task list only to a role that may read it.
 */
import CreatePlaylistDialog from "@/layouts/default/CreatePlaylistDialog.vue";
import type { Scope } from "@/plugins/api/interfaces";
import type { CreatePlaylistEvent } from "@/plugins/eventbus";
import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { BUILTIN_ROLE_SCOPES, scopeChecker } from "../fixtures/scopes";

const { apiMock, eventHandlers, hasScope, routerPush, storeMock, toastMock } =
  vi.hoisted(() => ({
    apiMock: {
      getProvider: vi.fn(),
      queueCommandSaveAsPlaylist: vi.fn(),
    },
    eventHandlers: new Map<string, (event: CreatePlaylistEvent) => void>(),
    hasScope: vi.fn<(scope: Scope) => boolean>(),
    routerPush: vi.fn(),
    storeMock: { dialogActive: false, showFullscreenPlayer: true },
    toastMock: { error: vi.fn(), info: vi.fn(), success: vi.fn() },
  }));

vi.mock("@/plugins/api", () => ({ api: apiMock, default: apiMock }));
vi.mock("@/plugins/auth", () => ({ authManager: { hasScope } }));
vi.mock("@/plugins/eventbus", () => ({
  eventbus: {
    on: (event: string, handler: (payload: CreatePlaylistEvent) => void) =>
      eventHandlers.set(event, handler),
    off: (event: string) => eventHandlers.delete(event),
  },
}));
vi.mock("@/plugins/i18n", () => ({ $t: (key: string) => key }));
vi.mock("@/plugins/router", () => ({ default: { push: routerPush } }));
vi.mock("@/plugins/store", () => ({ store: storeMock }));
vi.mock("vue-sonner", () => ({ toast: toastMock }));

enableAutoUnmount(afterEach);

const passthroughStub = { template: "<div><slot /></div>" };

interface TaskToastOptions {
  action?: { label: string; onClick: () => void };
}

/**
 * Save the queue as a playlist through the dialog and hand back the options of
 * the toast announcing the task.
 */
async function saveQueueAsPlaylist(): Promise<TaskToastOptions> {
  const wrapper = mount(CreatePlaylistDialog, {
    global: {
      stubs: {
        Button: { template: "<button><slot /></button>" },
        Dialog: passthroughStub,
        DialogContent: passthroughStub,
        DialogDescription: passthroughStub,
        DialogFooter: passthroughStub,
        DialogHeader: passthroughStub,
        DialogTitle: passthroughStub,
        Input: {
          props: ["modelValue"],
          emits: ["update:modelValue"],
          template:
            '<input :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
        },
        Label: passthroughStub,
      },
    },
  });
  eventHandlers.get("createPlaylist")?.({ queueId: "kitchen" });
  await flushPromises();
  await wrapper.get("input").setValue("Road trip");
  await wrapper
    .findAll("button")
    .find((button) => button.text() === "settings.save")
    ?.trigger("click");
  await flushPromises();
  expect(apiMock.queueCommandSaveAsPlaylist).toHaveBeenCalledWith(
    "kitchen",
    "Road trip",
    { showBackgroundTaskToast: false },
  );
  return toastMock.info.mock.calls[0][1];
}

beforeEach(() => {
  vi.clearAllMocks();
  apiMock.queueCommandSaveAsPlaylist.mockResolvedValue({});
  storeMock.showFullscreenPlayer = true;
});

describe("CreatePlaylistDialog saving a queue", () => {
  it.each([
    { role: "an admin", scopes: BUILTIN_ROLE_SCOPES.admin },
    { role: "a member", scopes: BUILTIN_ROLE_SCOPES.user },
  ])("offers $role the task list with the task toast", async ({ scopes }) => {
    hasScope.mockImplementation(scopeChecker(scopes));

    const toast = await saveQueueAsPlaylist();
    toast.action?.onClick();

    expect(toast.action?.label).toBe("background_tasks.open");
    expect(storeMock.showFullscreenPlayer).toBe(false);
    expect(routerPush).toHaveBeenCalledWith({ name: "backgroundtasks" });
  });

  it("leaves the task list out of the task toast for a guest", async () => {
    hasScope.mockImplementation(scopeChecker(BUILTIN_ROLE_SCOPES.guest));

    const toast = await saveQueueAsPlaylist();

    expect(toast.action).toBeUndefined();
  });
});
