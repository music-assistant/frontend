import StreamHeldDialog from "@/components/StreamHeldDialog.vue";
import { ApiCommandError } from "@/plugins/api/errors";
import { eventbus, type StreamHeldDialogEvent } from "@/plugins/eventbus";
import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { apiMock, storeMock, toastError } = vi.hoisted(() => ({
  apiMock: {
    queueCommandStop: vi.fn(),
  },
  storeMock: {
    dialogActive: false,
  },
  toastError: vi.fn(),
}));

vi.mock("@/plugins/api", async () => ({
  api: apiMock,
  ApiCommandError: (await import("@/plugins/api/errors")).ApiCommandError,
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
  template: '<div v-if="open" class="stream-held-dialog"><slot /></div>',
};

function mountDialog() {
  return mount(StreamHeldDialog, {
    global: {
      mocks: {
        $t: (key: string) => key,
      },
      stubs: {
        Button: {
          props: ["disabled", "loading"],
          template:
            '<button v-bind="$attrs" :disabled="disabled || loading"><slot /></button>',
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

function openDialog(overrides: Partial<StreamHeldDialogEvent> = {}) {
  const event: StreamHeldDialogEvent = {
    holderQueueId: "living_room",
    holderName: "Living room",
    providerName: "Spotify [marcel]",
    retry: vi.fn().mockResolvedValue(null),
    ...overrides,
  };
  eventbus.emit("streamHeldDialog", event);
  return event;
}

async function stopAndPlayHere(wrapper: ReturnType<typeof mountDialog>) {
  await wrapper.get('[data-testid="stop-and-play-here"]').trigger("click");
  await flushPromises();
}

describe("StreamHeldDialog", () => {
  enableAutoUnmount(afterEach);

  beforeEach(() => {
    vi.clearAllMocks();
    apiMock.queueCommandStop.mockResolvedValue(null);
    storeMock.dialogActive = false;
  });

  it("names the provider and the player that holds it", async () => {
    const wrapper = mountDialog();
    openDialog();
    await flushPromises();

    expect(wrapper.text()).toContain(
      "stream_held.message:Spotify [marcel],Living room",
    );
    expect(wrapper.text()).toContain("stream_held.stop_and_play_here");
    expect(wrapper.text()).toContain("cancel");
    expect(storeMock.dialogActive).toBe(true);
  });

  it("stops the holder, then plays here and closes", async () => {
    const wrapper = mountDialog();
    const event = openDialog();
    await flushPromises();

    await stopAndPlayHere(wrapper);

    expect(apiMock.queueCommandStop).toHaveBeenCalledWith("living_room");
    expect(event.retry).toHaveBeenCalledOnce();
    expect(apiMock.queueCommandStop.mock.invocationCallOrder[0]).toBeLessThan(
      vi.mocked(event.retry).mock.invocationCallOrder[0],
    );
    expect(wrapper.find(".stream-held-dialog").exists()).toBe(false);
    expect(storeMock.dialogActive).toBe(false);
    expect(toastError).not.toHaveBeenCalled();
  });

  it("does not play here when the stop fails", async () => {
    apiMock.queueCommandStop.mockRejectedValue(
      new ApiCommandError("Player unavailable", 3, "Player unavailable"),
    );
    const wrapper = mountDialog();
    const event = openDialog();
    await flushPromises();

    await stopAndPlayHere(wrapper);

    expect(event.retry).not.toHaveBeenCalled();
    expect(wrapper.find(".stream-held-dialog").exists()).toBe(false);
    // the api already showed the server's reason
    expect(toastError).not.toHaveBeenCalled();
  });

  it("reports a failure the api did not report itself", async () => {
    const wrapper = mountDialog();
    openDialog({ retry: vi.fn().mockRejectedValue(new Error("Lost")) });
    await flushPromises();

    await stopAndPlayHere(wrapper);

    expect(toastError).toHaveBeenCalledWith("Error: Lost");
    expect(wrapper.find(".stream-held-dialog").exists()).toBe(false);
  });

  it("stays open for a new refusal of the retried command", async () => {
    const wrapper = mountDialog();
    openDialog({
      retry: vi.fn().mockImplementation(() => {
        // the api offers the dialog again before it rejects the retry
        openDialog({ holderName: "Kitchen" });
        return Promise.reject(
          new ApiCommandError("Held", 29, "Held", { queue_id: "kitchen" }),
        );
      }),
    });
    await flushPromises();

    await stopAndPlayHere(wrapper);

    expect(wrapper.find(".stream-held-dialog").exists()).toBe(true);
    expect(wrapper.text()).toContain(
      "stream_held.message:Spotify [marcel],Kitchen",
    );
    expect(
      wrapper.get('[data-testid="stop-and-play-here"]').attributes("disabled"),
    ).toBeUndefined();
  });

  it("closes on cancel without touching either player", async () => {
    const wrapper = mountDialog();
    const event = openDialog();
    await flushPromises();

    await wrapper.get("button").trigger("click");
    await flushPromises();

    expect(wrapper.find(".stream-held-dialog").exists()).toBe(false);
    expect(apiMock.queueCommandStop).not.toHaveBeenCalled();
    expect(event.retry).not.toHaveBeenCalled();
  });
});
