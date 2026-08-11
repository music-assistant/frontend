import PlayerBarGroupControl from "@/layouts/default/PlayerOSD/PlayerBarGroupControl.vue";
import { mount, type VueWrapper } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/plugins/api", async () => {
  const { reactive } = await vi.importActual<typeof import("vue")>("vue");
  const api = reactive({ players: {} });
  return { api, default: api };
});

vi.mock("@/plugins/store", async () => {
  const { reactive } = await vi.importActual<typeof import("vue")>("vue");
  return {
    store: reactive({
      activePlayer: { player_id: "kitchen", group_members: [], type: "player" },
      mobileLayout: false,
    }),
  };
});

vi.mock("@/plugins/i18n", () => ({ $t: (key: string) => key }));

vi.mock("@/helpers/players", () => ({
  canEditPlayerGroup: () => true,
  getPlayerGroupMemberCount: () => 3,
  groupMemberPickerVisible: () => true,
}));

let wrapper: VueWrapper | undefined;

describe("PlayerBarGroupControl", () => {
  afterEach(() => {
    wrapper?.unmount();
    wrapper = undefined;
  });

  it("leaves the panel state to the popover trigger", () => {
    wrapper = mount(PlayerBarGroupControl, {
      global: { stubs: { PlayerGroupPanel: true, Teleport: true } },
    });
    const trigger = wrapper.get("[data-player-group-trigger]");

    // reka-ui's PopoverTrigger supplies the disclosure state; a second,
    // contradictory toggle state must not ride along with it
    expect(trigger.attributes("aria-expanded")).toBe("false");
    expect(trigger.attributes("aria-haspopup")).toBe("dialog");
    expect(trigger.attributes("aria-pressed")).toBeUndefined();
  });

  it("keeps the visible member count in the accessible name", () => {
    wrapper = mount(PlayerBarGroupControl, {
      global: { stubs: { PlayerGroupPanel: true, Teleport: true } },
    });
    const trigger = wrapper.get("[data-player-group-trigger]");

    expect(trigger.attributes("aria-label")).toBe(
      "tooltip.group_members: 3 players",
    );
    expect(trigger.text()).toContain("3 players");
  });
});
