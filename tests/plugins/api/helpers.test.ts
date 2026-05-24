import { describe, expect, it, vi } from "vitest";

vi.mock("@/plugins/api", () => ({
  default: {
    serverInfo: { value: null },
    providers: {},
    queues: {},
  },
}));

import { isAudioSource, isQueueInfiniteStream } from "@/plugins/api/helpers";
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
