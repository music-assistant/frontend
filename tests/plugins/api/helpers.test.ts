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
  isAudioSource,
  isQueueInfiniteStream,
  resolvePlayerQueue,
  waitForApiInitialization,
} from "@/plugins/api/helpers";
import { MediaType } from "@/plugins/api/interfaces";
import type {
  MediaItemType,
  Player,
  PlayerQueue,
} from "@/plugins/api/interfaces";

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

describe("isQueueInfiniteStream", () => {
  const makeQueue = (mediaType: MediaType | undefined) =>
    ({
      current_item: mediaType
        ? { media_item: { media_type: mediaType } }
        : undefined,
    }) as unknown as PlayerQueue;

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
    api.queues["source-q"] = { queue_id: "source-q" } as PlayerQueue;

    expect(
      resolvePlayerQueue(player({ active_source: "source-q" }))?.queue_id,
    ).toBe("source-q");
  });

  it("returns the player's own active queue when it has no source", () => {
    api.queues["p1"] = { queue_id: "p1", active: true } as PlayerQueue;

    expect(resolvePlayerQueue(player({}))?.queue_id).toBe("p1");
  });

  it("returns the player's own queue reached through its source while inactive", () => {
    api.queues["p1"] = { queue_id: "p1", active: false } as PlayerQueue;

    expect(resolvePlayerQueue(player({ active_source: "p1" }))?.queue_id).toBe(
      "p1",
    );
  });

  it("ignores the player's own queue while it is inactive", () => {
    api.queues["p1"] = { queue_id: "p1", active: false } as PlayerQueue;

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
