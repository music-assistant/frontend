// Imported once, outside any test: pulling the empty and item components in is
// the expensive part, and the import phase is not on a test's clock.
import YourPlayersStep from "@/components/onboarding/steps/YourPlayersStep.vue";
import { PlayerType, type Player, type User } from "@/plugins/api/interfaces";
import { mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { user } from "../fixtures/user";

const { apiMock, storeMock, webPlayerMock } = vi.hoisted(() => ({
  apiMock: { players: {} as Record<string, Player> },
  storeMock: {
    currentUser: undefined as User | undefined,
    companionPlayerId: undefined,
  },
  // the player this browser streams to, which every picker puts up front
  webPlayerMock: { player_id: null as string | null },
}));

vi.mock("@/plugins/api", () => ({ api: apiMock, default: apiMock }));

vi.mock("@/plugins/store", () => ({ store: storeMock }));

vi.mock("@/plugins/web_player", () => ({
  webPlayer: webPlayerMock,
  WebPlayerMode: {},
}));

// the icon reaches for artwork this bare mount does not set up; what it stands
// for is covered where it lives
vi.mock("@/components/PlayerIcon.vue", () => ({
  default: { name: "PlayerIcon", props: ["icon", "size"], template: "<i />" },
}));

/** Only the fields the player pickers decide visibility and naming from. */
function addPlayer(playerId: string, overrides: Partial<Player> = {}) {
  apiMock.players[playerId] = {
    player_id: playerId,
    name: playerId,
    type: PlayerType.PLAYER,
    available: true,
    enabled: true,
    hide_in_ui: false,
    synced_to: null,
    active_group: null,
    needs_setup: false,
    icon: "speaker",
    output_protocols: [],
    ...overrides,
  } as Player;
}

function mountStep() {
  return mount(YourPlayersStep, {
    global: {
      mocks: {
        // echo the count back, so a test can tell which number it was given
        $t: (key: string, params?: Record<string, unknown>) =>
          params?.count != null ? `${key}:${params.count}` : key,
      },
    },
  });
}

function names(wrapper: ReturnType<typeof mountStep>) {
  return wrapper
    .findAll("[data-testid=onboarding-player]")
    .map((row) => row.text());
}

describe("YourPlayersStep", () => {
  beforeEach(() => {
    apiMock.players = {};
    storeMock.currentUser = user({ user_id: "sam-1", username: "sam" });
    webPlayerMock.player_id = null;
  });

  it("lists the players the member may play to", () => {
    addPlayer("kitchen", { name: "Kitchen" });
    addPlayer("study", { name: "Study" });
    // the pickers leave these out, and so does this step
    addPlayer("hidden", { name: "Hidden", hide_in_ui: true });
    addPlayer("off", { name: "Switched off", enabled: false });
    addPlayer("gone", { name: "Unavailable", available: false });
    addPlayer("grouped", { name: "Grouped", synced_to: "kitchen" });

    const wrapper = mountStep();

    expect(names(wrapper)).toEqual(["Kitchen", "Study"]);
    expect(wrapper.find("[data-testid=onboarding-more-players]").exists()).toBe(
      false,
    );

    wrapper.unmount();
  });

  it("lists the players in the order every picker lists them", () => {
    addPlayer("zebra", { name: "Zebra" });
    addPlayer("alpha", { name: "Alpha" });
    addPlayer("this-browser", { name: "This browser" });
    webPlayerMock.player_id = "this-browser";

    const wrapper = mountStep();

    // the player this browser streams to comes first wherever players are
    // listed, and the rest by name: this step is no exception
    expect(names(wrapper)).toEqual(["This browser", "Alpha", "Zebra"]);

    wrapper.unmount();
  });

  it("counts the players it does not name", () => {
    for (let index = 0; index < 7; index++) {
      addPlayer(`player-${index}`, { name: `Player ${index}` });
    }

    const wrapper = mountStep();

    expect(names(wrapper)).toHaveLength(6);
    expect(wrapper.find("[data-testid=onboarding-more-players]").text()).toBe(
      "onboarding.more_count:1",
    );

    wrapper.unmount();
  });

  it("says who to ask when there is no player", () => {
    addPlayer("hidden", { name: "Hidden", hide_in_ui: true });

    const wrapper = mountStep();

    expect(names(wrapper)).toEqual([]);
    expect(wrapper.text()).toContain("onboarding.steps.your_players.empty");

    wrapper.unmount();
  });

  it("offers nothing that leaves the onboarding", () => {
    addPlayer("kitchen", { name: "Kitchen" });

    const wrapper = mountStep();

    // picking a player is the tour's to show afterwards: the step is a look at
    // what is here, with no button or link to walk out through
    expect(wrapper.findAll("button, a")).toHaveLength(0);

    wrapper.unmount();
  });
});
