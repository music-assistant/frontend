const MAX_PAYLOAD_LENGTH = 65_536;
const MAX_DECOMPRESSED_BYTES = 65_536;
const PAYLOAD_PREFIX = "1";
const PROVIDER_HOSTS: Record<string, readonly string[]> = {
  spotify: ["open.spotify.com"],
  tidal: ["tidal.com", "www.tidal.com"],
  qobuz: ["open.qobuz.com", "www.qobuz.com", "qobuz.com"],
  ytmusic: ["music.youtube.com", "www.youtube.com", "youtube.com", "youtu.be"],
  deezer: ["deezer.com", "www.deezer.com"],
  apple_music: ["music.apple.com"],
};
const ARTWORK_HOST_SUFFIXES = [
  "mzstatic.com",
  "scdn.co",
  "tidal.com",
  "qobuz.com",
  "dzcdn.net",
  "bcbits.com",
  "googleusercontent.com",
  "ytimg.com",
  "coverartarchive.org",
  "archive.org",
  "theaudiodb.com",
  "fanart.tv",
  "last.fm",
  "lastfm.freetls.fastly.net",
  "ssl-images-amazon.com",
];

export interface ShareProviderLink {
  domain: string;
  name: string;
  url: string;
}

export interface SharePreview {
  title: string;
  artist?: string;
  album?: string;
  art?: string;
  links: ShareProviderLink[];
}

export interface DecodedSharePayload {
  type: "track" | "album" | "artist";
  title: string;
  artist?: string;
  artists?: string[];
  album?: string;
  version?: string;
  duration?: number;
  isrc?: string;
  mbid?: string;
  mb_track?: string;
  art_url?: string;
  provider_urls?: Record<string, string>;
}

export async function decodeSharePreview(
  value: string,
  getProviderName: (domain: string) => string,
): Promise<SharePreview> {
  const payload = await decodeSharePayload(new URL(value).hash.slice(1));
  const links = Object.entries(payload.provider_urls ?? {})
    .filter(([domain, url]) => isSafeProviderUrl(domain, url))
    .map(([domain, url]) => ({
      domain,
      name: getProviderName(domain),
      url,
    }));
  return {
    title: payload.title,
    artist: payload.artist,
    album: payload.album,
    art:
      payload.art_url && isSafeArtworkUrl(payload.art_url)
        ? payload.art_url
        : undefined,
    links,
  };
}

export async function decodeSharePayload(
  encoded: string,
): Promise<DecodedSharePayload> {
  if (!encoded) throw new Error("Missing payload");
  if (encoded.length > MAX_PAYLOAD_LENGTH) throw new Error("Payload too large");
  if (encoded[0] !== PAYLOAD_PREFIX)
    throw new Error("Unsupported payload version");
  const base64 = encoded.slice(PAYLOAD_PREFIX.length);
  if (!/^[A-Za-z0-9_-]+$/.test(base64) || base64.length % 4 === 1) {
    throw new Error("Invalid payload encoding");
  }
  const normalized = base64.replace(/-/g, "+").replace(/_/g, "/");
  const binary = atob(
    normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "="),
  );
  if (btoa(binary).replace(/=+$/, "") !== normalized) {
    throw new Error("Invalid payload encoding");
  }
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  const reader = new Blob([bytes])
    .stream()
    .pipeThrough(new DecompressionStream("deflate-raw"))
    .getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > MAX_DECOMPRESSED_BYTES) {
        await reader.cancel();
        throw new Error("Payload too large");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const decompressed = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    decompressed.set(chunk, offset);
    offset += chunk.byteLength;
  }
  const value: unknown = JSON.parse(
    new TextDecoder("utf-8", { fatal: true }).decode(decompressed),
  );
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Invalid payload");
  }
  const candidate = value as Record<string, unknown>;
  if (
    typeof candidate.type !== "string" ||
    !["track", "album", "artist"].includes(candidate.type) ||
    typeof candidate.title !== "string" ||
    !candidate.title.trim()
  ) {
    throw new Error("Invalid payload");
  }
  for (const field of [
    "artist",
    "album",
    "version",
    "isrc",
    "mbid",
    "mb_track",
    "art_url",
  ]) {
    if (
      candidate[field] !== undefined &&
      typeof candidate[field] !== "string"
    ) {
      throw new Error("Invalid payload");
    }
  }
  if (
    candidate.provider_urls !== undefined &&
    (!candidate.provider_urls ||
      typeof candidate.provider_urls !== "object" ||
      Array.isArray(candidate.provider_urls) ||
      Object.values(candidate.provider_urls).some(
        (url) => typeof url !== "string",
      ))
  ) {
    throw new Error("Invalid provider URLs");
  }
  if (
    candidate.duration !== undefined &&
    (typeof candidate.duration !== "number" ||
      !Number.isInteger(candidate.duration) ||
      candidate.duration < 0)
  ) {
    throw new Error("Invalid track duration");
  }
  if (
    candidate.artists !== undefined &&
    (!Array.isArray(candidate.artists) ||
      candidate.artists.some(
        (artist) => typeof artist !== "string" || !artist.trim(),
      ))
  ) {
    throw new Error("Invalid artist credits");
  }
  return {
    type: candidate.type as DecodedSharePayload["type"],
    title: candidate.title,
    artist: typeof candidate.artist === "string" ? candidate.artist : undefined,
    artists: Array.isArray(candidate.artists)
      ? (candidate.artists as string[])
      : undefined,
    album: typeof candidate.album === "string" ? candidate.album : undefined,
    version:
      typeof candidate.version === "string" ? candidate.version : undefined,
    duration:
      typeof candidate.duration === "number" ? candidate.duration : undefined,
    isrc: candidate.isrc as string | undefined,
    mbid: candidate.mbid as string | undefined,
    mb_track: candidate.mb_track as string | undefined,
    art_url: candidate.art_url as string | undefined,
    provider_urls: candidate.provider_urls as
      Record<string, string> | undefined,
  };
}

export function isSafeProviderUrl(domain: string, value: string): boolean {
  if (!/^https:\/\/[^/\s\\][^\s\\]*$/i.test(value)) return false;
  const hosts = Object.hasOwn(PROVIDER_HOSTS, domain)
    ? PROVIDER_HOSTS[domain]
    : undefined;
  if (!hosts) return false;
  try {
    const url = new URL(value);
    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      hosts.includes(url.hostname.toLowerCase())
    );
  } catch {
    return false;
  }
}

export function isSafeArtworkUrl(value: string): boolean {
  if (!/^https:\/\/[^/\s\\][^\s\\]*$/i.test(value)) return false;
  try {
    const url = new URL(value);
    const hostname = url.hostname.toLowerCase();
    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      ARTWORK_HOST_SUFFIXES.some(
        (suffix) => hostname === suffix || hostname.endsWith(`.${suffix}`),
      )
    );
  } catch {
    return false;
  }
}
