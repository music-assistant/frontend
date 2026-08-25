import { beforeEach, describe, expect, it, vi } from "vitest";
import { nextTick } from "vue";

const mocks = vi.hoisted(() => ({
  apiState: { value: "connected" as string },
}));

vi.mock("@/plugins/api", async () => {
  // waitForApiInitialization watches api.state, so the mock has to carry a real
  // ref: assignments to a plain { value } would never reach the watcher.
  const { ref } = await vi.importActual<typeof import("vue")>("vue");
  mocks.apiState = ref(mocks.apiState.value);
  return {
    default: {
      serverInfo: { value: null },
      providers: {},
      queues: {},
      state: mocks.apiState,
    },
    ConnectionState: { INITIALIZED: "initialized" },
  };
});

import api from "@/plugins/api";
import {
  getProviderRootDomain,
  isAudioSource,
  isQueueInfiniteStream,
  queueSourceCrossfadeProvider,
  resolvePlayerQueue,
  waitForApiInitialization,
} from "@/plugins/api/helpers";
import { CrossfadeMode, MediaType } from "@/plugins/api/interfaces";
import type {
  MediaItemType,
  PlayableMediaItemType,
  Player,
  QueueItem,
} from "@/plugins/api/interfaces";
import { playerQueue } from "../../fixtures/playerQueue";
import { queueItem } from "../../fixtures/queueItem";

describe("isAudioSource", () => {
  it("returns true for AUDIO_SOURCE media type", () => {
    const item = { media_type: MediaType.AUDIO_SOURCE } as MediaItemType;
    expect(isAudioSource(item)).toBe(true);
  });

  it("returns false for non-AudioSource media types", () => {
    for (const type of [
      MediaType.TRACK,
      MediaType.RADIO,
      MediaType.ALBUM,
      MediaType.PLAYLIST,
      MediaType.AUDIOBOOK,
    ]) {
      const item = { media_type: type } as MediaItemType;
      expect(isAudioSource(item)).toBe(false);
    }
  });

  it("returns false for undefined", () => {
    expect(isAudioSource(undefined)).toBe(false);
  });
});

describe("queueSourceCrossfadeProvider", () => {
  const makeQueue = (crossfadeMode: CrossfadeMode | undefined) =>
    playerQueue({
      current_item: queueItem({
        streamdetails: {
          provider: "spotify--1",
          audio_processing: crossfadeMode
            ? { queue_processing: { crossfade_mode: crossfadeMode } }
            : undefined,
        },
      } as unknown as Partial<QueueItem>),
    });

  it("returns the provider that applies the fade itself", () => {
    expect(queueSourceCrossfadeProvider(makeQueue(CrossfadeMode.SOURCE))).toBe(
      "spotify--1",
    );
  });

  it("returns undefined when the fade is ours or absent", () => {
    for (const mode of [
      CrossfadeMode.SMART_CROSSFADE,
      CrossfadeMode.STANDARD_CROSSFADE,
      CrossfadeMode.DISABLED,
      undefined,
    ]) {
      expect(queueSourceCrossfadeProvider(makeQueue(mode))).toBeUndefined();
    }
  });

  it("returns undefined without a queue or a current item", () => {
    expect(queueSourceCrossfadeProvider(undefined)).toBeUndefined();
    expect(
      queueSourceCrossfadeProvider(playerQueue({ current_item: null })),
    ).toBeUndefined();
  });
});

describe("isQueueInfiniteStream", () => {
  const makeQueue = (mediaType: MediaType | undefined) =>
    playerQueue({
      current_item: mediaType
        ? queueItem({
            media_item: { media_type: mediaType } as PlayableMediaItemType,
          })
        : null,
    });

  it("returns true when the current item is a radio", () => {
    expect(isQueueInfiniteStream(makeQueue(MediaType.RADIO))).toBe(true);
  });

  it("returns true when the current item is an AudioSource", () => {
    expect(isQueueInfiniteStream(makeQueue(MediaType.AUDIO_SOURCE))).toBe(true);
  });

  it("returns false for finite media types", () => {
    for (const type of [
      MediaType.TRACK,
      MediaType.AUDIOBOOK,
      MediaType.PODCAST_EPISODE,
    ]) {
      expect(isQueueInfiniteStream(makeQueue(type))).toBe(false);
    }
  });

  it("returns false when the queue or current item is missing", () => {
    expect(isQueueInfiniteStream(undefined)).toBe(false);
    expect(isQueueInfiniteStream(makeQueue(undefined))).toBe(false);
  });
});

describe("resolvePlayerQueue", () => {
  const player = (fields: Partial<Player>) =>
    ({ player_id: "p1", ...fields }) as Player;

  beforeEach(() => {
    for (const key of Object.keys(api.queues)) delete api.queues[key];
  });

  it("returns the queue of the source the player is attached to", () => {
    api.queues["source-q"] = playerQueue({ queue_id: "source-q" });

    expect(
      resolvePlayerQueue(player({ active_source: "source-q" }))?.queue_id,
    ).toBe("source-q");
  });

  it("returns the player's own active queue when it has no source", () => {
    api.queues["p1"] = playerQueue({ queue_id: "p1", active: true });

    expect(resolvePlayerQueue(player({}))?.queue_id).toBe("p1");
  });

  it("returns the player's own queue reached through its source while inactive", () => {
    api.queues["p1"] = playerQueue({ queue_id: "p1", active: false });

    expect(resolvePlayerQueue(player({ active_source: "p1" }))?.queue_id).toBe(
      "p1",
    );
  });

  it("ignores the player's own queue while it is inactive", () => {
    api.queues["p1"] = playerQueue({ queue_id: "p1", active: false });

    expect(resolvePlayerQueue(player({}))).toBeUndefined();
  });

  it("returns undefined for an unknown source and for no player", () => {
    expect(
      resolvePlayerQueue(player({ active_source: "gone" })),
    ).toBeUndefined();
    expect(resolvePlayerQueue(undefined)).toBeUndefined();
  });
});

describe("waitForApiInitialization", () => {
  beforeEach(() => {
    mocks.apiState.value = "connected";
  });

  it("resolves immediately when the api is already initialized", async () => {
    mocks.apiState.value = "initialized";

    await expect(waitForApiInitialization()).resolves.toBeUndefined();
  });

  it("waits for the api to reach the initialized state", async () => {
    let resolved = false;
    const pending = waitForApiInitialization().then(() => {
      resolved = true;
    });

    mocks.apiState.value = "authenticated";
    await nextTick();
    expect(resolved).toBe(false);

    mocks.apiState.value = "initialized";
    await pending;
    expect(resolved).toBe(true);
  });
});

describe("getProviderRootDomain", () => {
  const folder = (item_id: string, path: string) =>
    ({
      media_type: MediaType.FOLDER,
      item_id,
      path,
      provider: "spotify",
    }) as unknown as MediaItemType;

  it("returns the provider domain for a browse root entry", () => {
    expect(getProviderRootDomain(folder("root", "spotify--abc://"))).toBe(
      "spotify",
    );
  });

  it("ignores the back entry that shares the provider path", () => {
    expect(getProviderRootDomain(folder("back", "spotify--abc://"))).toBe(
      undefined,
    );
  });

  it("ignores the back entry that leads out of a provider", () => {
    expect(getProviderRootDomain(folder("root", "root"))).toBe(undefined);
  });

  it("ignores folders inside a provider", () => {
    expect(getProviderRootDomain(folder("root", "spotify--abc://Rock"))).toBe(
      undefined,
    );
  });

  it("ignores media items and missing items", () => {
    expect(
      getProviderRootDomain({ media_type: MediaType.TRACK } as MediaItemType),
    ).toBe(undefined);
    expect(getProviderRootDomain(undefined)).toBe(undefined);
  });
});
