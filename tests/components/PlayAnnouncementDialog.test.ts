import PlayAnnouncementDialog from "@/layouts/default/PlayAnnouncementDialog.vue";
import type { Player } from "@/plugins/api/interfaces";
import { eventbus } from "@/plugins/eventbus";
import { flushPromises, mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { apiMock, storeMock, toastSuccess } = vi.hoisted(() => ({
  apiMock: {
    players: {} as Record<string, Player>,
    baseUrl: "https://music.example",
    isRemoteConnection: { value: false },
    playerCommandPlayAnnouncement: vi.fn(),
    getPlayerConfigValue: vi.fn(),
  },
  storeMock: {
    dialogActive: false,
    isIngressSession: false,
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
    error: vi.fn(),
  },
}));

function withMicrophone(): void {
  Object.defineProperty(window, "isSecureContext", {
    value: true,
    configurable: true,
  });
  Object.defineProperty(navigator, "mediaDevices", {
    value: { getUserMedia: vi.fn() },
    configurable: true,
  });
}

function withoutMicrophone(): void {
  Object.defineProperty(navigator, "mediaDevices", {
    value: undefined,
    configurable: true,
  });
}

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

function speakTab(wrapper: ReturnType<typeof mountDialog>) {
  const tab = wrapper
    .findAll("button")
    .find((button) => button.text() === "play_announcement_mode_speak");
  if (!tab) throw new Error("speak tab not rendered");
  return tab;
}

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
    apiMock.isRemoteConnection.value = false;
    storeMock.dialogActive = false;
    apiMock.getPlayerConfigValue.mockResolvedValue(true);
    withoutMicrophone();
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

  it("does not send a message that is only whitespace", async () => {
    const wrapper = mountDialog();

    eventbus.emit("playAnnouncementDialog", { playerId: "kitchen" });
    await flushPromises();

    await wrapper.get("textarea").setValue("   ");
    await wrapper.get("form").trigger("submit");
    await flushPromises();

    expect(apiMock.playerCommandPlayAnnouncement).not.toHaveBeenCalled();
  });

  it("starts the chime toggle at the player's own setting", async () => {
    apiMock.getPlayerConfigValue.mockResolvedValue(false);
    apiMock.playerCommandPlayAnnouncement.mockResolvedValue(undefined);
    const wrapper = mountDialog();

    eventbus.emit("playAnnouncementDialog", { playerId: "kitchen" });
    await flushPromises();

    expect(apiMock.getPlayerConfigValue).toHaveBeenCalledWith(
      "kitchen",
      "tts_pre_announce",
    );
    await wrapper.get("textarea").setValue("Dinner is ready");
    await wrapper.get("form").trigger("submit");
    await flushPromises();

    expect(apiMock.playerCommandPlayAnnouncement).toHaveBeenCalledWith(
      "kitchen",
      "Dinner is ready",
      { preAnnounce: false },
    );
  });

  it("keeps the microphone out of the dialog when it cannot be used", async () => {
    const wrapper = mountDialog();

    eventbus.emit("playAnnouncementDialog", { playerId: "kitchen" });
    await flushPromises();

    expect(wrapper.text()).not.toContain("play_announcement_mode_speak");
    expect(
      wrapper.find('[aria-label="play_announcement_hold_to_speak"]').exists(),
    ).toBe(false);
  });

  it("offers the microphone as a second way to announce", async () => {
    withMicrophone();
    const wrapper = mountDialog();

    eventbus.emit("playAnnouncementDialog", { playerId: "kitchen" });
    await flushPromises();

    expect(wrapper.text()).toContain("play_announcement_mode_speak");
    // typing stays the default, so the dialog opens unchanged
    expect(wrapper.find("textarea").exists()).toBe(true);

    // reka-ui switches tabs on mousedown, not on click
    await speakTab(wrapper).trigger("mousedown", { button: 0 });

    expect(wrapper.find("textarea").exists()).toBe(false);
    expect(
      wrapper.find('[aria-label="play_announcement_hold_to_speak"]').exists(),
    ).toBe(true);
    expect(
      wrapper
        .findAll("button")
        .some(
          (button) => button.attributes("form") === "play-announcement-form",
        ),
    ).toBe(false);
  });

  it("does not offer the microphone on a remote connection", async () => {
    withMicrophone();
    apiMock.isRemoteConnection.value = true;
    const wrapper = mountDialog();

    eventbus.emit("playAnnouncementDialog", { playerId: "kitchen" });
    await flushPromises();

    expect(wrapper.text()).not.toContain("play_announcement_mode_speak");
  });

  it("does not carry the previous message over to the next announcement", async () => {
    apiMock.playerCommandPlayAnnouncement.mockResolvedValue(undefined);
    const wrapper = mountDialog();

    eventbus.emit("playAnnouncementDialog", { playerId: "kitchen" });
    await flushPromises();
    await wrapper.get("textarea").setValue("Dinner is ready");
    await wrapper.get("form").trigger("submit");
    await flushPromises();

    eventbus.emit("playAnnouncementDialog", { playerId: "kitchen" });
    await flushPromises();

    expect(wrapper.get("textarea").element.value).toBe("");
  });
});
