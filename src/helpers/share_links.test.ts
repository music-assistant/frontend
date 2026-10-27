import { describe, expect, it } from "vitest";
import {
  decodeSharePayload,
  decodeSharePreview,
  encodeSharedTrack,
  expandShareArtworkRef,
  expandShareProviderRefs,
  IMPORTED_SHARE_TRACK_PREFIX,
  isUnresolvedSharedTrack,
  isSafeArtworkUrl,
  isSafeProviderUrl,
  SHARE_PREVIEW_TRACK_PREFIX,
} from "./share_links";
import { track } from "../../tests/fixtures/track";

describe("encodeSharedTrack", () => {
  it("preserves Unicode metadata, version, and external IDs", () => {
    const track = {
      title: "Musik \u00fcberall",
      artist: "Bj\u00f6rk",
      artists: ["Bj\u00f6rk", "Featured Artist"],
      version: "Live",
      isrc: "USRC17607839",
      mbid: "recording-id",
      mb_track: "release-track-id",
      duration: 218,
    };
    const encoded = encodeSharedTrack(track);
    expect(encoded).toMatch(/^[A-Za-z0-9_-]+$/);
    const bytes = Uint8Array.from(
      atob(encoded.replaceAll("-", "+").replaceAll("_", "/")),
      (character) => character.charCodeAt(0),
    );
    expect(JSON.parse(new TextDecoder().decode(bytes))).toEqual({
      type: "track",
      ...track,
    });
    expect(JSON.parse(new TextDecoder().decode(bytes))).not.toHaveProperty("v");
  });
});

describe("decodeSharePreview", () => {
  it("decodes compact references without a version field", () => {
    const payload = {
      title: "Track",
      type: "track",
      artist: "Artist",
      art_ref: "m:is1-ssl:/image/cover.jpg",
      provider_refs: { spotify: "/track/123" },
    };
    const encoded = btoa(JSON.stringify(payload))
      .replace(/=/g, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");

    expect(
      decodeSharePreview(
        `https://share.example/#${encoded}`,
        (domain) => domain,
      ),
    ).toEqual({
      title: "Track",
      artist: "Artist",
      album: undefined,
      art: "https://is1-ssl.mzstatic.com/image/cover.jpg",
      links: [
        {
          domain: "spotify",
          name: "spotify",
          url: "https://open.spotify.com/track/123",
        },
      ],
    });
  });
});

describe("isSafeProviderUrl", () => {
  it("accepts a provider's canonical HTTPS host", () => {
    expect(
      isSafeProviderUrl("apple_music", "https://music.apple.com/us/album/1"),
    ).toBe(true);
  });

  it("rejects a different host under a recognized provider name", () => {
    expect(isSafeProviderUrl("spotify", "https://evil.example/track/1")).toBe(
      false,
    );
  });

  it("rejects unknown providers and non-HTTPS URLs", () => {
    expect(isSafeProviderUrl("unknown", "https://example.com")).toBe(false);
    expect(
      isSafeProviderUrl("spotify", "http://open.spotify.com/track/1"),
    ).toBe(false);
  });
});

describe("isSafeArtworkUrl", () => {
  it("accepts public HTTPS artwork hosts", () => {
    expect(isSafeArtworkUrl("https://is1-ssl.mzstatic.com/image.jpg")).toBe(
      true,
    );
  });

  it("rejects internal hosts and non-HTTPS URLs", () => {
    expect(isSafeArtworkUrl("https://localhost/image.jpg")).toBe(false);
    expect(isSafeArtworkUrl("https://127.0.0.1/image.jpg")).toBe(false);
    expect(isSafeArtworkUrl("https://nas.internal/image.jpg")).toBe(false);
    expect(isSafeArtworkUrl("https://router.home.arpa/image.jpg")).toBe(false);
    expect(isSafeArtworkUrl("https://evil.example/image.jpg")).toBe(false);
    expect(isSafeArtworkUrl("data:image/svg+xml,<svg/>")).toBe(false);
  });
});

describe("compact share references", () => {
  it("expands provider paths using only their configured hosts", () => {
    expect(
      expandShareProviderRefs({ apple_music: "/at/album/123?i=456" }),
    ).toEqual({
      apple_music: "https://music.apple.com/at/album/123?i=456",
    });
    expect(
      expandShareProviderRefs({ spotify: "//evil.example/track/1" }),
    ).toEqual({});
  });

  it("expands approved artwork host codes and rejects unknown codes", () => {
    expect(expandShareArtworkRef("m:is1-ssl:/image/cover.jpg")).toBe(
      "https://is1-ssl.mzstatic.com/image/cover.jpg",
    );
    expect(expandShareArtworkRef("x:evil.example:/image.jpg")).toBeUndefined();
  });

  it("canonicalizes quotes in approved artwork paths before CSS use", () => {
    const expanded = expandShareArtworkRef(
      'm:/"), url("https://attacker.example/pixel.png',
    );

    expect(expanded).toBeDefined();
    expect(expanded).toContain("%22");
    expect(isSafeArtworkUrl(expanded!)).toBe(true);
  });
});

describe("decodeSharePayload", () => {
  it("preserves a validated single-track duration", () => {
    const encoded = btoa(
      JSON.stringify({ type: "track", title: "Track", duration: 218 }),
    )
      .replace(/=/g, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");

    expect(decodeSharePayload(encoded).duration).toBe(218);
  });

  it("preserves structured artist credits for single-track links", () => {
    const encoded = btoa(
      JSON.stringify({
        type: "track",
        title: "Song",
        artist: "First, Second",
        artists: ["First", "Second"],
      }),
    )
      .replace(/=/g, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");

    expect(decodeSharePayload(encoded).artists).toEqual(["First", "Second"]);
  });

  it.each([true, -1, "218", 1.5])(
    "rejects invalid single-track durations (%s)",
    (duration) => {
      const encoded = btoa(
        JSON.stringify({ type: "track", title: "Track", duration }),
      )
        .replace(/=/g, "")
        .replace(/\+/g, "-")
        .replace(/\//g, "_");

      expect(() => decodeSharePayload(encoded)).toThrow(
        "Invalid track duration",
      );
    },
  );

  it("decodes a playlist once for both preview and page rendering", () => {
    const encoded = btoa(
      JSON.stringify({
        type: "playlist",
        title: "Shared list",
        tracks: [{ title: "Track" }],
      }),
    )
      .replace(/=/g, "")
      .replace(/\+/g, "-")
      .replace(/\//g, "_");

    expect(decodeSharePayload(encoded)).toEqual({
      type: "playlist",
      title: "Shared list",
      artist: undefined,
      album: undefined,
      version: undefined,
      duration: undefined,
      art_ref: undefined,
      provider_refs: undefined,
      tracks: [{ title: "Track" }],
    });
  });
});

describe("isUnresolvedSharedTrack", () => {
  it.each([SHARE_PREVIEW_TRACK_PREFIX, IMPORTED_SHARE_TRACK_PREFIX])(
    "recognizes the builtin placeholder prefix %s",
    (prefix) => {
      expect(
        isUnresolvedSharedTrack(
          track({ provider: "builtin", item_id: `${prefix}payload` }),
        ),
      ).toBe(true);
    },
  );

  it("does not match the same ID prefix from a real provider", () => {
    expect(
      isUnresolvedSharedTrack(
        track({
          provider: "tidal--1",
          item_id: `${SHARE_PREVIEW_TRACK_PREFIX}payload`,
        }),
      ),
    ).toBe(false);
  });
});
