import PlayerRenameDialog from "@/components/PlayerRenameDialog.vue";
import type { Player } from "@/plugins/api/interfaces";
import { flushPromises, mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { apiMock, storeMock, toastError, toastSuccess } = vi.hoisted(() => ({
  apiMock: {
    players: {} as Record<string, Player>,
    savePlayerConfig: vi.fn(),
  },
  storeMock: {
    dialogActive: false,
  },
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
}));

vi.mock("@/plugins/api", () => ({
  api: apiMock,
  default: apiMock,
}));

vi.mock("@/plugins/store", () => ({
  store: storeMock,
}));

vi.mock("vue-sonner", () => ({
  toast: {
    error: toastError,
    success: toastSuccess,
  },
}));

vi.mock("vue-i18n", () => ({
  useI18n: () => ({
    t: (key: string) => key,
  }),
}));

const passthroughStub = { template: "<div><slot /></div>" };
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

function mountDialog(player: Player) {
  return mount(PlayerRenameDialog, {
    props: {
      open: true,
      player,
    },
    global: {
      mocks: {
        $t: (key: string) => key,
      },
      stubs: {
        Button: {
          template: "<button><slot /></button>",
        },
        Dialog: passthroughStub,
        DialogContent: passthroughStub,
        DialogDescription: passthroughStub,
        DialogFooter: passthroughStub,
        DialogHeader: passthroughStub,
        DialogTitle: passthroughStub,
        Input: InputStub,
      },
    },
  });
}

describe("PlayerRenameDialog", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiMock.players = {};
    storeMock.dialogActive = false;
  });

  it("persists and applies a trimmed player name", async () => {
    const player = {
      player_id: "kitchen",
      name: "Kitchen",
    } as Player;
    apiMock.players[player.player_id] = player;
    apiMock.savePlayerConfig.mockResolvedValue({});
    const wrapper = mountDialog(player);

    await wrapper.get("input").setValue("  Lounge  ");
    await wrapper.get("form").trigger("submit");
    await flushPromises();

    expect(apiMock.savePlayerConfig).toHaveBeenCalledWith(player.player_id, {
      name: "Lounge",
    });
    expect(player.name).toBe("Lounge");
    expect(toastSuccess).toHaveBeenCalledWith("settings.player_saved");
    expect(wrapper.emitted("update:open")).toEqual([[false]]);
  });

  it("keeps the dialog open when saving fails", async () => {
    const player = {
      player_id: "kitchen",
      name: "Kitchen",
    } as Player;
    apiMock.players[player.player_id] = player;
    apiMock.savePlayerConfig.mockRejectedValue(new Error("Save failed"));
    const wrapper = mountDialog(player);

    await wrapper.get("input").setValue("Lounge");
    await wrapper.get("form").trigger("submit");
    await flushPromises();

    expect(player.name).toBe("Kitchen");
    expect(toastError).toHaveBeenCalledWith("Error: Save failed");
    expect(wrapper.emitted("update:open")).toBeUndefined();
  });
});
