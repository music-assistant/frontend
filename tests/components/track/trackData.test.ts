import { beforeEach, describe, expect, it, vi } from "vitest";

const { apiMock } = vi.hoisted(() => ({
  apiMock: {
    getTrackAlbums: vi.fn().mockResolvedValue([]),
    getTrackVersions: vi.fn().mockResolvedValue([]),
    getSimilarTracks: vi.fn().mockResolvedValue([]),
    getTrackLyrics: vi.fn().mockResolvedValue([null, null]),
  },
}));

vi.mock("@/plugins/api", () => ({
  api: apiMock,
}));

// the release type is translated in the helper, so the key is what the
// assertions read and they stay independent of en.json
vi.mock("@/plugins/i18n", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/plugins/i18n")>()),
  $t: (key: string) => key,
}));

import {
  audioFormatLabel,
  bestAudioFormat,
  loadSimilarTracks,
  loadTrackAlbums,
  loadTrackLyrics,
  loadTrackVersions,
  plainLyrics,
  releaseSubtitle,
} from "@/components/track/trackData";
import {
  AlbumType,
  ContentType,
  type ItemMapping,
} from "@/plugins/api/interfaces";
import { album } from "../../fixtures/album";
import { artist } from "../../fixtures/artist";
import { audioFormat } from "../../fixtures/audioFormat";
import { providerMapping } from "../../fixtures/providerMapping";
import { track } from "../../fixtures/track";

const TRACK = track({
  item_id: "1",
  provider: "library",
  provider_mappings: [
    providerMapping({ item_id: "sp1", provider_domain: "spotify" }),
  ],
});

const LRC = "[00:12.50]First line\n[00:15.00] Second line\n[00:20.00]\n";

describe("trackData", () => {
  beforeEach(() => {
    apiMock.getTrackAlbums.mockClear();
    apiMock.getTrackVersions.mockClear();
    apiMock.getSimilarTracks.mockClear();
    apiMock.getTrackLyrics.mockClear().mockResolvedValue([null, null]);
  });

  describe("loadTrackAlbums / loadTrackVersions", () => {
    it("ask the track's own provider", async () => {
      await loadTrackAlbums(TRACK);
      expect(apiMock.getTrackAlbums).toHaveBeenLastCalledWith("1", "library");

      await loadTrackVersions(TRACK);
      expect(apiMock.getTrackVersions).toHaveBeenLastCalledWith("1", "library");
    });
  });

  describe("loadSimilarTracks", () => {
    it("drops the track itself, recognized by a shared mapping", async () => {
      const self = track({
        item_id: "sp1",
        provider: "spotify--abc",
        provider_mappings: [
          providerMapping({ item_id: "sp1", provider_domain: "spotify" }),
        ],
      });
      const other = track({
        item_id: "sp2",
        provider: "spotify--abc",
        provider_mappings: [
          providerMapping({ item_id: "sp2", provider_domain: "spotify" }),
        ],
      });
      // the same id on another provider is another track
      const elsewhere = track({
        item_id: "sp1",
        provider: "tidal--def",
        provider_mappings: [
          providerMapping({ item_id: "sp1", provider_domain: "tidal" }),
        ],
      });
      apiMock.getSimilarTracks.mockResolvedValue([self, other, elsewhere]);

      expect(await loadSimilarTracks(TRACK)).toEqual([other, elsewhere]);
      expect(apiMock.getSimilarTracks).toHaveBeenLastCalledWith("1", "library");
    });
  });

  describe("loadTrackLyrics", () => {
    it("uses the lyrics the track already carries", async () => {
      expect(
        await loadTrackLyrics(track({ metadata: { lyrics: "La la" } })),
      ).toBe("La la");
      expect(
        await loadTrackLyrics(track({ metadata: { lrc_lyrics: LRC } })),
      ).toBe("First line\nSecond line");
      expect(apiMock.getTrackLyrics).not.toHaveBeenCalled();
    });

    it("asks the lyrics providers otherwise", async () => {
      apiMock.getTrackLyrics.mockResolvedValue([null, LRC]);
      expect(await loadTrackLyrics(TRACK)).toBe("First line\nSecond line");
      expect(apiMock.getTrackLyrics).toHaveBeenCalledWith(TRACK);
    });

    it("is undefined when nobody has lyrics", async () => {
      expect(await loadTrackLyrics(TRACK)).toBeUndefined();
    });
  });

  describe("plainLyrics", () => {
    it("prefers the plain text", () => {
      expect(plainLyrics("Plain", LRC)).toBe("Plain");
    });

    it("strips the timestamps from LRC lines, keeping blank lines between them", () => {
      expect(plainLyrics("", "[00:01.00]A\n[00:02:00]\n[1:03]B")).toBe(
        "A\n\nB",
      );
    });

    it("is undefined when nothing is left", () => {
      expect(plainLyrics(null, null)).toBeUndefined();
      expect(plainLyrics("  ", "[00:01.00]\n")).toBeUndefined();
    });
  });

  describe("bestAudioFormat", () => {
    it("ranks by bit depth, then sample rate, then bit rate", () => {
      const cd = audioFormat({ bit_depth: 16, sample_rate: 44100 });
      const hires = audioFormat({ bit_depth: 24, sample_rate: 96000 });
      const hiresLow = audioFormat({ bit_depth: 24, sample_rate: 48000 });
      const withMappings = track({
        provider_mappings: [
          providerMapping({ audio_format: cd }),
          providerMapping({ audio_format: hires }),
          providerMapping({ audio_format: hiresLow }),
        ],
      });
      expect(bestAudioFormat(withMappings)).toBe(hires);

      const mp3 = audioFormat({
        content_type: ContentType.MP3,
        codec_type: ContentType.MP3,
        bit_depth: 0,
        bit_rate: 320,
      });
      const mp3Low = audioFormat({ ...mp3, bit_rate: 128 });
      expect(
        bestAudioFormat(
          track({
            provider_mappings: [
              providerMapping({ audio_format: mp3Low }),
              providerMapping({ audio_format: mp3 }),
            ],
          }),
        ),
      ).toBe(mp3);
    });

    it("skips unavailable mappings", () => {
      const cd = audioFormat({ bit_depth: 16 });
      const withMappings = track({
        provider_mappings: [
          providerMapping({
            available: false,
            audio_format: audioFormat({ bit_depth: 24 }),
          }),
          providerMapping({ audio_format: cd }),
        ],
      });
      expect(bestAudioFormat(withMappings)).toBe(cd);
      expect(
        bestAudioFormat(
          track({ provider_mappings: [providerMapping({ available: false })] }),
        ),
      ).toBeUndefined();
    });
  });

  describe("audioFormatLabel", () => {
    it("names a lossless format by its bit depth and sample rate", () => {
      expect(audioFormatLabel(audioFormat())).toBe("FLAC 16/44.1");
      expect(
        audioFormatLabel(audioFormat({ bit_depth: 24, sample_rate: 96000 })),
      ).toBe("FLAC 24/96");
      expect(
        audioFormatLabel(
          audioFormat({
            content_type: ContentType.M4A,
            codec_type: ContentType.ALAC,
          }),
        ),
      ).toBe("ALAC 16/44.1");
    });

    it("names a lossy format by its bit rate", () => {
      const mp3 = audioFormat({
        content_type: ContentType.MP3,
        codec_type: ContentType.MP3,
        bit_rate: 320,
      });
      expect(audioFormatLabel(mp3)).toBe("MP3 320");
      expect(audioFormatLabel({ ...mp3, bit_rate: 0 })).toBe("MP3");
      expect(
        audioFormatLabel(
          audioFormat({
            content_type: ContentType.M4A,
            codec_type: ContentType.AAC,
            bit_rate: 256,
          }),
        ),
      ).toBe("AAC 256");
    });

    it("falls back to the container when the codec is unknown", () => {
      expect(
        audioFormatLabel(
          audioFormat({
            content_type: ContentType.OGG,
            codec_type: ContentType.UNKNOWN,
            bit_rate: 160,
          }),
        ),
      ).toBe("OGG 160");
    });
  });

  describe("releaseSubtitle", () => {
    it("joins the type, artists and year", () => {
      expect(
        releaseSubtitle(
          album({
            album_type: AlbumType.ALBUM,
            artists: [artist({ name: "Vera Lund" })],
            year: 2025,
          }),
        ),
      ).toBe("album_type.album · Vera Lund · 2025");
    });

    it("skips what is missing", () => {
      expect(
        releaseSubtitle(album({ album_type: AlbumType.UNKNOWN, year: 2025 })),
      ).toBe("2025");
      const mapping: ItemMapping = {
        item_id: "10",
        provider: "library",
        name: "Compilation",
        version: "",
        uri: "library://album/10",
        external_ids: [],
        is_playable: true,
        media_type: album().media_type,
        available: true,
      };
      expect(releaseSubtitle(mapping)).toBe("");
      expect(releaseSubtitle({ ...mapping, year: 1999 })).toBe("1999");
    });
  });
});
