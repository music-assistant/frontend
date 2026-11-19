import MultiChannelPlayerDialog from "@/components/MultiChannelPlayerDialog.vue";
import {
  type Player,
  type PlayerProtocolInfo,
  ProtocolRole,
  SpeakerChannel,
} from "@/plugins/api/interfaces";
import { eventbus } from "@/plugins/eventbus";
import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { apiMock, createMultiChannelPlayer, storeMock } = vi.hoisted(() => ({
  apiMock: {
    getMultiChannelCandidates: vi.fn(),
    players: {} as Record<string, Player>,
  },
  createMultiChannelPlayer: vi.fn(),
  storeMock: {
    dialogActive: false,
  },
}));

vi.mock("@/plugins/api", () => ({
  api: apiMock,
  default: apiMock,
}));

vi.mock("@/plugins/store", () => ({
  store: storeMock,
}));

vi.mock("@/helpers/player_settings_actions", () => ({
  createMultiChannelPlayer,
  getOutputName: (protocol: PlayerProtocolInfo) => protocol.domain,
}));

vi.mock("@/helpers/players", () => ({
  getPlayerDisplayName: (player: Player) => player.name,
}));

const passthroughStub = { template: "<div><slot /></div>" };
// the real dialog only mounts its content while it is open, so the stub does too
const DialogStub = {
  props: ["open"],
  emits: ["update:open"],
  template: `<div v-if="open" class="multi-channel-dialog"><slot /></div>`,
};
const ButtonStub = {
  props: ["disabled", "loading"],
  template: `<button :disabled="disabled || loading"><slot /></button>`,
};
const InputStub = {
  props: ["modelValue"],
  emits: ["update:modelValue"],
  template: `
    <input
      :value="modelValue"
      @input="$emit('update:modelValue', $event.target.value)"
    />
  `,
};
const SelectStub = {
  name: "Select",
  props: ["modelValue", "disabled"],
  emits: ["update:modelValue"],
  template: `<div class="speaker-select" :data-disabled="disabled"><slot /></div>`,
};
const SelectItemStub = {
  name: "SelectItem",
  props: ["value"],
  template: `<div class="speaker-option"><slot /></div>`,
};

function mountDialog() {
  return mount(MultiChannelPlayerDialog, {
    global: {
      mocks: {
        // the arguments show in the text, so a test can read the names back
        $t: (key: string, args?: unknown[]) =>
          args ? `${key}(${args.join(",")})` : key,
      },
      stubs: {
        Button: ButtonStub,
        Dialog: DialogStub,
        DialogContent: passthroughStub,
        DialogDescription: passthroughStub,
        DialogFooter: passthroughStub,
        DialogHeader: passthroughStub,
        DialogTitle: passthroughStub,
        Input: InputStub,
        Label: passthroughStub,
        Select: SelectStub,
        SelectContent: passthroughStub,
        SelectItem: SelectItemStub,
        SelectTrigger: passthroughStub,
        SelectValue: passthroughStub,
      },
    },
  });
}

describe("MultiChannelPlayerDialog", () => {
  // the dialog is mounted once for the whole app and unsubscribes on unmount, so a
  // leaked instance would answer the next test's event as well
  enableAutoUnmount(afterEach);

  const onCreated = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    storeMock.dialogActive = false;
    // the office speaker is available, but the server does not list it
    apiMock.players = Object.fromEntries(
      [
        speaker("studio-left", "Studio left"),
        speaker("studio-right", "Studio right"),
        speaker("attic", "Attic"),
        speaker("office", "Office"),
      ].map((player) => [player.player_id, player]),
    );
    apiMock.getMultiChannelCandidates.mockResolvedValue([
      "studio-right",
      "studio-left",
      "attic",
    ]);
    createMultiChannelPlayer.mockResolvedValue({ player_id: "studio" });
  });

  it("opens with this speaker on the left and the other speakers to pick from", async () => {
    const wrapper = mountDialog();
    expect(wrapper.find(".multi-channel-dialog").exists()).toBe(false);

    await openDialog();

    expect(wrapper.find(".multi-channel-dialog").exists()).toBe(true);
    expect(storeMock.dialogActive).toBe(true);
    expect(apiMock.getMultiChannelCandidates).toHaveBeenCalledWith("sendspin");
    expect(channelRows(wrapper)).toEqual([
      "settings.multi_channel.channels.front_left",
      "settings.multi_channel.this_speaker(Studio left)",
      "settings.multi_channel.channels.front_right",
      "select",
    ]);
    // only what the server lists, without this speaker, in the order of their names
    expect(offeredSpeakers(wrapper)).toEqual(["attic", "studio-right"]);
    expect(
      wrapper.find('[data-testid="multi-channel-no-speakers"]').exists(),
    ).toBe(false);
    expect(createButton(wrapper).attributes("disabled")).toBeDefined();
  });

  it("offers nothing and says nothing while the list loads", async () => {
    let answer: (ids: string[]) => void = () => undefined;
    apiMock.getMultiChannelCandidates.mockReturnValueOnce(
      new Promise((resolve) => (answer = resolve)),
    );
    const wrapper = mountDialog();
    await openDialog();

    expect(offeredSpeakers(wrapper)).toEqual([]);
    expect(
      wrapper.find('[data-testid="multi-channel-no-speakers"]').exists(),
    ).toBe(false);
    expect(wrapper.get(".speaker-select").attributes("data-disabled")).toBe(
      "true",
    );

    answer(["attic"]);
    await flushPromises();
    expect(offeredSpeakers(wrapper)).toEqual(["attic"]);
  });

  it("offers the list of the latest opening when an earlier one answers late", async () => {
    let answerFirst: (ids: string[]) => void = () => undefined;
    apiMock.getMultiChannelCandidates
      .mockReturnValueOnce(new Promise((resolve) => (answerFirst = resolve)))
      .mockResolvedValueOnce(["attic"]);
    const wrapper = mountDialog();
    await openDialog();
    await openDialog();

    answerFirst(["studio-right", "attic"]);
    await flushPromises();

    expect(offeredSpeakers(wrapper)).toEqual(["attic"]);
  });

  it("names the player after both speakers and creates it with a channel for each", async () => {
    const wrapper = mountDialog();
    await openDialog();

    await pickSpeaker(wrapper, "studio-right");
    expect(wrapper.get("input").element.value).toBe("Studio");
    expect(createButton(wrapper).attributes("disabled")).toBeUndefined();

    await wrapper.get("form").trigger("submit");
    await flushPromises();

    expect(createMultiChannelPlayer).toHaveBeenCalledWith(
      "sendspin",
      "Studio",
      {
        "studio-left": SpeakerChannel.FRONT_LEFT,
        "studio-right": SpeakerChannel.FRONT_RIGHT,
      },
    );
    expect(wrapper.find(".multi-channel-dialog").exists()).toBe(false);
    expect(onCreated).toHaveBeenCalledWith("studio");
  });

  it("swaps the channels of the two speakers", async () => {
    const wrapper = mountDialog();
    await openDialog();
    await pickSpeaker(wrapper, "studio-right");

    await wrapper.get('[data-testid="multi-channel-swap"]').trigger("click");

    expect(channelRows(wrapper)).toEqual([
      "settings.multi_channel.channels.front_left",
      "select",
      "settings.multi_channel.channels.front_right",
      "settings.multi_channel.this_speaker(Studio left)",
    ]);
    await wrapper.get("form").trigger("submit");
    await flushPromises();
    expect(createMultiChannelPlayer).toHaveBeenCalledWith(
      "sendspin",
      "Studio",
      {
        "studio-left": SpeakerChannel.FRONT_RIGHT,
        "studio-right": SpeakerChannel.FRONT_LEFT,
      },
    );
  });

  it("keeps a name the user typed when another speaker is picked", async () => {
    const wrapper = mountDialog();
    await openDialog();
    await pickSpeaker(wrapper, "studio-right");

    await wrapper.get("input").setValue("  Loft  ");
    await pickSpeaker(wrapper, "attic");
    expect(wrapper.get("input").element.value).toBe("  Loft  ");

    await wrapper.get("form").trigger("submit");
    await flushPromises();
    expect(createMultiChannelPlayer).toHaveBeenCalledWith("sendspin", "Loft", {
      "studio-left": SpeakerChannel.FRONT_LEFT,
      attic: SpeakerChannel.FRONT_RIGHT,
    });
  });

  it("creates nothing without a name", async () => {
    const wrapper = mountDialog();
    await openDialog();
    await pickSpeaker(wrapper, "attic");
    // the speakers share no first word, so the user names the player
    expect(wrapper.get("input").element.value).toBe("");

    await wrapper.get("input").setValue("   ");
    expect(createButton(wrapper).attributes("disabled")).toBeDefined();
    await wrapper.get("form").trigger("submit");
    await flushPromises();

    expect(createMultiChannelPlayer).not.toHaveBeenCalled();
  });

  it("stays open when the server refuses, to change the choice", async () => {
    createMultiChannelPlayer.mockResolvedValueOnce(undefined);
    const wrapper = mountDialog();
    await openDialog();
    await pickSpeaker(wrapper, "studio-right");

    await wrapper.get("form").trigger("submit");
    await flushPromises();

    expect(createMultiChannelPlayer).toHaveBeenCalledOnce();
    expect(wrapper.find(".multi-channel-dialog").exists()).toBe(true);
    expect(onCreated).not.toHaveBeenCalled();
    expect(createButton(wrapper).attributes("disabled")).toBeUndefined();
  });

  it.each([
    ["lists only this speaker", () => Promise.resolve(["studio-left"])],
    ["can not answer", () => Promise.reject(new Error("Refused"))],
  ])(
    "says so when no other speaker can join, as the server %s",
    async (_, answer) => {
      apiMock.getMultiChannelCandidates.mockImplementationOnce(answer);
      const wrapper = mountDialog();
      await openDialog();

      expect(offeredSpeakers(wrapper)).toEqual([]);
      expect(
        wrapper.find('[data-testid="multi-channel-no-speakers"]').exists(),
      ).toBe(true);
      expect(wrapper.get(".speaker-select").attributes("data-disabled")).toBe(
        "true",
      );
    },
  );

  function openDialog() {
    eventbus.emit("multiChannelPlayerDialog", {
      playerId: "studio-left",
      playerName: "Studio left",
      protocol: sendspinProtocol(),
      onCreated,
    });
    return flushPromises();
  }
});

async function pickSpeaker(
  wrapper: ReturnType<typeof mountDialog>,
  playerId: string,
) {
  wrapper.getComponent(SelectStub).vm.$emit("update:modelValue", playerId);
  await flushPromises();
}

function offeredSpeakers(wrapper: ReturnType<typeof mountDialog>): string[] {
  return wrapper
    .findAllComponents(SelectItemStub)
    .map((option) => option.props("value") as string);
}

/** The cells of the channel rows in order: a channel, then this speaker or the picker. */
function channelRows(wrapper: ReturnType<typeof mountDialog>): string[] {
  const grid = wrapper.get("form > div").element;
  return [...grid.children]
    .filter((cell) => cell.tagName !== "BUTTON")
    .map((cell) =>
      cell.classList.contains("speaker-select")
        ? "select"
        : (cell.textContent ?? "").trim(),
    );
}

function createButton(wrapper: ReturnType<typeof mountDialog>) {
  return wrapper.get('[data-testid="multi-channel-create"]');
}

function sendspinProtocol(
  overrides: Partial<PlayerProtocolInfo> = {},
): PlayerProtocolInfo {
  return {
    protocol_id: "client",
    domain: "sendspin",
    provider: "sendspin",
    role: ProtocolRole.NATIVE,
    available: true,
    active: false,
    ...overrides,
  };
}

// the dialog names the speakers the server lists, so a name is all a player needs here
function speaker(playerId: string, name: string): Player {
  return { player_id: playerId, name } as Player;
}
