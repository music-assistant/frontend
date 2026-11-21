import type {
  MusicQuizHintSpeed,
  MusicQuizHintTextMask,
  MusicQuizHintTextPlayer,
  MusicQuizTypoTolerance,
} from "@/composables/music-quiz/useMusicQuiz";
import { $t } from "@/plugins/i18n";

export interface MusicQuizHintTextCell {
  // null while the letter is still hidden
  character: string | null;
  hidden: boolean;
}

export type MusicQuizHintTextWord = MusicQuizHintTextCell[];

const WORD_SEPARATOR = " ";
// mirrors MAX_GUESS_LENGTH in the server's answer_types/hint_text.py
export const MUSIC_QUIZ_HINT_TEXT_MAX_GUESS_LENGTH = 200;

/**
 * Split a hint mask into words so a title only wraps between words.
 *
 * Spaces separate words and are dropped; every other visible character,
 * such as punctuation, stays inside the word it belongs to.
 */
export function splitHintTextMask(
  mask: MusicQuizHintTextMask,
): MusicQuizHintTextWord[] {
  const words: MusicQuizHintTextWord[] = [];
  let currentWord: MusicQuizHintTextWord = [];
  for (const character of mask) {
    if (character === WORD_SEPARATOR) {
      if (currentWord.length) words.push(currentWord);
      currentWord = [];
      continue;
    }
    currentWord.push({ character, hidden: character === null });
  }
  if (currentWord.length) words.push(currentWord);
  return words;
}

/** Count the letters of a hint mask that are still hidden. */
export function countHiddenHintLetters(mask: MusicQuizHintTextMask): number {
  return mask.filter((character) => character === null).length;
}

/** Return the players who guessed the title, fastest first. */
export function getHintTextSolvers<T extends MusicQuizHintTextPlayer>(
  players: T[],
): T[] {
  return players
    .filter((player) => player.solved_rank !== null)
    .sort((a, b) => (a.solved_rank ?? 0) - (b.solved_rank ?? 0));
}

export function getMusicQuizHintSpeedOptions(): {
  value: MusicQuizHintSpeed;
  label: string;
}[] {
  return [
    {
      value: "slow",
      label: $t("providers.music_quiz.title_reveal_hint_speed_slow"),
    },
    {
      value: "normal",
      label: $t("providers.music_quiz.title_reveal_hint_speed_normal"),
    },
    {
      value: "fast",
      label: $t("providers.music_quiz.title_reveal_hint_speed_fast"),
    },
  ];
}

export function getMusicQuizTypoToleranceOptions(): {
  value: MusicQuizTypoTolerance;
  label: string;
}[] {
  return [
    {
      value: "strict",
      label: $t("providers.music_quiz.title_reveal_typo_tolerance_strict"),
    },
    {
      value: "normal",
      label: $t("providers.music_quiz.title_reveal_typo_tolerance_normal"),
    },
    {
      value: "lenient",
      label: $t("providers.music_quiz.title_reveal_typo_tolerance_lenient"),
    },
  ];
}
