export const RICKROLL_AUDIO_URL =
  "https://archive.org/download/07-mix-stereo/07%20Mix%20%28Stereo%29.mp3";

export const RICKROLL_ART_URL =
  "https://archive.org/services/img/07-mix-stereo";

export const RICKROLL_TRACK = {
  title: "Never Gonna Give You Up",
  artist: "Rick Astley",
  album: "Whenever You Need Somebody",
};

// The track has a low-energy intro; skip ahead so it starts on the first beat.
export const RICKROLL_START_OFFSET = 5.5;

// When played through a real player, the backend reports the raw archive URL as
// the player's "current media" — giving an ugly filename title and no artwork.
// This matches that media so the player OSD can show proper metadata instead.
export function isRickrollUri(uri?: string): boolean {
  return !!uri && uri.includes("07-mix-stereo");
}
