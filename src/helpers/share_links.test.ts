// @vitest-environment node
import { deflateRawSync, deflateSync } from "node:zlib";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  decodeSharePayload,
  decodeSharePreview,
  isSafeShareUrl,
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

  it("decodes only preview fields from version-prefixed raw DEFLATE with Unicode", async () => {
    const payload = {
      type: "track",
      title: "Musik überall 🎵",
      artist: "Björk",
      album: "Album",
      art_url: "https://is1-ssl.mzstatic.com/image/cover.jpg",
      provider_urls: { spotify: "https://open.spotify.com/track/123" },
    };
    const encoded = encode({
      ...payload,
      artists: ["Björk", "Featured Artist"],
      version: "Live",
      isrc: "USRC17607839",
      mbid: "recording-id",
      mb_track: "release-track-id",
      duration: 218,
    });
    expect(encoded).toMatch(/^1[A-Za-z0-9_-]+$/);
    expect(await decodeSharePayload(encoded)).toEqual(payload);
  });

  it("does not validate metadata unused by the preview", async () => {
    expect(
      await decodeSharePayload(
        encode({
          type: "track",
          title: "Title",
          artists: null,
          version: 42,
          duration: -1,
          isrc: [],
          mbid: false,
          mb_track: {},
        }),
      ),
    ).toMatchObject({ type: "track", title: "Title" });
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
    ...["artist", "album", "art_url"].map((field) => ({
      type: "track",
      title: "Title",
      [field]: 42,
    })),
    ...[null, [], "url", { spotify: 1 }].map((provider_urls) => ({
      type: "track",
      title: "Title",
      provider_urls,
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

  it.each([
    ["malformed JSON", deflateRawSync(Buffer.from("{"))],
    ["invalid UTF-8", deflateRawSync(Buffer.from([0xff]))],
    ["invalid compressed bytes", Buffer.from([0xff, 0xff])],
    [
      "truncated compressed bytes",
      deflateRawSync(Buffer.from('{"type":"track","title":"Title"}')).subarray(
        0,
        -1,
      ),
    ],
  ])("rejects %s", async (_description, bytes) => {
    await expect(decodeSharePayload(wire(bytes))).rejects.toThrow();
  });

  it("delegates trailing compressed bytes validation to DecompressionStream", async () => {
    const payload = { type: "track", title: "Title" };
    const compressed = deflateRawSync(Buffer.from(JSON.stringify(payload)));
    const bytes = Buffer.concat([compressed, Buffer.from("garbage")]);
    // WHATWG requires rejection after BFINAL; Node 22 accepts trailing bytes,
    // unlike browsers and newer Node. The native API exposes no consumed count.
    const nativeAcceptsTrailingBytes = await new Response(
      new Blob([bytes])
        .stream()
        .pipeThrough(new DecompressionStream("deflate-raw")),
    )
      .text()
      .then(
        () => true,
        () => false,
      );
    if (nativeAcceptsTrailingBytes) {
      expect(await decodeSharePayload(wire(bytes))).toMatchObject(payload);
    } else {
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
      art_url: "https://new-artwork.example/image/test.jpg",
      provider_urls: {
        apple_music: "https://music.apple.com/de/album/1442624385",
        qobuz: "https://www.qobuz.com/de-de/album/title/id?foo=bar",
        tidal: "https://listen.tidal.com/album/123",
        new_provider: "https://new-provider.example/album/123",
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
          apple_music: "https://user@music.apple.com/album/123",
          unknown: "javascript:alert(1)",
        },
      })}`,
      (domain) => domain,
    );
    expect(preview.art).toBeUndefined();
    expect(preview.links).toEqual([]);
  });
});

describe("isSafeShareUrl", () => {
  it.each([
    ["apple_music", "https://music.apple.com/us/album/1"],
    ["spotify", "https://open.spotify.com/track/1"],
    ["qobuz", "https://open.qobuz.com/album/1"],
    ["qobuz", "https://www.qobuz.com/de-de/album/1"],
    ["tidal", "https://www.tidal.com/browse/track/1"],
    ["ytmusic", "https://music.youtube.com/watch?v=1"],
    ["deezer", "https://www.deezer.com/track/1"],
    ["tidal", "https://listen.tidal.com/track/1"],
    ["new_provider", "https://new-provider.example/album/1"],
    ["artwork", "https://is1-ssl.mzstatic.com/image.jpg"],
    ["artwork", "https://new-artwork.example/image.jpg"],
  ])("accepts %s HTTPS URLs without a host policy: %s", (_domain, url) => {
    expect(isSafeShareUrl(url)).toBe(true);
  });

  it.each([
    ["spotify", "http://open.spotify.com/track/1"],
    ["spotify", "https://user:pass@open.spotify.com/track/1"],
    ["spotify", "/track/1"],
    ["spotify", "https:open.spotify.com/track/1"],
    ["spotify", "https:///open.spotify.com/track/1"],
    ["spotify", " https://open.spotify.com/track/1"],
    ["spotify", "https://open.spotify.com\\track\\1"],
    ["spotify", "javascript:alert(1)"],
    ["artwork", "https://"],
    ["artwork", "https://[invalid]/image.jpg"],
    ["artwork", "https://user@is1-ssl.mzstatic.com/image.jpg"],
    ["artwork", "https://:password@is1-ssl.mzstatic.com/image.jpg"],
    ["artwork", "data:image/svg+xml,<svg/>"],
    ["spotify", "https://open.spotify.com/\ntrack/1"],
  ])("rejects unsafe %s URL %s", (_domain, url) => {
    expect(isSafeShareUrl(url)).toBe(false);
  });
});
