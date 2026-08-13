import type { LiveAnnouncementState } from "@/composables/useLiveAnnouncement";
import PlayAnnouncementDialog from "@/layouts/default/PlayAnnouncementDialog.vue";
import type { Player } from "@/plugins/api/interfaces";
import { eventbus } from "@/plugins/eventbus";
import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { apiMock, storeMock, toastSuccess, liveMock } = await vi.hoisted(
  async () => {
    // a real ref, like the api itself exposes, so the dialog reacts to it changing
    const { ref, shallowRef } = await import("vue");
    return {
      apiMock: {
        players: {} as Record<string, Player>,
        baseUrl: "https://music.example",
        isRemoteConnection: shallowRef(false),
        playerCommandPlayAnnouncement: vi.fn(),
        getPlayerConfigValue: vi.fn(),
      },
      storeMock: {
        dialogActive: false,
        isIngressSession: false,
      },
      toastSuccess: vi.fn(),
      liveMock: {
        state: ref<LiveAnnouncementState>("idle"),
        elapsedSeconds: ref(0),
        start: vi.fn(),
        stop: vi.fn(),
        cancel: vi.fn(),
      },
    };
  },
);

vi.mock("@/plugins/api", () => ({
  api: apiMock,
  default: apiMock,
}));

// only the recording itself is faked; whether the microphone can be used at all
// stays the real check, which most of these tests are about
vi.mock("@/composables/useLiveAnnouncement", async (importOriginal) => ({
  ...(await importOriginal<
    typeof import("@/composables/useLiveAnnouncement")
  >()),
  useLiveAnnouncement: () => liveMock,
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

// the microphone gates live on globals, so they are restored between tests rather
// than left for whatever runs next in this environment
const originalSecureContext = Object.getOwnPropertyDescriptor(
  window,
  "isSecureContext",
);
const originalMediaDevices = Object.getOwnPropertyDescriptor(
  navigator,
  "mediaDevices",
);

function restoreMicrophoneGlobals(): void {
  // a property that did not exist is deleted rather than left defined as undefined,
  // which an `in` check elsewhere would still see
  if (originalSecureContext) {
    Object.defineProperty(window, "isSecureContext", originalSecureContext);
  } else {
    Reflect.deleteProperty(window, "isSecureContext");
  }
  if (originalMediaDevices) {
    Object.defineProperty(navigator, "mediaDevices", originalMediaDevices);
  } else {
    Reflect.deleteProperty(navigator, "mediaDevices");
  }
}

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

function micButton(wrapper: ReturnType<typeof mountDialog>) {
  return wrapper.get('[aria-label="play_announcement_hold_to_speak"]');
}

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
    apiMock.baseUrl = "https://music.example";
    apiMock.isRemoteConnection.value = false;
    liveMock.state.value = "idle";
    storeMock.dialogActive = false;
    apiMock.getPlayerConfigValue.mockResolvedValue(true);
    withoutMicrophone();
  });

  afterEach(() => {
    restoreMicrophoneGlobals();
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

  it("falls back to typing when the microphone is withdrawn mid-dialog", async () => {
    withMicrophone();
    // a remote session has no endpoint of its own; it streams over its channel
    apiMock.isRemoteConnection.value = true;
    apiMock.baseUrl = "";
    const wrapper = mountDialog();

    eventbus.emit("playAnnouncementDialog", { playerId: "kitchen" });
    await flushPromises();
    await speakTab(wrapper).trigger("mousedown", { button: 0 });
    expect(wrapper.find("textarea").exists()).toBe(false);

    // losing the remote connection leaves nothing to stream to
    apiMock.isRemoteConnection.value = false;
    await flushPromises();

    // without the fallback the speak panel would stay up with no tabs and no send button
    expect(wrapper.text()).not.toContain("play_announcement_mode_speak");
    expect(wrapper.find("textarea").exists()).toBe(true);
    expect(
      wrapper
        .findAll("button")
        .some(
          (button) => button.attributes("form") === "play-announcement-form",
        ),
    ).toBe(true);
  });

  it("offers the microphone on a remote connection", async () => {
    withMicrophone();
    apiMock.isRemoteConnection.value = true;
    apiMock.baseUrl = "";
    const wrapper = mountDialog();

    eventbus.emit("playAnnouncementDialog", { playerId: "kitchen" });
    await flushPromises();

    expect(wrapper.text()).toContain("play_announcement_mode_speak");
  });

  it("keeps recording while the browser asks for microphone permission", async () => {
    withMicrophone();
    const wrapper = mountDialog();

    eventbus.emit("playAnnouncementDialog", { playerId: "kitchen" });
    await flushPromises();
    await speakTab(wrapper).trigger("mousedown", { button: 0 });
    await micButton(wrapper).trigger("pointerdown");

    expect(liveMock.start).toHaveBeenCalledWith("kitchen", true);

    // the permission bubble takes focus off the button on the first press
    liveMock.state.value = "connecting";
    await micButton(wrapper).trigger("blur");

    expect(liveMock.stop).not.toHaveBeenCalled();
  });

  it("does not open the microphone on a right click", async () => {
    withMicrophone();
    const wrapper = mountDialog();

    eventbus.emit("playAnnouncementDialog", { playerId: "kitchen" });
    await flushPromises();
    await speakTab(wrapper).trigger("mousedown", { button: 0 });
    await micButton(wrapper).trigger("pointerdown", { button: 2 });

    expect(liveMock.start).not.toHaveBeenCalled();
  });

  it("ends a recording that loses focus", async () => {
    withMicrophone();
    const wrapper = mountDialog();

    eventbus.emit("playAnnouncementDialog", { playerId: "kitchen" });
    await flushPromises();
    await speakTab(wrapper).trigger("mousedown", { button: 0 });
    await micButton(wrapper).trigger("pointerdown");

    liveMock.state.value = "recording";
    await micButton(wrapper).trigger("blur");

    expect(liveMock.stop).toHaveBeenCalled();
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
