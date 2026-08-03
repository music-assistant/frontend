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

import {
  isAudioSource,
  isQueueInfiniteStream,
  waitForApiInitialization,
} from "@/plugins/api/helpers";
import { MediaType } from "@/plugins/api/interfaces";
import type { MediaItemType, PlayerQueue } from "@/plugins/api/interfaces";

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
