import PlayerBarGroupControl from "@/layouts/default/PlayerOSD/PlayerBarGroupControl.vue";
import { api } from "@/plugins/api";
import { type Player, PlayerType } from "@/plugins/api/interfaces";
import { store } from "@/plugins/store";
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { groupSize } = vi.hoisted(() => ({ groupSize: { value: 3 } }));

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

vi.mock("@/helpers/players", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/helpers/players")>()),
  canEditPlayerGroup: () => true,
  getPlayerGroupMemberCount: () => groupSize.value,
  groupMemberPickerVisible: () => true,
}));

// the mock's active player is a plain field the tests set
const storeMock = store as unknown as { activePlayer: Player };
let wrapper: VueWrapper | undefined;

function mountGroupButton(props: { floating?: boolean } = {}) {
  wrapper = mount(PlayerBarGroupControl, {
    props,
    global: { stubs: { PlayerGroupPanel: true, Teleport: true } },
  });
  return wrapper.get("[data-player-group-trigger]");
}

function groupPlayer(playerId: string, overrides: Partial<Player> = {}) {
  return {
    player_id: playerId,
    name: playerId,
    type: "player",
    available: true,
    group_members: [],
    output_protocols: [],
    ...overrides,
  } as unknown as Player;
}

describe("PlayerBarGroupControl", () => {
  beforeEach(() => {
    groupSize.value = 3;
    api.players = {};
    storeMock.activePlayer = groupPlayer("kitchen");
  });

  afterEach(() => {
    wrapper?.unmount();
    wrapper = undefined;
  });

  it("leaves the panel state to the popover trigger", () => {
    const trigger = mountGroupButton();

    // reka-ui's PopoverTrigger supplies the disclosure state; a second,
    // contradictory toggle state must not ride along with it
    expect(trigger.attributes("aria-expanded")).toBe("false");
    expect(trigger.attributes("aria-haspopup")).toBe("dialog");
    expect(trigger.attributes("aria-pressed")).toBeUndefined();
  });

  // the mouse that clicked the panel shut is still on the button, and no second
  // pointerenter is coming to say so
  it("keeps the hover color when a mouse clicks the panel closed", async () => {
    const trigger = mountGroupButton();

    await trigger.trigger("pointerenter", { pointerType: "mouse" });
    await trigger.trigger("click", { button: 0, ctrlKey: false });
    await flushPromises();
    await trigger.trigger("click", { button: 0, ctrlKey: false });
    await flushPromises();

    expect(trigger.attributes("data-state")).toBe("closed");
    expect(trigger.attributes("data-suppress-hover")).toBe("false");
  });

  it("keeps the visible member count in the accessible name", () => {
    const trigger = mountGroupButton();

    expect(trigger.attributes("aria-label")).toBe(
      "tooltip.group_members: 3 players",
    );
    expect(trigger.get(".player-bar-action-label").text()).toBe("3 players");
  });

  it("shows the member count on the icon badge", () => {
    const trigger = mountGroupButton();

    expect(trigger.get("[data-player-group-count]").text()).toBe("3");
  });

  it("draws the grouping icon at the line weight of the bar it sits in", () => {
    expect(mountGroupButton().get("svg").attributes("stroke-width")).toBe(
      "1.4",
    );
    wrapper?.unmount();

    // 1.5 is the weight of the track menu the floating trigger sits next to
    expect(
      mountGroupButton({ floating: true })
        .get("svg")
        .attributes("stroke-width"),
    ).toBe("1.5");
  });

  it("drops the member count label in the floating player", () => {
    const trigger = mountGroupButton({ floating: true });

    // the round floating trigger has no room for the label, so the badge is
    // the only place the count shows; the accessible name still spells it out
    expect(trigger.find(".player-bar-action-label").exists()).toBe(false);
    expect(trigger.get("[data-player-group-count]").text()).toBe("3");
    expect(trigger.attributes("aria-label")).toBe(
      "tooltip.group_members: 3 players",
    );
  });

  it("names a single member in the singular", () => {
    groupSize.value = 1;
    const trigger = mountGroupButton();

    expect(trigger.attributes("aria-label")).toBe(
      "tooltip.group_members: 1 player_type.player",
    );
    expect(trigger.get(".player-bar-action-label").text()).toBe(
      "1 player_type.player",
    );
  });

  it("offers the players and each other kind of player that can be picked", () => {
    const kitchen = groupPlayer("kitchen", {
      can_group_with: ["lamp", "remote"],
    });
    const lamp = groupPlayer("lamp", { type: PlayerType.LIGHT });
    const remote = groupPlayer("remote", { type: PlayerType.CONTROLLER });
    api.players = { kitchen, lamp, remote };
    storeMock.activePlayer = kitchen;

    wrapper = mount(PlayerBarGroupControl, {
      global: {
        stubs: {
          PlayerGroupPanel: true,
          PopoverContent: { template: "<div><slot /></div>" },
          Teleport: true,
        },
      },
    });

    expect(
      wrapper
        .getComponent({ name: "PlayerGroupPanel" })
        .props("filterOptions")
        .map(({ key }: { key: string }) => key),
    ).toEqual(["players", "lights", "controllers"]);
  });

  it("hands the panel the members that are offline", async () => {
    const kitchen = groupPlayer("kitchen", {
      group_members: ["kitchen", "office"],
    });
    const office = groupPlayer("office", { available: false });
    api.players = { kitchen, office };
    storeMock.activePlayer = kitchen;

    // the panel's content renders in place, whether the popover is open or not
    wrapper = mount(PlayerBarGroupControl, {
      global: {
        stubs: {
          PlayerGroupPanel: true,
          PopoverContent: { template: "<div><slot /></div>" },
          Teleport: true,
        },
      },
    });

    expect(
      wrapper
        .getComponent({ name: "PlayerGroupPanel" })
        .props("members")
        .map((member: Player) => member.player_id),
    ).toEqual(["kitchen", "office"]);
  });
});
