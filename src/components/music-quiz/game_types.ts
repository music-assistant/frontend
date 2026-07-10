import MusicQuizGuessTheSongConfig from "@/components/music-quiz/MusicQuizGuessTheSongConfig.vue";
import type { MusicQuizType } from "@/composables/useMusicQuiz";
import { Disc3 } from "@lucide/vue";
import { markRaw, type Component } from "vue";

export const DEFAULT_MUSIC_QUIZ_GAME_TYPE: MusicQuizType = "guess_the_song";

export interface MusicQuizGameTypeOption {
  /** Value sent to the server as `quiz_type`. */
  id: MusicQuizType;
  labelKey: string;
  descriptionKey: string;
  icon: Component;
  /** Selectable now, or shown as a disabled "coming soon" teaser. */
  available: boolean;
  /** Config step rendered for this type in the setup wizard. */
  configComponent: Component;
}

/**
 * Registry of Music Quiz game types. Adding a type here (with its config step)
 * makes it appear in the setup wizard without touching the wizard itself.
 */
const MUSIC_QUIZ_GAME_TYPE_REGISTRY: Record<
  MusicQuizType,
  MusicQuizGameTypeOption
> = {
  guess_the_song: {
    id: "guess_the_song",
    labelKey: "providers.music_quiz.game_type_guess_the_song",
    descriptionKey: "providers.music_quiz.game_type_guess_the_song_description",
    icon: markRaw(Disc3),
    available: true,
    configComponent: markRaw(MusicQuizGuessTheSongConfig),
  },
};

export const MUSIC_QUIZ_GAME_TYPES = Object.values(
  MUSIC_QUIZ_GAME_TYPE_REGISTRY,
);

export function getMusicQuizGameType(
  id: string,
): MusicQuizGameTypeOption | undefined {
  return MUSIC_QUIZ_GAME_TYPES.find((type) => type.id === id);
}
