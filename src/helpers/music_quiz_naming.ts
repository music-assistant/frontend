export const MUSIC_QUIZ_NAME_ADJECTIVES = [
  "Neon",
  "Golden",
  "Midnight",
  "Cosmic",
  "Electric",
  "Velvet",
  "Lucky",
  "Hidden",
] as const;

export const MUSIC_QUIZ_NAME_NOUNS = [
  "Mixtape",
  "Groove",
  "Encore",
  "Jukebox",
  "Chorus",
  "Setlist",
  "Playlist",
  "Jam",
] as const;

/**
 * A playful, unique-enough default session name such as "Neon Jukebox 21:45",
 * combining a random adjective and noun with the current time.
 */
export function generateMusicQuizSessionName(now: Date = new Date()): string {
  const seeds = new Uint32Array(2);
  crypto.getRandomValues(seeds);
  const adjective =
    MUSIC_QUIZ_NAME_ADJECTIVES[seeds[0] % MUSIC_QUIZ_NAME_ADJECTIVES.length];
  const noun = MUSIC_QUIZ_NAME_NOUNS[seeds[1] % MUSIC_QUIZ_NAME_NOUNS.length];
  const time = now.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${adjective} ${noun} ${time}`;
}
