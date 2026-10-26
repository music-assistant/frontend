const PROVIDER_HOSTS: Record<string, readonly string[]> = {
  spotify: ["open.spotify.com"],
  tidal: ["tidal.com", "www.tidal.com"],
  qobuz: ["open.qobuz.com"],
  ytmusic: ["music.youtube.com"],
  deezer: ["deezer.com", "www.deezer.com"],
  apple_music: ["music.apple.com"],
};
const PROVIDER_BASE_URLS: Record<string, string> = {
  spotify: "https://open.spotify.com",
  tidal: "https://tidal.com",
  qobuz: "https://open.qobuz.com",
  ytmusic: "https://music.youtube.com",
  deezer: "https://www.deezer.com",
  apple_music: "https://music.apple.com",
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
const ARTWORK_SUFFIXES: Record<string, string> = {
  m: "mzstatic.com",
  s: "scdn.co",
  t: "tidal.com",
  q: "qobuz.com",
  d: "dzcdn.net",
  b: "bcbits.com",
  g: "googleusercontent.com",
  y: "ytimg.com",
  c: "coverartarchive.org",
  a: "archive.org",
  u: "theaudiodb.com",
  f: "fanart.tv",
  l: "last.fm",
  L: "lastfm.freetls.fastly.net",
  z: "ssl-images-amazon.com",
};

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

export interface SharedTrack {
  title: string;
  artist?: string | null;
  version?: string | null;
  album?: string | null;
  isrc?: string | null;
  mbid?: string | null;
  mb_track?: string | null;
  duration?: number | null;
}

export function encodeSharedTrack(track: SharedTrack): string {
  const bytes = new TextEncoder().encode(
    JSON.stringify({
      type: "track",
      title: track.title,
      artist: track.artist,
      version: track.version,
      album: track.album,
      isrc: track.isrc,
      mbid: track.mbid,
      mb_track: track.mb_track,
    }),
  );
  return btoa(Array.from(bytes, (byte) => String.fromCharCode(byte)).join(""))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
}

export function decodeSharePreview(
  value: string,
  getProviderName: (domain: string) => string,
): SharePreview {
  const encoded = new URL(value).hash.slice(1);
  const normalized = encoded.replace(/-/g, "+").replace(/_/g, "/");
  const bytes = Uint8Array.from(
    atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=")),
    (character) => character.charCodeAt(0),
  );
  const payload: unknown = JSON.parse(new TextDecoder().decode(bytes));
  if (!payload || typeof payload !== "object")
    throw new Error("Invalid share payload");
  const candidate = payload as Record<string, unknown>;
  if (typeof candidate.title !== "string")
    throw new Error("Invalid share payload");
  const links = Object.entries(
    expandShareProviderRefs(candidate.provider_refs),
  ).map(([domain, url]) => ({
    domain,
    name: getProviderName(domain),
    url,
  }));
  return {
    title: candidate.title,
    artist: typeof candidate.artist === "string" ? candidate.artist : undefined,
    album: typeof candidate.album === "string" ? candidate.album : undefined,
    art: expandShareArtworkRef(candidate.art_ref),
    links,
  };
}

export function isSafeProviderUrl(domain: string, value: string): boolean {
  const hosts = PROVIDER_HOSTS[domain];
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

export function expandShareProviderRefs(
  value: unknown,
): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).flatMap(([domain, ref]) => {
      if (
        typeof ref !== "string" ||
        !Object.prototype.hasOwnProperty.call(PROVIDER_BASE_URLS, domain) ||
        !ref.startsWith("/") ||
        ref.startsWith("//") ||
        ref.includes("\\")
      ) {
        return [];
      }
      try {
        const url = new URL(ref, PROVIDER_BASE_URLS[domain]);
        return isSafeProviderUrl(domain, url.href) ? [[domain, url.href]] : [];
      } catch {
        return [];
      }
    }),
  );
}

export function expandShareArtworkRef(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const separator = value.indexOf(":");
  if (separator <= 0) return undefined;
  const code = value.slice(0, separator);
  const hostAndPath = value.slice(separator + 1);
  const suffix = ARTWORK_SUFFIXES[code];
  if (!suffix) return undefined;
  let subdomain = "";
  let path = hostAndPath;
  if (!hostAndPath.startsWith("/")) {
    const subdomainEnd = hostAndPath.indexOf(":/");
    if (subdomainEnd <= 0) return undefined;
    subdomain = hostAndPath.slice(0, subdomainEnd);
    path = hostAndPath.slice(subdomainEnd + 1);
  }
  if (
    !path.startsWith("/") ||
    (subdomain &&
      !subdomain.split(".").every((part) => /^[a-z0-9-]+$/i.test(part)))
  ) {
    return undefined;
  }
  const url = `https://${subdomain ? `${subdomain}.` : ""}${suffix}${path}`;
  return isSafeArtworkUrl(url) ? new URL(url).href : undefined;
}
