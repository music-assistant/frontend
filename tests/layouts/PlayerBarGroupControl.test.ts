import PlayerBarGroupControl from "@/layouts/default/PlayerOSD/PlayerBarGroupControl.vue";
import { mount, type VueWrapper } from "@vue/test-utils";
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

vi.mock("@/helpers/players", () => ({
  canEditPlayerGroup: () => true,
  getPlayerGroupMemberCount: () => groupSize.value,
  groupMemberPickerVisible: () => true,
}));

let wrapper: VueWrapper | undefined;

function mountGroupButton(props: { floating?: boolean } = {}) {
  wrapper = mount(PlayerBarGroupControl, {
    props,
    global: { stubs: { PlayerGroupPanel: true, Teleport: true } },
  });
  return wrapper.get("[data-player-group-trigger]");
}

describe("PlayerBarGroupControl", () => {
  beforeEach(() => {
    groupSize.value = 3;
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

  it("draws the speaker at the line weight of the bar it sits in", () => {
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
});
