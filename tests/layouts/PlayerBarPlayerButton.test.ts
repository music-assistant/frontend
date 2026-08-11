import PlayerBarPlayerButton from "@/layouts/default/PlayerOSD/PlayerBarPlayerButton.vue";
import { store } from "@/plugins/store";
import { mount, type VueWrapper } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/plugins/store", async () => {
  const { reactive } = await vi.importActual<typeof import("vue")>("vue");
  return {
    store: reactive({
      activePlayer: undefined,
      showPlayersMenu: false,
    }),
  };
});

vi.mock("@/plugins/i18n", () => ({
  $t: (key: string) => key,
}));

interface TestStore {
  activePlayer?: { name: string };
  showPlayersMenu: boolean;
}

const testStore = store as unknown as TestStore;

let wrapper: VueWrapper | undefined;

function mountPlayerButton() {
  wrapper = mount(PlayerBarPlayerButton, {
    global: { stubs: { PlayerIcon: true } },
  });
  return wrapper.get("#player-select-button");
}

describe("PlayerBarPlayerButton", () => {
  beforeEach(() => {
    testStore.activePlayer = undefined;
    testStore.showPlayersMenu = false;
  });

  afterEach(() => {
    wrapper?.unmount();
    wrapper = undefined;
  });

  it("announces the player list panel it opens", async () => {
    testStore.activePlayer = { name: "Kitchen" };
    const button = mountPlayerButton();

    expect(button.attributes("aria-haspopup")).toBe("dialog");
    expect(button.attributes("aria-expanded")).toBe("false");
    expect(button.attributes("aria-label")).toBe(
      "tooltip.select_player: Kitchen",
    );
    // a button that opens a panel reports its state through aria-expanded alone
    expect(button.attributes("aria-pressed")).toBeUndefined();
    expect(button.text()).toContain("Kitchen");

    await button.trigger("click");

    expect(testStore.showPlayersMenu).toBe(true);
    expect(button.attributes("aria-expanded")).toBe("true");
  });

  it("names the empty selection when no player is active", () => {
    const button = mountPlayerButton();

    expect(button.attributes("aria-label")).toBe(
      "tooltip.select_player: no_player",
    );
    expect(button.text()).toContain("no_player");
  });
});
