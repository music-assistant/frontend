import { reactive } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  MediaType,
  type PlayerMedia,
  Player,
  PlayerQueue,
} from "@/plugins/api/interfaces";
import { playerSource } from "../fixtures/playerSource";

const storeMock = reactive({
  activePlayer: undefined as Player | undefined,
  activePlayerQueue: undefined as PlayerQueue | undefined,
});

vi.mock("@/plugins/store", () => ({ store: storeMock }));

const { useNowPlayingSource } = await import("@/composables/nowPlayingSource");

/** A player with only the fields the composable reads. */
function player(overrides: Partial<Player> = {}): Player {
  return {
    player_id: "player-1",
    powered: true,
    active_source: "player-1",
    source_list: [],
    ...overrides,
  } as Player;
}

function playerMedia(overrides: Partial<PlayerMedia> = {}): PlayerMedia {
  return {
    uri: "test://media",
    media_type: MediaType.TRACK,
    title: null,
    artist: null,
    album: null,
    image_url: null,
    palette: null,
    duration: null,
    source_id: null,
    elapsed_time: null,
    elapsed_time_last_updated: null,
    queue_item_id: null,
    ...overrides,
  };
}

beforeEach(() => {
  storeMock.activePlayer = player();
  storeMock.activePlayerQueue = undefined;
});

describe("useNowPlayingSource", () => {
  it("names the active external player source", () => {
    const source = playerSource({
      id: "spotify_connect--abc://audio_source/main",
      name: "Spotify Connect",
    });
    storeMock.activePlayer = player({
      active_source: source.id,
      source_list: [source],
    });

    const { nowPlayingSource } = useNowPlayingSource();

    expect(nowPlayingSource.value).toEqual({
      name: "Spotify Connect",
      iconDomain: "spotify_connect--abc",
    });
  });

  it("does not infer a provider for a native player source", () => {
    const source = playerSource({ id: "line-in", name: "Line In" });
    storeMock.activePlayer = player({
      active_source: source.id,
      source_list: [source],
    });

    const { nowPlayingSource } = useNowPlayingSource();

    expect(nowPlayingSource.value).toEqual({
      name: "Line In",
      iconDomain: undefined,
    });
  });

  it("keeps a radio station in the album subtitle", () => {
    storeMock.activePlayer = player({
      current_media: playerMedia({
        media_type: MediaType.RADIO,
        title: "Live track",
        album: "Radio 538",
      }),
    });

    const { nowPlayingSource, albumSubtitle } = useNowPlayingSource();

    expect(nowPlayingSource.value).toBeUndefined();
    expect(albumSubtitle.value).toBe("Radio 538");
  });

  it("stays silent for the player's own queue source", () => {
    storeMock.activePlayer = player({
      source_list: [playerSource({ id: "player-1", name: "Queue" })],
    });

    const { nowPlayingSource } = useNowPlayingSource();

    expect(nowPlayingSource.value).toBeUndefined();
  });

  it("stays silent while the player is off", () => {
    const source = playerSource({ id: "airplay", name: "AirPlay" });
    storeMock.activePlayer = player({
      powered: false,
      active_source: source.id,
      source_list: [source],
    });

    const { nowPlayingSource } = useNowPlayingSource();

    expect(nowPlayingSource.value).toBeUndefined();
  });

  it("stays silent without an active player", () => {
    storeMock.activePlayer = undefined;

    const { nowPlayingSource } = useNowPlayingSource();

    expect(nowPlayingSource.value).toBeUndefined();
  });

  it("follows active source changes", () => {
    const airplay = playerSource({
      id: "airplay_receiver--abc://audio_source/main",
      name: "AirPlay",
    });
    const queue = playerSource({ id: "player-1", name: "Queue" });
    storeMock.activePlayer = player({
      active_source: airplay.id,
      source_list: [airplay, queue],
    });
    const { nowPlayingSource } = useNowPlayingSource();

    expect(nowPlayingSource.value?.name).toBe("AirPlay");

    storeMock.activePlayer.active_source = queue.id;

    expect(nowPlayingSource.value).toBeUndefined();
  });
});
