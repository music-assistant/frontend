import MultiChannelSubwooferDialog from "@/components/MultiChannelSubwooferDialog.vue";
import type { Player } from "@/plugins/api/interfaces";
import { eventbus } from "@/plugins/eventbus";
import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { addSubwoofer, apiMock, storeMock } = vi.hoisted(() => ({
  addSubwoofer: vi.fn(),
  apiMock: {
    getMultiChannelCandidates: vi.fn(),
    getProvider: vi.fn(),
    players: {} as Record<string, Player>,
  },
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
  addSubwoofer,
  getOutputName: (protocol: { domain: string }) => `output ${protocol.domain}`,
}));

vi.mock("@/helpers/players", () => ({
  getPlayerDisplayName: (player: Player) => player.name,
}));

const passthroughStub = { template: "<div><slot /></div>" };
// the real dialog only mounts its content while it is open, so the stub does too
const DialogStub = {
  props: ["open"],
  emits: ["update:open"],
  template: `<div v-if="open" class="subwoofer-dialog"><slot /></div>`,
};
const ButtonStub = {
  props: ["disabled", "loading"],
  template: `<button :disabled="disabled || loading"><slot /></button>`,
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
  return mount(MultiChannelSubwooferDialog, {
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
        Select: SelectStub,
        SelectContent: passthroughStub,
        SelectItem: SelectItemStub,
        SelectTrigger: passthroughStub,
        SelectValue: passthroughStub,
      },
    },
  });
}

describe("MultiChannelSubwooferDialog", () => {
  // the dialog is mounted once for the whole app and unsubscribes on unmount, so a
  // leaked instance would answer the next test's event as well
  enableAutoUnmount(afterEach);

  const onAdded = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    storeMock.dialogActive = false;
    apiMock.players = Object.fromEntries(
      [speaker("sub", "Sub"), speaker("attic", "Attic")].map((player) => [
        player.player_id,
        player,
      ]),
    );
    apiMock.getMultiChannelCandidates.mockResolvedValue(["sub", "attic"]);
    apiMock.getProvider.mockReturnValue({ domain: "sendspin" });
    addSubwoofer.mockResolvedValue(true);
  });

  it("opens with the speakers the server lists, by name", async () => {
    const wrapper = mountDialog();
    await openDialog();

    expect(storeMock.dialogActive).toBe(true);
    expect(apiMock.getMultiChannelCandidates).toHaveBeenCalledWith(
      "sendspin--1",
    );
    expect(wrapper.text()).toContain(
      "settings.multi_channel.add_subwoofer_description(Studio)",
    );
    expect(wrapper.text()).toContain(
      "settings.multi_channel.add_subwoofer_note(output sendspin,Studio)",
    );
    expect(offeredSpeakers(wrapper)).toEqual(["attic", "sub"]);
    expect(addButton(wrapper).attributes("disabled")).toBeDefined();
  });

  it("adds the speaker picked and closes", async () => {
    const wrapper = mountDialog();
    await openDialog();

    await pickSpeaker(wrapper, "sub");
    expect(addButton(wrapper).attributes("disabled")).toBeUndefined();
    await wrapper.get("form").trigger("submit");
    await flushPromises();

    expect(addSubwoofer).toHaveBeenCalledWith("studio", "Studio", "sub");
    expect(wrapper.find(".subwoofer-dialog").exists()).toBe(false);
    expect(storeMock.dialogActive).toBe(false);
    expect(onAdded).toHaveBeenCalledOnce();
  });

  it("stays open when the server refuses, to pick another speaker", async () => {
    addSubwoofer.mockResolvedValueOnce(false);
    const wrapper = mountDialog();
    await openDialog();
    await pickSpeaker(wrapper, "sub");

    await wrapper.get("form").trigger("submit");
    await flushPromises();

    expect(wrapper.find(".subwoofer-dialog").exists()).toBe(true);
    expect(onAdded).not.toHaveBeenCalled();
    expect(addButton(wrapper).attributes("disabled")).toBeUndefined();
  });

  it("says so when no speaker can join", async () => {
    apiMock.getMultiChannelCandidates.mockResolvedValueOnce([]);
    const wrapper = mountDialog();
    await openDialog();

    expect(offeredSpeakers(wrapper)).toEqual([]);
    expect(
      wrapper.find('[data-testid="multi-channel-no-speakers"]').exists(),
    ).toBe(true);
    expect(wrapper.get(".speaker-select").attributes("data-disabled")).toBe(
      "true",
    );
  });

  function openDialog() {
    eventbus.emit("multiChannelSubwooferDialog", {
      playerId: "studio",
      playerName: "Studio",
      provider: "sendspin--1",
      onAdded,
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

function addButton(wrapper: ReturnType<typeof mountDialog>) {
  return wrapper.get('[data-testid="multi-channel-add"]');
}

// the dialog names the speakers the server lists, so a name is all a player needs here
function speaker(playerId: string, name: string): Player {
  return { player_id: playerId, name } as Player;
}
