import PlayerBarGroupControl from "@/layouts/default/PlayerOSD/PlayerBarGroupControl.vue";
import PlayerBarPlayerButton from "@/layouts/default/PlayerOSD/PlayerBarPlayerButton.vue";
import PlayerBarVolumeControl from "@/layouts/default/PlayerOSD/PlayerBarVolumeControl.vue";
import PlayerExtendedControls from "@/layouts/default/PlayerOSD/PlayerExtendedControls.vue";
import { shallowMount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/plugins/store", async () => {
  const { reactive } = await vi.importActual<typeof import("vue")>("vue");
  return {
    store: reactive({
      activePlayer: { player_id: "kitchen" },
    }),
  };
});

describe("PlayerExtendedControls", () => {
  it("places the current player before its group control", () => {
    const wrapper = shallowMount(PlayerExtendedControls);
    const row = wrapper.get(".player-bar-action-row");
    const targetControls = wrapper.get(".player-bar-target-controls");

    expect(
      Array.from(row.element.children).map((element) => element.className),
    ).toEqual([
      "player-bar-volume-control-slot flex items-center",
      "player-bar-target-controls flex min-w-0 items-center",
    ]);
    expect(
      Array.from(targetControls.element.children).map((element) =>
        element.tagName.toLowerCase(),
      ),
    ).toEqual([
      "player-bar-player-button-stub",
      "player-bar-group-control-stub",
    ]);
    expect(wrapper.findComponent(PlayerBarVolumeControl).exists()).toBe(true);
    expect(wrapper.findComponent(PlayerBarPlayerButton).exists()).toBe(true);
    expect(wrapper.findComponent(PlayerBarGroupControl).exists()).toBe(true);
  });
});
