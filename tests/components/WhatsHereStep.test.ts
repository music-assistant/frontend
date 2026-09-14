// Imported once, outside any test: pulling the card, empty and item components
// in is the expensive part, and the import phase is not on a test's clock.
import WhatsHereStep from "@/components/onboarding/steps/WhatsHereStep.vue";
import {
  PlayerType,
  ProviderType,
  type Player,
  type ProviderInstance,
  type User,
} from "@/plugins/api/interfaces";
import { mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { user } from "../fixtures/user";

const { apiMock, routerMock, storeMock, webPlayerMock } = vi.hoisted(() => ({
  apiMock: {
    players: {} as Record<string, Player>,
    providers: {} as Record<string, ProviderInstance>,
    providerManifests: {} as Record<string, { builtin: boolean; name: string }>,
  },
  routerMock: { push: vi.fn(), replace: vi.fn() },
  storeMock: {
    currentUser: undefined as User | undefined,
    companionPlayerId: undefined,
    // the flag the player bar's own button raises to open the picker
    showPlayersMenu: false,
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

vi.mock("vue-router", () => ({ useRouter: () => routerMock }));

// both icons reach for artwork and a theme this bare mount does not set up;
// what they stand for is covered where they live
vi.mock("@/components/ProviderIcon.vue", () => ({
  default: {
    name: "ProviderIcon",
    props: ["domain", "size"],
    template: "<i />",
  },
}));

vi.mock("@/components/PlayerIcon.vue", () => ({
  default: { name: "PlayerIcon", props: ["icon", "size"], template: "<i />" },
}));

function addSource(instanceId: string, name: string, builtin = false) {
  const domain = instanceId.split("--")[0];
  apiMock.providers[instanceId] = {
    instance_id: instanceId,
    domain,
    name,
    type: ProviderType.MUSIC,
    supported_features: [],
    available: true,
    is_streaming_provider: null,
  };
  apiMock.providerManifests[domain] = { builtin, name: `${domain} manifest` };
}

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
  return mount(WhatsHereStep, {
    global: {
      mocks: {
        // echo the count back, so a test can tell which number it was given
        $t: (key: string, params?: Record<string, unknown>) =>
          params?.count != null ? `${key}:${params.count}` : key,
      },
    },
  });
}

function texts(wrapper: ReturnType<typeof mountStep>, testId: string) {
  return wrapper.findAll(`[data-testid=${testId}]`).map((row) => row.text());
}

describe("WhatsHereStep", () => {
  beforeEach(() => {
    apiMock.players = {};
    apiMock.providers = {};
    apiMock.providerManifests = {};
    storeMock.currentUser = user({ user_id: "sam-1", username: "sam" });
    storeMock.showPlayersMenu = false;
    webPlayerMock.player_id = null;
    routerMock.push.mockReset();
  });

  it("names the music the member can listen to", () => {
    addSource("spotify--1", "Spotify");
    addSource("filesystem--1", "Our music");
    // the server ships this one: nobody in the household chose it
    addSource("builtin--1", "Builtin", true);

    const wrapper = mountStep();

    expect(texts(wrapper, "onboarding-music-source")).toEqual([
      "Our music",
      "Spotify",
    ]);
    expect(wrapper.find("[data-testid=onboarding-more-sources]").exists()).toBe(
      false,
    );

    wrapper.unmount();
  });

  it("leaves out a source that is not there to listen to right now", () => {
    addSource("spotify--1", "Spotify");
    addSource("subsonic--1", "Subsonic");
    apiMock.providers["subsonic--1"].available = false;

    const wrapper = mountStep();

    // a source that failed to load plays nothing; the admin hears about it on
    // the settings page, and the member is not sent to something broken
    expect(texts(wrapper, "onboarding-music-source")).toEqual(["Spotify"]);

    wrapper.unmount();
  });

  it("leaves the source icons to the names beside them", () => {
    addSource("spotify--1", "Spotify");

    const wrapper = mountStep();

    // the row already says which source it is
    expect(
      wrapper.findComponent({ name: "ProviderIcon" }).attributes("aria-hidden"),
    ).toBe("true");

    wrapper.unmount();
  });

  it("counts the sources it does not name", () => {
    for (let index = 0; index < 8; index++) {
      addSource(`provider-${index}--1`, `Source ${index}`);
    }

    const wrapper = mountStep();

    expect(texts(wrapper, "onboarding-music-source")).toHaveLength(6);
    expect(wrapper.find("[data-testid=onboarding-more-sources]").text()).toBe(
      "onboarding.steps.whats_here.more_count:2",
    );

    wrapper.unmount();
  });

  it("says who to ask when there is nothing to listen to", () => {
    const wrapper = mountStep();

    expect(wrapper.text()).toContain(
      "onboarding.steps.whats_here.listen.empty",
    );
    // nothing to browse either, so nowhere to send them
    expect(wrapper.find("[data-testid=onboarding-browse]").exists()).toBe(
      false,
    );

    wrapper.unmount();
  });

  it("opens the music from the card", async () => {
    addSource("spotify--1", "Spotify");

    const wrapper = mountStep();
    await wrapper.find("[data-testid=onboarding-browse]").trigger("click");

    expect(routerMock.push).toHaveBeenCalledWith({ name: "browse" });

    wrapper.unmount();
  });

  it("lists the players the member may play to", () => {
    addPlayer("kitchen", { name: "Kitchen" });
    addPlayer("study", { name: "Study" });
    // the pickers leave these out, and so does the welcome
    addPlayer("hidden", { name: "Hidden", hide_in_ui: true });
    addPlayer("off", { name: "Switched off", enabled: false });
    addPlayer("gone", { name: "Unavailable", available: false });
    addPlayer("member", { name: "Grouped", synced_to: "kitchen" });

    const wrapper = mountStep();

    expect(texts(wrapper, "onboarding-player")).toEqual(["Kitchen", "Study"]);
    // no settings links: a member has no player settings to open
    expect(wrapper.text()).toContain(
      "onboarding.steps.whats_here.players.hint",
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
    // listed, and the rest by name: the welcome is no exception
    expect(texts(wrapper, "onboarding-player")).toEqual([
      "This browser",
      "Alpha",
      "Zebra",
    ]);

    wrapper.unmount();
  });

  it("opens the player picker the member will keep using", async () => {
    addPlayer("kitchen", { name: "Kitchen" });

    const wrapper = mountStep();
    await wrapper.find("[data-testid=onboarding-pick-player]").trigger("click");

    // a member has no players settings page; the picker the player bar opens
    // is where they choose what to play to
    expect(storeMock.showPlayersMenu).toBe(true);

    wrapper.unmount();
  });

  it("counts the players it does not name", () => {
    for (let index = 0; index < 7; index++) {
      addPlayer(`player-${index}`, { name: `Player ${index}` });
    }

    const wrapper = mountStep();

    expect(texts(wrapper, "onboarding-player")).toHaveLength(6);
    expect(wrapper.find("[data-testid=onboarding-more-players]").text()).toBe(
      "onboarding.steps.whats_here.more_count:1",
    );

    wrapper.unmount();
  });

  it("says who to ask when there is no player", () => {
    addPlayer("hidden", { name: "Hidden", hide_in_ui: true });

    const wrapper = mountStep();

    expect(texts(wrapper, "onboarding-player")).toEqual([]);
    expect(wrapper.text()).toContain(
      "onboarding.steps.whats_here.players.empty",
    );
    // nothing to pick either
    expect(wrapper.find("[data-testid=onboarding-pick-player]").exists()).toBe(
      false,
    );
    // nothing to control, so nothing about controlling it
    expect(wrapper.text()).not.toContain(
      "onboarding.steps.whats_here.players.hint",
    );

    wrapper.unmount();
  });
});
