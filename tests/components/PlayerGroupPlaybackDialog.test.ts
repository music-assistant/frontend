import PlayerGroupPlaybackDialog from "@/components/PlayerGroupPlaybackDialog.vue";
import {
  eventbus,
  type PlayerGroupPlaybackDialogEvent,
} from "@/plugins/eventbus";
import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { storeMock, toastError } = vi.hoisted(() => ({
  storeMock: {
    dialogActive: false,
  },
  toastError: vi.fn(),
}));

vi.mock("@/plugins/store", () => ({
  store: storeMock,
}));

vi.mock("vue-i18n", async (importOriginal) => ({
  ...(await importOriginal<typeof import("vue-i18n")>()),
  useI18n: () => ({
    t: (key: string, args?: string[]) =>
      args ? `${key}:${args.join(",")}` : key,
  }),
}));

vi.mock("vue-sonner", () => ({
  toast: {
    error: toastError,
  },
}));

const passthroughStub = { template: "<div><slot /></div>" };
const DialogStub = {
  props: ["open"],
  emits: ["update:open"],
  template: '<div v-if="open" class="playback-dialog"><slot /></div>',
};

function mountDialog() {
  return mount(PlayerGroupPlaybackDialog, {
    global: {
      mocks: {
        $t: (key: string) => key,
      },
      stubs: {
        Button: {
          props: ["disabled"],
          template:
            '<button v-bind="$attrs" :disabled="disabled"><slot /></button>',
        },
        Dialog: DialogStub,
        DialogContent: passthroughStub,
        DialogDescription: passthroughStub,
        DialogFooter: passthroughStub,
        DialogHeader: passthroughStub,
        DialogTitle: passthroughStub,
      },
    },
  });
}

function openDialog(overrides: Partial<PlayerGroupPlaybackDialogEvent> = {}) {
  const event: PlayerGroupPlaybackDialogEvent = {
    change: "remove",
    playerName: "Kitchen",
    onKeepPlaying: vi.fn(),
    onStopAndUngroup: vi.fn(),
    ...overrides,
  };
  eventbus.emit("playerGroupPlaybackDialog", event);
  return event;
}

describe("PlayerGroupPlaybackDialog", () => {
  enableAutoUnmount(afterEach);

  beforeEach(() => {
    vi.clearAllMocks();
    storeMock.dialogActive = false;
  });

  it("explains a leader removal and offers all choices", async () => {
    const wrapper = mountDialog();
    openDialog();
    await flushPromises();

    expect(wrapper.text()).toContain(
      "player_group_playback.remove_message:Kitchen",
    );
    expect(wrapper.find('[data-testid="keep-playing"]').exists()).toBe(true);
    expect(wrapper.find('[data-testid="stop-and-ungroup"]').exists()).toBe(
      true,
    );
    expect(wrapper.text()).toContain("cancel");
    expect(storeMock.dialogActive).toBe(true);
  });

  it("keeps playback and closes after the action succeeds", async () => {
    const wrapper = mountDialog();
    const event = openDialog();
    await flushPromises();

    await wrapper.get('[data-testid="keep-playing"]').trigger("click");
    await flushPromises();

    expect(event.onKeepPlaying).toHaveBeenCalledOnce();
    expect(event.onStopAndUngroup).not.toHaveBeenCalled();
    expect(wrapper.find(".playback-dialog").exists()).toBe(false);
    expect(storeMock.dialogActive).toBe(false);
  });

  it("stops and ungroups when requested", async () => {
    const wrapper = mountDialog();
    const event = openDialog({ change: "power_off" });
    await flushPromises();

    expect(wrapper.text()).toContain(
      "player_group_playback.power_off_message:Kitchen",
    );
    await wrapper.get('[data-testid="stop-and-ungroup"]').trigger("click");
    await flushPromises();

    expect(event.onStopAndUngroup).toHaveBeenCalledOnce();
    expect(event.onKeepPlaying).not.toHaveBeenCalled();
  });

  it("shows an action error and stays open", async () => {
    const wrapper = mountDialog();
    openDialog({
      onKeepPlaying: vi.fn().mockRejectedValue(new Error("Command failed")),
    });
    await flushPromises();

    await wrapper.get('[data-testid="keep-playing"]').trigger("click");
    await flushPromises();

    expect(toastError).toHaveBeenCalledWith("Error: Command failed");
    expect(wrapper.find(".playback-dialog").exists()).toBe(true);
  });
});
