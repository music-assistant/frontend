import { parseLrcLine } from "@/helpers/lrcParser";
import { getArtistsString, getImageThumbForItem } from "@/helpers/utils";
import { api } from "@/plugins/api";
import {
  AlbumType,
  ContentType,
  ImageType,
  type Album,
  type Artist,
  type AudioFormat,
  type ItemMapping,
  type MediaItemType,
  type Track,
} from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";

// a line holding only an LRC ID tag, like "[ar: Artist]" or "[offset: 500]"
const LRC_ID_TAG = /^\[[a-z]+:[^\]]*\]$/i;

// the codecs the server counts as lossless (ContentType.is_lossless there)
const LOSSLESS_CODECS = new Set<ContentType>([
  ContentType.FLAC,
  ContentType.ALAC,
  ContentType.WAV,
  ContentType.AIFF,
  ContentType.DSF,
  ContentType.WAVPACK,
  ContentType.TAK,
  ContentType.APE,
  ContentType.TRUEHD,
  ContentType.RA_144,
  ContentType.PCM,
  ContentType.PCM_S16LE,
  ContentType.PCM_S24LE,
  ContentType.PCM_S32LE,
  ContentType.PCM_F32LE,
  ContentType.PCM_F64LE,
  ContentType.PCM_S16BE,
  ContentType.PCM_S24BE,
  ContentType.PCM_S32BE,
  ContentType.PCM_BLURAY,
  ContentType.PCM_DVD,
  ContentType.DSD_LSBF,
  ContentType.DSD_MSBF,
  ContentType.DSD_LSBF_PLANAR,
  ContentType.DSD_MSBF_PLANAR,
]);

/** The albums the track appears on. */
export async function loadTrackAlbums(track: Track): Promise<Album[]> {
  return await api.getTrackAlbums(track.item_id, track.provider);
}

/** The other versions of the track, on any provider. */
export async function loadTrackVersions(track: Track): Promise<Track[]> {
  return await api.getTrackVersions(track.item_id, track.provider);
}

/** Tracks similar to this one, without the track itself. */
export async function loadSimilarTracks(track: Track): Promise<Track[]> {
  const tracks = await api.getSimilarTracks(track.item_id, track.provider);
  // a provider may hand the track itself back under another of its mappings
  return tracks.filter((candidate) => !sharesMapping(candidate, track));
}

/**
 * The track's lyrics as plain text: the ones in its metadata, else the ones
 * the lyrics providers have. Undefined when there are none.
 */
export async function loadTrackLyrics(
  track: Track,
): Promise<string | undefined> {
  const own = plainLyrics(track.metadata?.lyrics, track.metadata?.lrc_lyrics);
  if (own) return own;
  const [lyrics, lrc] = await api.getTrackLyrics(track);
  return plainLyrics(lyrics, lrc);
}

/**
 * Lyrics as plain text: the plain lyrics when there are any, else the LRC
 * lyrics without their ID tags and timestamps. Undefined when nothing is left.
 */
export function plainLyrics(
  lyrics?: string | null,
  lrc?: string | null,
): string | undefined {
  const source = lyrics?.trim() ? lyrics : lrc;
  const text = source
    ?.split("\n")
    .filter((line) => !LRC_ID_TAG.test(line.trim()))
    .map((line) => parseLrcLine(line).text.trim())
    .join("\n")
    .trim();
  return text || undefined;
}

/**
 * The best audio format among the track's available provider mappings: the
 * highest bit depth, then sample rate, then bit rate.
 */
export function bestAudioFormat(track: Track): AudioFormat | undefined {
  let best: AudioFormat | undefined;
  for (const mapping of track.provider_mappings) {
    if (!mapping.available) continue;
    if (!best || compareQuality(mapping.audio_format, best) > 0) {
      best = mapping.audio_format;
    }
  }
  return best;
}

/**
 * A short label for an audio format: "FLAC 24/96" (bit depth / sample rate in
 * kHz) for a lossless codec, "MP3 320" (bit rate in kbps) for a lossy one.
 */
export function audioFormatLabel(format: AudioFormat): string {
  const codec = codecOf(format);
  const name = codec.toUpperCase();
  if (LOSSLESS_CODECS.has(codec)) {
    if (!format.bit_depth || !format.sample_rate) return name;
    return `${name} ${format.bit_depth}/${format.sample_rate / 1000}`;
  }
  return format.bit_rate > 0 ? `${name} ${format.bit_rate}` : name;
}

/**
 * "Album · Vera Lund · 2025": the release's type, artists and year, whichever
 * of those it has.
 */
export function releaseSubtitle(item: MediaItemType | ItemMapping): string {
  const parts: string[] = [];
  if ("album_type" in item && item.album_type !== AlbumType.UNKNOWN) {
    parts.push($t(`album_type.${item.album_type}`));
  }
  if ("artists" in item && item.artists.length) {
    parts.push(getArtistsString(item.artists));
  }
  if ("year" in item && item.year) parts.push(String(item.year));
  return parts.join(" · ");
}

/** The year the track came out: its album's, else the one of its release date. */
export function trackReleaseYear(track: Track): number | undefined {
  if (track.album?.year) return track.album.year;
  const releaseDate = track.metadata?.release_date;
  return releaseDate ? new Date(releaseDate).getUTCFullYear() : undefined;
}

/**
 * The artwork behind the track hero: wide art (fanart, then landscape) of the
 * track or its album, else of the given artist, else the track's cover. No
 * size is passed, so the server serves the original image.
 */
export function trackBackdrop(
  track: Track,
  artist?: Artist,
): string | undefined {
  return (
    getImageThumbForItem(track, ImageType.FANART) ||
    getImageThumbForItem(track, ImageType.LANDSCAPE) ||
    getImageThumbForItem(artist, ImageType.FANART) ||
    getImageThumbForItem(artist, ImageType.LANDSCAPE) ||
    getImageThumbForItem(track, ImageType.THUMB)
  );
}

/** Whether the two tracks share a provider mapping, i.e. are the same recording. */
function sharesMapping(a: Track, b: Track): boolean {
  return b.provider_mappings.some((reference) =>
    a.provider_mappings.some(
      (mapping) =>
        mapping.item_id === reference.item_id &&
        mapping.provider_domain === reference.provider_domain,
    ),
  );
}

/** Positive when `a` is the higher quality: by bit depth, then sample rate, then bit rate. */
function compareQuality(a: AudioFormat, b: AudioFormat): number {
  return (
    a.bit_depth - b.bit_depth ||
    a.sample_rate - b.sample_rate ||
    a.bit_rate - b.bit_rate
  );
}

/** The format's codec, or its container when the codec is not known. */
function codecOf(format: AudioFormat): ContentType {
  return format.codec_type === ContentType.UNKNOWN
    ? format.content_type
    : format.codec_type;
}
