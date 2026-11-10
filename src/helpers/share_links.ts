const MAX_PAYLOAD_LENGTH = 65_536;
const MAX_DECOMPRESSED_BYTES = 65_536;
const PAYLOAD_PREFIX = "1";

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
  album?: string;
  art_url?: string;
  provider_urls?: Record<string, string>;
}

export async function decodeSharePreview(
  value: string,
  getProviderName: (domain: string) => string,
): Promise<SharePreview> {
  const payload = await decodeSharePayload(new URL(value).hash.slice(1));
  const links = Object.entries(payload.provider_urls ?? {})
    .filter(([, url]) => isSafeShareUrl(url))
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
      payload.art_url && isSafeShareUrl(payload.art_url)
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
  for (const field of ["artist", "album", "art_url"]) {
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
  return {
    type: candidate.type as DecodedSharePayload["type"],
    title: candidate.title,
    artist: typeof candidate.artist === "string" ? candidate.artist : undefined,
    album: typeof candidate.album === "string" ? candidate.album : undefined,
    art_url: candidate.art_url as string | undefined,
    provider_urls: candidate.provider_urls as
      Record<string, string> | undefined,
  };
}

export function isSafeShareUrl(value: string): boolean {
  if (!/^https:\/\/[^/\s\\][^\s\\]*$/i.test(value)) return false;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !url.username && !url.password;
  } catch {
    return false;
  }
}
