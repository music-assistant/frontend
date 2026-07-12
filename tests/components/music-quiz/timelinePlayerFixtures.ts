import type {
  MusicQuizTimelinePersonalizedState,
  MusicQuizTimelineRound,
  MusicQuizTimelineBonusAnswer,
} from "@/composables/useMusicQuiz";

export const anchor = {
  entry_id: "anchor",
  release_year: 1990,
  title: "Anchor",
  artist: "Known Artist",
  track_uri: "library://track/anchor",
  image_url: null,
  is_anchor: true,
} as const;

export const baseRound = {
  round_index: 0,
  started_at: 1,
  deadline: Date.now() / 1000 + 30,
  auto_advance_at: null,
  question: null,
  timeline: [anchor],
  bonus_definitions: [],
} satisfies MusicQuizTimelineRound;

export const player = {
  name: "Player",
  score: 0,
  ready: false,
  answered: false,
  active_from_round: 0,
  placed: false,
  artist_bonus_answered: false,
  title_bonus_answered: false,
};

export const baseState = {
  quiz_type: "music_timeline",
  answer_type: "timeline",
  phase: "answering",
  name: "Music Timeline",
  round_count: 1,
  answer_duration: 30,
  artist_bonus_mode: "off",
  title_bonus_mode: "off",
  mode: "venue",
  players: [player],
  current_round: baseRound,
  you: {
    name: "Player",
    score: 0,
    ready: false,
    active_from_round: 0,
  },
} satisfies MusicQuizTimelinePersonalizedState;

export const bonusRound = {
  ...baseRound,
  bonus_definitions: [
    {
      bonus_type: "artist",
      mode: "free_text",
    },
    {
      bonus_type: "title",
      mode: "multiple_choice",
      options: [
        { option_id: "title-a", label: "Title A" },
        { option_id: "title-b", label: "Title B" },
      ],
    },
  ],
} satisfies MusicQuizTimelineRound;

export function stateWithAnswer(
  bonuses: MusicQuizTimelineBonusAnswer[] = [],
  finished = false,
): MusicQuizTimelinePersonalizedState {
  return {
    ...baseState,
    artist_bonus_mode: "free_text",
    title_bonus_mode: "multiple_choice",
    players: [
      {
        ...player,
        placed: true,
        artist_bonus_answered: bonuses.some(
          (answer) => answer.bonus_type === "artist",
        ),
        title_bonus_answered: bonuses.some(
          (answer) => answer.bonus_type === "title",
        ),
        answered: finished,
      },
    ],
    you: {
      ...baseState.you,
      answer: {
        previous_entry_id: "anchor",
        next_entry_id: null,
        answered_at: 10,
        bonuses,
        finished,
      },
    },
  };
}
