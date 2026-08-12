import PlayAnnouncementDialog from "@/layouts/default/PlayAnnouncementDialog.vue";
import type { Player } from "@/plugins/api/interfaces";
import { eventbus } from "@/plugins/eventbus";
import { flushPromises, mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { apiMock, storeMock, toastSuccess } = vi.hoisted(() => ({
  apiMock: {
    players: {} as Record<string, Player>,
    playerCommandPlayAnnouncement: vi.fn(),
  },
  storeMock: {
    dialogActive: false,
  },
  toastSuccess: vi.fn(),
}));

vi.mock("@/plugins/api", () => ({
  api: apiMock,
  default: apiMock,
}));

vi.mock("@/plugins/store", () => ({
  store: storeMock,
}));

vi.mock("@/plugins/i18n", () => ({
  $t: (key: string) => key,
}));

vi.mock("vue-sonner", () => ({
  toast: {
    success: toastSuccess,
  },
}));

const passthroughStub = { template: "<div><slot /></div>" };
const ButtonStub = {
  props: ["disabled"],
  template: '<button :disabled="disabled"><slot /></button>',
};
const TextareaStub = {
  props: ["modelValue"],
  emits: ["update:modelValue"],
  template: `
    <textarea
      :value="modelValue"
      @input="$emit('update:modelValue', $event.target.value)"
    ></textarea>
  `,
};
const SwitchStub = {
  props: ["modelValue"],
  emits: ["update:modelValue"],
  template: `
    <input
      type="checkbox"
      :checked="modelValue"
      @change="$emit('update:modelValue', $event.target.checked)"
    />
  `,
};

function mountDialog() {
  return mount(PlayAnnouncementDialog, {
    global: {
      stubs: {
        Button: ButtonStub,
        Dialog: passthroughStub,
        DialogContent: passthroughStub,
        DialogDescription: passthroughStub,
        DialogFooter: passthroughStub,
        DialogHeader: passthroughStub,
        DialogTitle: passthroughStub,
        Label: passthroughStub,
        Switch: SwitchStub,
        Textarea: TextareaStub,
      },
    },
  });
}

describe("PlayAnnouncementDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiMock.players = {
      kitchen: { player_id: "kitchen", name: "Kitchen" } as Player,
    };
    storeMock.dialogActive = false;
  });

  it("speaks the trimmed message with the chime enabled by default", async () => {
    apiMock.playerCommandPlayAnnouncement.mockResolvedValue(undefined);
    const wrapper = mountDialog();

    eventbus.emit("playAnnouncementDialog", { playerId: "kitchen" });
    await flushPromises();

    await wrapper.get("textarea").setValue("  Dinner is ready  ");
    await wrapper.get("form").trigger("submit");
    await flushPromises();

    expect(apiMock.playerCommandPlayAnnouncement).toHaveBeenCalledWith(
      "kitchen",
      "Dinner is ready",
      { preAnnounce: true },
    );
    expect(toastSuccess).toHaveBeenCalledWith("play_announcement_sent");
    expect(storeMock.dialogActive).toBe(false);
  });

  it("sends the chime setting the user picked", async () => {
    apiMock.playerCommandPlayAnnouncement.mockResolvedValue(undefined);
    const wrapper = mountDialog();

    eventbus.emit("playAnnouncementDialog", { playerId: "kitchen" });
    await flushPromises();

    await wrapper.get("textarea").setValue("Dinner is ready");
    await wrapper.get('input[type="checkbox"]').setValue(false);
    await wrapper.get("form").trigger("submit");
    await flushPromises();

    expect(apiMock.playerCommandPlayAnnouncement).toHaveBeenCalledWith(
      "kitchen",
      "Dinner is ready",
      { preAnnounce: false },
    );
  });

  it("keeps the dialog open when the announcement fails", async () => {
    apiMock.playerCommandPlayAnnouncement.mockRejectedValue(
      new Error("Command failed"),
    );
    const wrapper = mountDialog();

    eventbus.emit("playAnnouncementDialog", { playerId: "kitchen" });
    await flushPromises();

    await wrapper.get("textarea").setValue("Dinner is ready");
    await wrapper.get("form").trigger("submit");
    await flushPromises();

    expect(toastSuccess).not.toHaveBeenCalled();
    expect(storeMock.dialogActive).toBe(true);
  });

  it("cannot be submitted without a message", async () => {
    const wrapper = mountDialog();

    eventbus.emit("playAnnouncementDialog", { playerId: "kitchen" });
    await flushPromises();

    const submitButton = wrapper
      .findAll("button")
      .find((button) => button.attributes("form") === "play-announcement-form");
    expect(submitButton?.attributes("disabled")).toBeDefined();

    await wrapper.get("textarea").setValue("Dinner is ready");
    expect(submitButton?.attributes("disabled")).toBeUndefined();
  });
});
