import PlayerBarPlayerButton from "@/layouts/default/PlayerOSD/PlayerBarPlayerButton.vue";
import { store } from "@/plugins/store";
import { mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";

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

function mountPlayerButton() {
  return mount(PlayerBarPlayerButton, {
    global: {
      mocks: { $t: (key: string) => key },
      stubs: { PlayerIcon: true },
    },
  });
}

describe("PlayerBarPlayerButton", () => {
  beforeEach(() => {
    testStore.activePlayer = undefined;
    testStore.showPlayersMenu = false;
  });

  it("announces the player list panel it opens", async () => {
    testStore.activePlayer = { name: "Kitchen" };
    const button = mountPlayerButton().get("#player-select-button");

    expect(button.attributes("aria-haspopup")).toBe("dialog");
    expect(button.attributes("aria-expanded")).toBe("false");
    expect(button.attributes("aria-label")).toBe(
      "tooltip.select_player: Kitchen",
    );
    // a button that opens a panel reports its state through aria-expanded alone
    expect(button.attributes("aria-pressed")).toBeUndefined();

    await button.trigger("click");

    expect(testStore.showPlayersMenu).toBe(true);
    expect(button.attributes("aria-expanded")).toBe("true");
  });

  it("names the empty selection when no player is active", () => {
    const button = mountPlayerButton().get("#player-select-button");

    expect(button.attributes("aria-label")).toBe(
      "tooltip.select_player: no_player",
    );
    expect(button.text()).toContain("no_player");
  });
});
