import { ApiCommandError } from "@/plugins/api/errors";
import { Scope, type PlayerSource } from "@/plugins/api/interfaces";
import { authManager } from "@/plugins/auth";
import { flushPromises, mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { defineComponent, ref } from "vue";
import { toast } from "vue-sonner";
import { playerSource } from "../../tests/fixtures/playerSource";
import {
  getLiveSourceMenuItems,
  startLiveSource,
  useLiveSources,
} from "./useLiveSources";

const { apiMock, storeMock, routerMock } = vi.hoisted(() => ({
  apiMock: {
    players: {} as Record<string, unknown>,
    getLiveSources: vi.fn(),
    playerCommandGroupSelectSource: vi.fn(),
    subscribe_multi: vi.fn((_events: string[], _callback: () => void) => {
      return () => {};
    }),
  },
  storeMock: { hasLiveSources: false },
  routerMock: { push: vi.fn() },
}));

vi.mock("@/plugins/api", () => ({ api: apiMock, default: apiMock }));
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

beforeEach(() => {
  vi.clearAllMocks();
  apiMock.players = {};
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

  it("leaves a reason of the server to the toast of the api", async () => {
    apiMock.playerCommandGroupSelectSource.mockRejectedValue(
      new ApiCommandError("failed", 1, "Spotify is not signed in"),
    );
    await startLiveSource("living_room", LIVE_SOURCE);
    expect(toast.error).not.toHaveBeenCalled();
  });
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
    mount(Harness, {
      props: { setup: () => useLiveSources("living_room") },
    });
    await flushPromises();
    const [events, refresh] = apiMock.subscribe_multi.mock.calls[0];
    expect(events).toEqual([
      "player_added",
      "player_removed",
      "providers_updated",
    ]);
    refresh();
    await flushPromises();
    expect(apiMock.getLiveSources).toHaveBeenCalledTimes(2);
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
    storeMock.hasLiveSources = true;
    apiMock.getLiveSources.mockRejectedValue(
      new ApiCommandError("Invalid command", 1),
    );
    (await freshTracker())();
    await flushPromises();
    expect(storeMock.hasLiveSources).toBe(false);
  });

  it("refreshes on every call, and on players and providers that come and go", async () => {
    apiMock.getLiveSources.mockResolvedValue([]);
    const track = await freshTracker();
    track();
    track();
    await flushPromises();
    expect(apiMock.subscribe_multi).toHaveBeenCalledTimes(1);
    expect(apiMock.getLiveSources).toHaveBeenCalledTimes(2);
    apiMock.subscribe_multi.mock.calls[0][1]();
    await flushPromises();
    expect(apiMock.getLiveSources).toHaveBeenCalledTimes(3);
  });
});
