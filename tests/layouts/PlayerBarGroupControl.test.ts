import PlayerBarGroupControl from "@/layouts/default/PlayerOSD/PlayerBarGroupControl.vue";
import { CircleFadingPlus, Copy } from "@lucide/vue";
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { groupSize } = vi.hoisted(() => ({ groupSize: { value: 2 } }));

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
    groupSize.value = 2;
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

  it("shows a multi-player state when a group is active", () => {
    const trigger = mountGroupButton();

    expect(trigger.attributes("aria-label")).toBe(
      "tooltip.group_members: 2 players",
    );
    expect(trigger.get(".player-bar-action-label").text()).toBe("2 players");
    expect(wrapper!.findComponent(Copy).exists()).toBe(true);
    expect(wrapper!.findComponent(CircleFadingPlus).exists()).toBe(false);
    expect(trigger.find("[data-player-group-count]").exists()).toBe(false);
  });

  it("draws each state icon at the line weight of the bar it sits in", () => {
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

    // The round floating trigger has no room for a visible label; the icon
    // carries the state visually and the accessible name still spells it out.
    expect(trigger.find(".player-bar-action-label").exists()).toBe(false);
    expect(wrapper!.findComponent(Copy).exists()).toBe(true);
    expect(trigger.attributes("aria-label")).toBe(
      "tooltip.group_members: 2 players",
    );
  });

  it("invites grouping instead of presenting one player as a group", () => {
    groupSize.value = 1;
    const trigger = mountGroupButton();

    expect(trigger.attributes("aria-label")).toBe("tooltip.group_members");
    expect(trigger.get(".player-bar-action-label").text()).toBe(
      "player_type.group",
    );
    expect(wrapper!.findComponent(CircleFadingPlus).exists()).toBe(true);
    expect(wrapper!.findComponent(Copy).exists()).toBe(false);
  });

  it("uses the add-group icon in the floating player when ungrouped", () => {
    groupSize.value = 1;
    const trigger = mountGroupButton({ floating: true });

    expect(trigger.find(".player-bar-action-label").exists()).toBe(false);
    expect(trigger.attributes("aria-label")).toBe("tooltip.group_members");
    expect(wrapper!.findComponent(CircleFadingPlus).exists()).toBe(true);
  });
});
