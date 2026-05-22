import { describe, expect, it, vi } from "vitest";

vi.mock("@/plugins/api", () => ({
  default: {
    serverInfo: { value: null },
    providers: {},
    queues: {},
  },
}));

import { isAudioSource } from "@/plugins/api/helpers";
import { MediaType } from "@/plugins/api/interfaces";
import type { MediaItemType } from "@/plugins/api/interfaces";

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
