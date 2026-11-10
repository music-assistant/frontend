// @vitest-environment node
import { deflateRawSync, deflateSync } from "node:zlib";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  decodeSharePayload,
  decodeSharePreview,
  isSafeArtworkUrl,
  isSafeProviderUrl,
} from "./share_links";

function wire(bytes: Uint8Array): string {
  return `1${Buffer.from(bytes).toString("base64url")}`;
}

function encode(payload: unknown): string {
  return wire(
    deflateRawSync(Buffer.from(JSON.stringify(payload)), { level: 9 }),
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("decodeSharePayload", () => {
  it("decodes the exact Python SharePayload.to_base64 fixture", async () => {
    const encoded =
      "1TY5NDoIwEIWvQrpwpTQgGsMF3Ji4MHFLBpjgmBaazlSDhLtbcOPye395k5LRoSoVmDpYtVVCYha-BjHwTs7YR7bYJ5vk9oB2TC7QEnJMghdiidH7YGoE-UlV8CZqDxHHpdbE2Y7ZpPbDAkJN2gxWk4UOtSBL-nRd7Dk_vKhFv5RZlZMC5wxWNjA1f2Mrp6u37rSo19s6K4r8mBf700HN8xc";
    expect(await decodeSharePayload(encoded)).toMatchObject({
      type: "album",
      title: "Outlaw Gentlemen & Shady Ladies",
      artist: "Volbeat",
      art_url: "https://is1-ssl.mzstatic.com/image/test.jpg",
      provider_urls: {
        apple_music: "https://music.apple.com/de/album/1442624385",
      },
    });
  });

  it("decodes version-prefixed raw DEFLATE with Unicode and existing metadata", async () => {
    const payload = {
      type: "track",
      title: "Musik überall 🎵",
      artist: "Björk",
      artists: ["Björk", "Featured Artist"],
      version: "Live",
      album: "Album",
      isrc: "USRC17607839",
      mbid: "recording-id",
      mb_track: "release-track-id",
      duration: 218,
      art_url: "https://is1-ssl.mzstatic.com/image/cover.jpg",
      provider_urls: { spotify: "https://open.spotify.com/track/123" },
    };
    const encoded = encode(payload);
    expect(encoded).toMatch(/^1[A-Za-z0-9_-]+$/);
    expect(await decodeSharePayload(encoded)).toEqual(payload);
  });

  it.each(["track", "album", "artist"])("accepts %s payloads", async (type) => {
    expect(
      await decodeSharePayload(encode({ type, title: "Title" })),
    ).toMatchObject({
      type,
      title: "Title",
    });
  });

  it.each([
    null,
    [],
    "string",
    {},
    { type: "playlist", title: "List", tracks: [{ title: "Track" }] },
    { type: "track", title: " " },
    { type: ["track"], title: "Title" },
    { type: "track", title: 1 },
    ...[
      "artist",
      "album",
      "version",
      "isrc",
      "mbid",
      "mb_track",
      "art_url",
    ].map((field) => ({ type: "track", title: "Title", [field]: 42 })),
    ...[null, [], "url", { spotify: 1 }].map((provider_urls) => ({
      type: "track",
      title: "Title",
      provider_urls,
    })),
    ...[null, true, -1, "218", 1.5].map((duration) => ({
      type: "track",
      title: "Title",
      duration,
    })),
    ...[null, "Artist", [1], [" "]].map((artists) => ({
      type: "track",
      title: "Title",
      artists,
    })),
  ])("rejects invalid payload %j", async (payload) => {
    await expect(decodeSharePayload(encode(payload))).rejects.toThrow();
  });

  it.each([
    "",
    "2AAAA",
    "0AAAA",
    "1",
    "1A",
    "1AA=",
    "1AA+",
    "1AA/",
    "1 AA",
    "1AB",
  ])("rejects malformed or unsupported wire %j", async (encoded) => {
    await expect(decodeSharePayload(encoded)).rejects.toThrow();
  });

  it("rejects legacy plain JSON base64 and zlib-wrapped DEFLATE", async () => {
    const json = Buffer.from('{"type":"track","title":"Title"}');
    await expect(
      decodeSharePayload(json.toString("base64url")),
    ).rejects.toThrow();
    await expect(decodeSharePayload(wire(deflateSync(json)))).rejects.toThrow();
  });

  it("rejects malformed JSON, UTF-8, compressed bytes, truncation and trailing garbage", async () => {
    const compressed = deflateRawSync(
      Buffer.from('{"type":"track","title":"Title"}'),
    );
    for (const bytes of [
      deflateRawSync(Buffer.from("{")),
      deflateRawSync(Buffer.from([0xff])),
      Buffer.from([0xff, 0xff]),
      compressed.subarray(0, -1),
      Buffer.concat([compressed, Buffer.from("garbage")]),
    ]) {
      await expect(decodeSharePayload(wire(bytes))).rejects.toThrow();
    }
  });

  it("enforces the encoded length bound, including the prefix, before decompression", async () => {
    const decompression = vi.fn();
    vi.stubGlobal("DecompressionStream", decompression);
    await expect(decodeSharePayload(`1${"A".repeat(65_536)}`)).rejects.toThrow(
      "Payload too large",
    );
    expect(decompression).not.toHaveBeenCalled();
  });

  it("accepts an encoded payload of exactly 65536 characters including the prefix", async () => {
    const overhead = Buffer.byteLength(
      JSON.stringify({ type: "track", title: "" }),
    );
    const payload = {
      type: "track",
      title: "x".repeat(49_146 - overhead),
    };
    const encoded = wire(
      deflateRawSync(Buffer.from(JSON.stringify(payload)), { level: 0 }),
    );
    expect(encoded.length).toBe(65_536);
    expect(await decodeSharePayload(encoded)).toMatchObject(payload);
  });

  it("accepts exactly 65536 decompressed UTF-8 bytes and rejects one more", async () => {
    const overhead = Buffer.byteLength(
      JSON.stringify({ type: "track", title: "" }),
    );
    const payload = { type: "track", title: "x".repeat(65_536 - overhead) };
    expect(await decodeSharePayload(encode(payload))).toMatchObject(payload);
    await expect(
      decodeSharePayload(encode({ ...payload, title: `${payload.title}x` })),
    ).rejects.toThrow("Payload too large");
    await expect(
      decodeSharePayload(encode({ type: "track", title: "🎵".repeat(20_000) })),
    ).rejects.toThrow("Payload too large");
  });

  it("cancels decompression as soon as the streaming output exceeds the limit", async () => {
    const cancel = vi.fn();
    let reads = 0;
    vi.stubGlobal(
      "DecompressionStream",
      class {
        readable = new ReadableStream(
          {
            pull(controller) {
              reads++;
              controller.enqueue(new Uint8Array(32_768));
            },
            cancel,
          },
          { highWaterMark: 0 },
        );
        writable = new WritableStream();
      },
    );
    await expect(
      decodeSharePayload(encode({ type: "track", title: "Title" })),
    ).rejects.toThrow("Payload too large");
    expect(reads).toBe(3);
    expect(cancel).toHaveBeenCalledOnce();
  });
});

describe("decodeSharePreview", () => {
  it("keeps complete artwork and provider URLs exactly as supplied", async () => {
    const payload = {
      type: "album",
      title: "Outlaw Gentlemen & Shady Ladies",
      artist: "Volbeat",
      art_url: "https://is1-ssl.mzstatic.com/image/test.jpg",
      provider_urls: {
        apple_music: "https://music.apple.com/de/album/1442624385",
        qobuz: "https://www.qobuz.com/de-de/album/title/id?foo=bar",
      },
    };
    expect(
      await decodeSharePreview(
        `https://share.example/#${encode(payload)}`,
        (domain) => domain,
      ),
    ).toEqual({
      title: payload.title,
      artist: payload.artist,
      album: undefined,
      art: payload.art_url,
      links: Object.entries(payload.provider_urls).map(([domain, url]) => ({
        domain,
        name: domain,
        url,
      })),
    });
  });

  it("filters unsafe URLs without reconstructing relative paths or compact references", async () => {
    const preview = await decodeSharePreview(
      `https://share.example/#${encode({
        type: "track",
        title: "Title",
        art_url: "m:is1-ssl:/image/test.jpg",
        provider_urls: {
          spotify: "/track/123",
          apple_music: "https://evil.example/album/123",
          unknown: "https://example.com/album/123",
        },
      })}`,
      (domain) => domain,
    );
    expect(preview.art).toBeUndefined();
    expect(preview.links).toEqual([]);
  });
});

describe("isSafeProviderUrl", () => {
  it.each([
    ["apple_music", "https://music.apple.com/us/album/1"],
    ["spotify", "https://open.spotify.com/track/1"],
    ["qobuz", "https://open.qobuz.com/album/1"],
    ["qobuz", "https://www.qobuz.com/de-de/album/1"],
    ["tidal", "https://www.tidal.com/browse/track/1"],
    ["ytmusic", "https://music.youtube.com/watch?v=1"],
    ["deezer", "https://www.deezer.com/track/1"],
  ])("accepts approved %s host %s", (domain, url) => {
    expect(isSafeProviderUrl(domain, url)).toBe(true);
  });

  it.each([
    ["unknown", "https://example.com"],
    ["toString", "https://example.com"],
    ["spotify", "http://open.spotify.com/track/1"],
    ["spotify", "https://open.spotify.com.evil.example/track/1"],
    ["spotify", "https://evil.example/open.spotify.com"],
    ["spotify", "https://user:pass@open.spotify.com/track/1"],
    ["spotify", "/track/1"],
    ["spotify", "https:open.spotify.com/track/1"],
    ["spotify", "https:///open.spotify.com/track/1"],
    ["spotify", " https://open.spotify.com/track/1"],
    ["spotify", "https://open.spotify.com\\track\\1"],
    ["spotify", "javascript:alert(1)"],
  ])("rejects unsafe %s URL %s", (domain, url) => {
    expect(isSafeProviderUrl(domain, url)).toBe(false);
  });
});

describe("isSafeArtworkUrl", () => {
  it("accepts public HTTPS artwork hosts", () => {
    expect(isSafeArtworkUrl("https://is1-ssl.mzstatic.com/image.jpg")).toBe(
      true,
    );
  });

  it.each([
    "https://localhost/image.jpg",
    "https://127.0.0.1/image.jpg",
    "https://nas.internal/image.jpg",
    "https://router.home.arpa/image.jpg",
    "https://evil.example/image.jpg",
    "https://notmzstatic.com/image.jpg",
    "https://mzstatic.com.evil.example/image.jpg",
    "https://user@is1-ssl.mzstatic.com/image.jpg",
    "http://is1-ssl.mzstatic.com/image.jpg",
    "data:image/svg+xml,<svg/>",
    "/image.jpg",
    "https:is1-ssl.mzstatic.com/image.jpg",
    " https://is1-ssl.mzstatic.com/image.jpg",
  ])("rejects unsafe artwork %s", (url) => {
    expect(isSafeArtworkUrl(url)).toBe(false);
  });
});
