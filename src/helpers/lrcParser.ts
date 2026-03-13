// Word-level timing for Enhanced LRC (A2 format)
export interface LyricWord {
  time: number; // start time in seconds
  text: string;
}

export interface ParsedLyric {
  time: number;
  text: string;
  words?: LyricWord[];
}

/**
 * Parse a timestamp string "mm:ss.xx" into seconds.
 */
export const parseTimestamp = (
  minutes: string,
  seconds: string,
  fraction?: string,
): number => {
  const min = parseInt(minutes);
  const sec = parseInt(seconds);
  let ms = 0;
  if (fraction) {
    const decimalPart = fraction.replace(/[.:]/, ".");
    ms = Math.round(parseFloat(decimalPart) * 1000);
  }
  return (min * 60 * 1000 + sec * 1000 + ms) / 1000;
};

/**
 * Parse Enhanced LRC word timestamps from line text.
 * Format: "<mm:ss.xx> word <mm:ss.xx> word ..."
 */
export const parseWordTimestamps = (text: string): LyricWord[] | undefined => {
  const wordPattern = /<(\d+):(\d+)([.:]\d+)?>\s*([^<]*)/g;
  const words: LyricWord[] = [];
  let match;
  while ((match = wordPattern.exec(text)) !== null) {
    const time = parseTimestamp(match[1], match[2], match[3]);
    const word = match[4].trim();
    if (word) {
      words.push({ time, text: word });
    }
  }
  return words.length > 0 ? words : undefined;
};

/**
 * Parse a single LRC line like "[00:29.79] Some lyric text" into {time, text}.
 * Also detects Enhanced LRC (A2) word-level timestamps like <00:00.04>.
 */
export const parseLrcLine = (line: string): ParsedLyric => {
  const match = line.match(/\[(\d+):(\d+)([.:]\d+)?\](.*)/);
  if (match) {
    const time = parseTimestamp(match[1], match[2], match[3]);
    const rawText = match[4];
    const words = parseWordTimestamps(rawText);
    const text = words
      ? words.map((w) => w.text).join(" ")
      : rawText.trim() || " ";
    return { time, text, words };
  }
  return { time: 0, text: line.trim() || " " };
};
