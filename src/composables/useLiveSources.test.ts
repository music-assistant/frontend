import { ApiCommandError } from "@/plugins/api/errors";
import {
  Scope,
  type Player,
  type PlayerSource,
} from "@/plugins/api/interfaces";
import { authManager } from "@/plugins/auth";
import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent, ref } from "vue";
import { toast } from "vue-sonner";
import { playerSource } from "../../tests/fixtures/playerSource";
import {
  getLiveSourceMenuItems,
  startLiveSource,
  useLiveSources,
} from "./useLiveSources";

const { apiMock, storeMock, routerMock, listeners, emit } = await vi.hoisted(
  async () => {
    const { reactive, ref } = await import("vue");
    const listeners: [string, (evt: unknown) => void][] = [];
    return {
      apiMock: {
        players: reactive({}) as Record<string, Player>,
        state: ref("initialized"),
        getLiveSources: vi.fn(),
        playerCommandGroupSelectSource: vi.fn(),
        subscribe: vi.fn((event: string, callback: (evt: unknown) => void) => {
          listeners.push([event, callback]);
          return () => {};
        }),
        subscribe_multi: vi.fn(
          (events: string[], callback: (evt: unknown) => void) => {
            for (const event of events) listeners.push([event, callback]);
            return () => {};
          },
        ),
      },
      // the events the composables listen to, as the api sends them
      listeners,
      emit: (event: string, data?: unknown) => {
        for (const [name, callback] of listeners) {
          if (name === event) callback({ event, data });
        }
      },
      storeMock: { hasLiveSources: false },
      routerMock: { push: vi.fn() },
    };
  },
);

vi.mock("@/plugins/api", () => ({
  api: apiMock,
  default: apiMock,
  ConnectionState: { INITIALIZED: "initialized" },
}));
vi.mock("@/plugins/store", () => ({ store: storeMock }));
vi.mock("@/plugins/router", () => ({ default: routerMock }));
vi.mock("@/plugins/auth", () => ({ authManager: { hasScope: vi.fn() } }));
vi.mock("@/plugins/i18n", () => ({ $t: (key: string) => key }));
vi.mock("vue-sonner", () => ({ toast: { error: vi.fn() } }));

const LIVE_SOURCE = playerSource({
  id: "spotify_connect--x://audio_source/den",
  name: "Spotify Connect",
  passive: false,
  owner_player_id: "den",
});
const INPUT = playerSource({
  id: "line_in",
  name: "Line-in",
  passive: false,
  is_input: true,
  owner_player_id: "living_room",
});
const UNOWNED = playerSource({
  id: "vban_receiver--y://audio_source/stream",
  name: "VBAN Receiver",
  passive: false,
});

const grant = (...scopes: Scope[]) =>
  vi
    .mocked(authManager.hasScope)
    .mockImplementation((scope) => scopes.includes(scope));

// runs a composable inside a mounted component, as it is used
const Harness = defineComponent({
  props: { setup: { type: Function, required: true } },
  setup(props) {
    props.setup();
    return () => null;
  },
});

// the selected player, with an input of its own
const livingRoom = (overrides: Partial<Player> = {}) =>
  ({
    player_id: "living_room",
    name: "Living Room",
    synced_to: null,
    source_list: [INPUT],
    ...overrides,
  }) as unknown as Player;

const mountLiveSources = (playerId: string) => {
  let result: ReturnType<typeof useLiveSources> | undefined;
  mount(Harness, {
    props: { setup: () => (result = useLiveSources(playerId)) },
  });
  return result!;
};

enableAutoUnmount(afterEach);

beforeEach(() => {
  vi.clearAllMocks();
  listeners.length = 0;
  for (const id of Object.keys(apiMock.players)) delete apiMock.players[id];
  apiMock.state.value = "initialized";
  storeMock.hasLiveSources = false;
  grant();
});

describe("startLiveSource", () => {
  it.each([
    ["a live source", LIVE_SOURCE],
    ["an input", INPUT],
  ])("selects %s on the player", async (_kind, source: PlayerSource) => {
    await startLiveSource("living_room", source);
    expect(apiMock.playerCommandGroupSelectSource).toHaveBeenCalledWith(
      "living_room",
      source.id,
    );
  });

  it("tells when it could not start it", async () => {
    apiMock.playerCommandGroupSelectSource.mockRejectedValue(
      new Error("connection lost"),
    );
    await startLiveSource("living_room", INPUT);
    expect(toast.error).toHaveBeenCalledWith("play_failed");
  });

  it.each([
    ["with", "Spotify is not signed in"],
    ["without", undefined],
  ])(
    "leaves an error of the server %s a reason to the toast of the api",
    async (_with, details) => {
      apiMock.playerCommandGroupSelectSource.mockRejectedValue(
        new ApiCommandError("failed", 1, details),
      );
      await startLiveSource("living_room", LIVE_SOURCE);
      expect(toast.error).not.toHaveBeenCalled();
    },
  );
});

describe("getLiveSourceMenuItems", () => {
  it("plays it now on the selected player", () => {
    const [playNow] = getLiveSourceMenuItems(LIVE_SOURCE, "living_room");
    expect(playNow.label).toBe("play_now");
    playNow.action!();
    expect(apiMock.playerCommandGroupSelectSource).toHaveBeenCalledWith(
      "living_room",
      LIVE_SOURCE.id,
    );
  });

  it("can not play it without a selected player", () => {
    const [playNow] = getLiveSourceMenuItems(LIVE_SOURCE, undefined);
    expect(playNow.disabled).toBe(true);
  });

  it("opens the settings of the player it belongs to", () => {
    grant(Scope.CONFIG_PLAYERS_WRITE);
    const settings = getLiveSourceMenuItems(LIVE_SOURCE, "living_room")[1];
    expect(settings.label).toBe("open_settings");
    settings.action!();
    expect(routerMock.push).toHaveBeenCalledWith("/settings/editplayer/den");
  });

  it("opens the settings of its provider for a source of no player", () => {
    grant(Scope.CONFIG_PROVIDERS_WRITE);
    const settings = getLiveSourceMenuItems(UNOWNED, "living_room")[1];
    settings.action!();
    expect(routerMock.push).toHaveBeenCalledWith(
      "/settings/editprovider/vban_receiver--y",
    );
  });

  it("has no settings for a role that can not change them", () => {
    grant(Scope.CONFIG_PROVIDERS_WRITE);
    expect(getLiveSourceMenuItems(LIVE_SOURCE, "living_room")).toHaveLength(1);
    grant(Scope.CONFIG_PLAYERS_WRITE);
    expect(getLiveSourceMenuItems(UNOWNED, "living_room")).toHaveLength(1);
  });
});

describe("useLiveSources", () => {
  it("lists what the selected player can start, and follows another player", async () => {
    apiMock.getLiveSources.mockResolvedValue([INPUT]);
    const playerId = ref<string | undefined>("living_room");
    let sources: ReturnType<typeof useLiveSources>["sources"] | undefined;
    mount(Harness, {
      props: { setup: () => ({ sources } = useLiveSources(playerId)) },
    });
    await flushPromises();
    expect(apiMock.getLiveSources).toHaveBeenLastCalledWith("living_room");
    expect(sources!.value).toEqual([INPUT]);

    apiMock.getLiveSources.mockResolvedValue([LIVE_SOURCE]);
    playerId.value = "den";
    await flushPromises();
    expect(apiMock.getLiveSources).toHaveBeenLastCalledWith("den");
    expect(sources!.value).toEqual([LIVE_SOURCE]);
  });

  it("lists nothing without a selected player", async () => {
    let sources: ReturnType<typeof useLiveSources>["sources"] | undefined;
    mount(Harness, {
      props: { setup: () => ({ sources } = useLiveSources(undefined)) },
    });
    await flushPromises();
    expect(apiMock.getLiveSources).not.toHaveBeenCalled();
    expect(sources!.value).toEqual([]);
  });

  it("loads again when players or providers come and go", async () => {
    apiMock.getLiveSources.mockResolvedValue([]);
    const { sources } = mountLiveSources("living_room");
    await flushPromises();
    apiMock.getLiveSources.mockResolvedValue([LIVE_SOURCE]);
    emit("player_added");
    await flushPromises();
    expect(sources.value).toEqual([LIVE_SOURCE]);
  });

  it("drops the sources of a player that gets disabled", async () => {
    apiMock.getLiveSources.mockResolvedValue([INPUT, LIVE_SOURCE]);
    const { sources } = mountLiveSources("living_room");
    await flushPromises();

    apiMock.getLiveSources.mockResolvedValue([INPUT]);
    emit("player_updated", { player_id: "den", enabled: true });
    await flushPromises();
    expect(apiMock.getLiveSources).toHaveBeenCalledTimes(1);
    emit("player_updated", { player_id: "den", enabled: false });
    await flushPromises();
    expect(sources.value).toEqual([INPUT]);
  });

  it("drops the inputs of the player when it joins a group", async () => {
    apiMock.players.living_room = livingRoom();
    apiMock.getLiveSources.mockResolvedValue([INPUT, LIVE_SOURCE]);
    const { sources } = mountLiveSources("living_room");
    await flushPromises();
    expect(sources.value).toEqual([INPUT, LIVE_SOURCE]);

    apiMock.getLiveSources.mockResolvedValue([LIVE_SOURCE]);
    apiMock.players.living_room = livingRoom({ synced_to: "den" });
    await flushPromises();
    expect(sources.value).toEqual([LIVE_SOURCE]);
  });

  it("lists an input the player gets", async () => {
    apiMock.players.living_room = livingRoom({ source_list: [] });
    apiMock.getLiveSources.mockResolvedValue([LIVE_SOURCE]);
    const { sources } = mountLiveSources("living_room");
    await flushPromises();

    apiMock.getLiveSources.mockResolvedValue([INPUT, LIVE_SOURCE]);
    apiMock.players.living_room = livingRoom();
    await flushPromises();
    expect(sources.value).toEqual([INPUT, LIVE_SOURCE]);
  });

  it("follows an input that is renamed on the device", async () => {
    apiMock.players.living_room = livingRoom();
    apiMock.getLiveSources.mockResolvedValue([INPUT]);
    const { sources } = mountLiveSources("living_room");
    await flushPromises();

    const renamed = { ...INPUT, name: "Turntable" };
    apiMock.getLiveSources.mockResolvedValue([renamed]);
    apiMock.players.living_room = livingRoom({ source_list: [renamed] });
    await flushPromises();
    expect(sources.value).toEqual([renamed]);
  });

  it("does not load again when the player only plays on", async () => {
    apiMock.players.living_room = livingRoom();
    apiMock.getLiveSources.mockResolvedValue([INPUT]);
    mountLiveSources("living_room");
    await flushPromises();

    apiMock.players.living_room = livingRoom({ volume_level: 40 });
    await flushPromises();
    expect(apiMock.getLiveSources).toHaveBeenCalledTimes(1);
  });

  it("loads again after a reconnect", async () => {
    apiMock.getLiveSources.mockRejectedValue(new Error("connection lost"));
    const { sources, failed } = mountLiveSources("living_room");
    await flushPromises();
    expect(failed.value).toBe(true);

    apiMock.getLiveSources.mockResolvedValue([LIVE_SOURCE]);
    apiMock.state.value = "reconnecting";
    await flushPromises();
    apiMock.state.value = "initialized";
    await flushPromises();
    expect(failed.value).toBe(false);
    expect(sources.value).toEqual([LIVE_SOURCE]);
  });
});

describe("trackLiveSources", () => {
  // it subscribes once per app, so each test gets a fresh module
  const freshTracker = async () => {
    vi.resetModules();
    return (await import("./useLiveSources")).trackLiveSources;
  };

  it("shows the menu item while the user can start a live source", async () => {
    apiMock.getLiveSources.mockResolvedValue([LIVE_SOURCE]);
    (await freshTracker())();
    await flushPromises();
    expect(apiMock.getLiveSources).toHaveBeenCalledWith(undefined, {
      suppressGlobalError: true,
    });
    expect(storeMock.hasLiveSources).toBe(true);
  });

  it("leaves it out for a server without the list", async () => {
    apiMock.getLiveSources.mockRejectedValue(
      new ApiCommandError("Invalid command", 1),
    );
    (await freshTracker())();
    await flushPromises();
    expect(storeMock.hasLiveSources).toBe(false);
  });

  it("keeps the menu item when a check fails", async () => {
    apiMock.getLiveSources.mockResolvedValue([LIVE_SOURCE]);
    const track = await freshTracker();
    track();
    await flushPromises();
    apiMock.getLiveSources.mockRejectedValue(new Error("connection lost"));
    track();
    await flushPromises();
    expect(storeMock.hasLiveSources).toBe(true);
  });

  it("keeps the answer of the latest check", async () => {
    let answerFirst: (sources: PlayerSource[]) => void = () => {};
    apiMock.getLiveSources
      .mockReturnValueOnce(new Promise((resolve) => (answerFirst = resolve)))
      .mockResolvedValueOnce([LIVE_SOURCE]);
    const track = await freshTracker();
    track();
    track();
    await flushPromises();
    answerFirst([]);
    await flushPromises();
    expect(storeMock.hasLiveSources).toBe(true);
  });

  it("refreshes on every call, and on players and providers that come and go", async () => {
    apiMock.getLiveSources.mockResolvedValue([]);
    const track = await freshTracker();
    track();
    track();
    await flushPromises();
    expect(apiMock.getLiveSources).toHaveBeenCalledTimes(2);
    emit("providers_updated");
    await flushPromises();
    expect(apiMock.getLiveSources).toHaveBeenCalledTimes(3);
  });

  it("leaves the menu item out once a disabled player took the last source", async () => {
    apiMock.getLiveSources.mockResolvedValue([LIVE_SOURCE]);
    (await freshTracker())();
    await flushPromises();

    apiMock.getLiveSources.mockResolvedValue([]);
    emit("player_updated", { player_id: "den", enabled: true });
    await flushPromises();
    expect(storeMock.hasLiveSources).toBe(true);
    emit("player_updated", { player_id: "den", enabled: false });
    await flushPromises();
    expect(storeMock.hasLiveSources).toBe(false);
  });
});
