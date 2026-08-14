import PlayerRenameDialog from "@/components/PlayerRenameDialog.vue";
import type { Player } from "@/plugins/api/interfaces";
import { eventbus } from "@/plugins/eventbus";
import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
// the real dialog only mounts its content while it is open, so the stub does too
const DialogStub = {
  props: ["open"],
  emits: ["update:open"],
  template: `<div v-if="open" class="rename-dialog"><slot /></div>`,
};
const InputStub = {
  props: ["modelValue", "placeholder"],
  emits: ["update:modelValue"],
  template: `
    <input
      :value="modelValue"
      :placeholder="placeholder"
      @input="$emit('update:modelValue', $event.target.value)"
    />
  `,
};

function mountDialog() {
  return mount(PlayerRenameDialog, {
    global: {
      mocks: {
        $t: (key: string) => key,
      },
      stubs: {
        Button: {
          template: "<button><slot /></button>",
        },
        Dialog: DialogStub,
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

function openRenameDialog(evt: {
  playerId: string;
  name?: string | null;
  defaultName?: string | null;
}) {
  eventbus.emit("playerRenameDialog", evt);
  return flushPromises();
}

describe("PlayerRenameDialog", () => {
  // the dialog is mounted once for the whole app and unsubscribes on unmount, so a
  // leaked instance would answer the next test's event as well
  enableAutoUnmount(afterEach);

  beforeEach(() => {
    vi.clearAllMocks();
    apiMock.players = {
      kitchen: { player_id: "kitchen", name: "Kitchen" } as Player,
    };
    apiMock.savePlayerConfig.mockResolvedValue({});
    storeMock.dialogActive = false;
  });

  it("opens on the rename event with the name the player carries", async () => {
    const wrapper = mountDialog();
    expect(wrapper.find(".rename-dialog").exists()).toBe(false);

    await openRenameDialog({
      playerId: "kitchen",
      name: "Kitchen",
      defaultName: "Chromecast",
    });

    expect(wrapper.find(".rename-dialog").exists()).toBe(true);
    expect(wrapper.get("input").element.value).toBe("Kitchen");
    // the name the player falls back to, so clearing the field is not a leap of faith
    expect(wrapper.get("input").attributes("placeholder")).toBe("Chromecast");
    expect(storeMock.dialogActive).toBe(true);
  });

  it("persists and applies a trimmed player name", async () => {
    const wrapper = mountDialog();
    await openRenameDialog({ playerId: "kitchen", name: "Kitchen" });

    await wrapper.get("input").setValue("  Lounge  ");
    await wrapper.get("form").trigger("submit");
    await flushPromises();

    expect(apiMock.savePlayerConfig).toHaveBeenCalledWith("kitchen", {
      name: "Lounge",
    });
    expect(apiMock.players.kitchen.name).toBe("Lounge");
    expect(toastSuccess).toHaveBeenCalledWith("settings.player_saved");
    expect(wrapper.find(".rename-dialog").exists()).toBe(false);
    expect(storeMock.dialogActive).toBe(false);
  });

  it("hands the player back to its default name when the field is cleared", async () => {
    const wrapper = mountDialog();
    await openRenameDialog({
      playerId: "kitchen",
      name: "Kitchen",
      defaultName: "Chromecast",
    });

    await wrapper.get("input").setValue("");
    await wrapper.get("form").trigger("submit");
    await flushPromises();

    expect(apiMock.savePlayerConfig).toHaveBeenCalledWith("kitchen", {
      name: null,
    });
    expect(apiMock.players.kitchen.name).toBe("Chromecast");
  });

  it("keeps the dialog open when saving fails", async () => {
    apiMock.savePlayerConfig.mockRejectedValue(new Error("Save failed"));
    const wrapper = mountDialog();
    await openRenameDialog({ playerId: "kitchen", name: "Kitchen" });

    await wrapper.get("input").setValue("Lounge");
    await wrapper.get("form").trigger("submit");
    await flushPromises();

    expect(apiMock.players.kitchen.name).toBe("Kitchen");
    expect(toastError).toHaveBeenCalledWith("Error: Save failed");
    expect(wrapper.find(".rename-dialog").exists()).toBe(true);
  });

  it("renames the player from the latest event rather than the previous one", async () => {
    apiMock.players.office = { player_id: "office", name: "Office" } as Player;
    const wrapper = mountDialog();
    await openRenameDialog({ playerId: "kitchen", name: "Kitchen" });
    await wrapper.get("form").trigger("submit");
    await flushPromises();

    await openRenameDialog({ playerId: "office", name: null });
    expect(wrapper.get("input").element.value).toBe("");

    await wrapper.get("input").setValue("Study");
    await wrapper.get("form").trigger("submit");
    await flushPromises();

    expect(apiMock.savePlayerConfig).toHaveBeenLastCalledWith("office", {
      name: "Study",
    });
  });
});
