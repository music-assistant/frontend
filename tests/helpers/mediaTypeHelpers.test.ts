import { itemSupportsPlayLog } from "@/plugins/api/helpers";
import { MediaType, type MediaItemType } from "@/plugins/api/interfaces";
import { describe, expect, it } from "vitest";

const mediaItem = (media_type: MediaType) => ({ media_type }) as MediaItemType;

describe("itemSupportsPlayLog", () => {
  it("recognizes audiobooks and podcast episodes as long-form content", () => {
    expect(itemSupportsPlayLog(mediaItem(MediaType.AUDIOBOOK))).toBe(true);
    expect(itemSupportsPlayLog(mediaItem(MediaType.PODCAST_EPISODE))).toBe(
      true,
    );
  });

  it("does not treat podcast collections or tracks as long-form playback items", () => {
    expect(itemSupportsPlayLog(mediaItem(MediaType.PODCAST))).toBe(false);
    expect(itemSupportsPlayLog(mediaItem(MediaType.TRACK))).toBe(false);
    expect(itemSupportsPlayLog(null)).toBe(false);
  });
});
