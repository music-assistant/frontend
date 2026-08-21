import { reactive } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  Player,
  PlayerQueue,
  QueueItem,
  StreamMetadata,
} from "@/plugins/api/interfaces";
import { audioSource } from "../fixtures/audioSource";
import { providerMapping } from "../fixtures/providerMapping";
import { queueItem } from "../fixtures/queueItem";
import { radio } from "../fixtures/radio";
import { streamDetails } from "../fixtures/streamDetails";
import { track } from "../fixtures/track";

// getSourceName resolves the player's active source against these
const { apiMock } = vi.hoisted(() => ({
  apiMock: { queues: {} as Record<string, unknown> },
}));

vi.mock("@/plugins/api", () => ({ api: apiMock, default: apiMock }));

const storeMock = reactive({
  activePlayer: undefined as Player | undefined,
  activePlayerQueue: undefined as PlayerQueue | undefined,
  curQueueItem: undefined as QueueItem | undefined,
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

function metadata(overrides: Partial<StreamMetadata> = {}): StreamMetadata {
  return {
    title: "Live track",
    artist: null,
    album: null,
    image_url: null,
    duration: null,
    uri: null,
    ...overrides,
  };
}

/** Puts the item on an active queue, the way the server reports playback. */
function playing(item: QueueItem) {
  storeMock.activePlayerQueue = { queue_id: "player-1" } as PlayerQueue;
  storeMock.curQueueItem = item;
}

beforeEach(() => {
  apiMock.queues = {};
  storeMock.activePlayer = player();
  storeMock.activePlayerQueue = undefined;
  storeMock.curQueueItem = undefined;
});

describe("useNowPlayingSource", () => {
  it("names the plugin source playing on the queue", () => {
    playing(
      queueItem({
        media_item: audioSource({
          name: "Spotify Connect",
          provider: "spotify_connect--abc",
          provider_mappings: [],
        }),
      }),
    );

    const { nowPlayingSource } = useNowPlayingSource();

    expect(nowPlayingSource.value).toEqual({
      name: "Spotify Connect",
      iconDomain: "spotify_connect--abc",
    });
  });

  it("names the station once live metadata takes over the title", () => {
    playing(
      queueItem({
        media_item: radio({
          name: "Radio 538",
          provider: "library",
          provider_mappings: [providerMapping({ provider_domain: "tunein" })],
        }),
        streamdetails: streamDetails({ stream_metadata: metadata() }),
      }),
    );

    const { nowPlayingSource } = useNowPlayingSource();

    // the library is where the station is saved, not what streams it
    expect(nowPlayingSource.value).toEqual({
      name: "Radio 538",
      iconDomain: "tunein",
    });
  });

  it("stays silent for a station that still shows its own name", () => {
    playing(
      queueItem({
        media_item: radio({ name: "Radio 538" }),
        streamdetails: streamDetails({ stream_metadata: null }),
      }),
    );

    const { nowPlayingSource } = useNowPlayingSource();

    expect(nowPlayingSource.value).toBeUndefined();
  });

  it("stays silent for ordinary track playback", () => {
    playing(queueItem({ media_item: track() }));

    const { nowPlayingSource } = useNowPlayingSource();

    expect(nowPlayingSource.value).toBeUndefined();
  });

  it("names an external source that took the player over", () => {
    storeMock.activePlayer = player({
      active_source: "line-in",
      source_list: [
        {
          id: "line-in",
          name: "Line In",
          passive: true,
          can_play_pause: false,
          can_seek: false,
          can_next_previous: false,
        },
      ],
    });

    const { nowPlayingSource } = useNowPlayingSource();

    // no queue to read the source from, so it comes from the source list
    expect(nowPlayingSource.value).toEqual({ name: "Line In" });
  });

  it("stays silent while the player is off", () => {
    storeMock.activePlayer = player({ powered: false });
    playing(queueItem({ media_item: audioSource({ name: "AirPlay" }) }));

    const { nowPlayingSource } = useNowPlayingSource();

    expect(nowPlayingSource.value).toBeUndefined();
  });

  it("stays silent without an active player", () => {
    storeMock.activePlayer = undefined;

    const { nowPlayingSource } = useNowPlayingSource();

    expect(nowPlayingSource.value).toBeUndefined();
  });

  it("follows the queue item as playback moves on", () => {
    const { nowPlayingSource } = useNowPlayingSource();
    playing(queueItem({ media_item: audioSource({ name: "AirPlay" }) }));

    expect(nowPlayingSource.value?.name).toBe("AirPlay");

    storeMock.curQueueItem = queueItem({ media_item: track() });

    expect(nowPlayingSource.value).toBeUndefined();
  });
});
