import { MUSIC_QUIZ_ANSWER_TYPES } from "@/components/music-quiz/answer_types";
import {
  DEFAULT_MUSIC_QUIZ_GAME_TYPE,
  MUSIC_QUIZ_GAME_TYPES,
  resolveMusicQuizDefinition,
} from "@/components/music-quiz/game_types";
import type {
  MusicQuizAnswerType,
  MusicQuizGameAnswerTypeMap,
  MusicQuizGuessTheSongHostState,
  MusicQuizGuessTheSongPersonalizedState,
  MusicQuizGuessTheSongRound,
  MusicQuizType,
} from "@/composables/useMusicQuiz";
import { shallowMount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/MediaItemThumb.vue", () => ({
  default: {
    template: "<div />",
  },
}));

vi.mock("@/plugins/i18n", () => ({
  $t: (key: string) => key,
  i18n: {
    global: {
      locale: { value: "en" },
    },
  },
}));

vi.mock("@/helpers/utils", () => ({
  copyToClipboard: vi.fn(),
  getAvatarImage: () => "",
  getImageThumbForItem: () => "",
  getMediaImageUrl: (url: string) => url,
}));

vi.mock("@/plugins/api", () => ({
  default: {
    getItemByUri: vi.fn(),
    getTrackLyrics: vi.fn(),
    search: vi.fn(),
  },
}));

const currentRound = {
  question: "Which song is playing?",
  round_index: 0,
  started_at: 1,
  deadline: Date.now() / 1000 + 30,
  suggestions: [
    { suggestion_id: "one", label: "One" },
    { suggestion_id: "two", label: "Two" },
  ],
} satisfies MusicQuizGuessTheSongRound;

const playerState = {
  quiz_type: "guess_the_song",
  answer_type: "multiple_choice",
  phase: "answering",
  name: "Quiz",
  round_count: 5,
  suggestion_count: 2,
  answer_duration: 30,
  mode: "venue",
  players: [],
  current_round: currentRound,
  you: {
    name: "Player",
    score: 0,
    ready: false,
    active_from_round: 0,
  },
} satisfies MusicQuizGuessTheSongPersonalizedState;

const hostState = {
  quiz_type: "guess_the_song",
  answer_type: "multiple_choice",
  phase: "answering",
  name: "Quiz",
  round_count: 5,
  suggestion_count: 2,
  answer_duration: 30,
  mode: "venue",
  players: [],
  current_round: currentRound,
  created_at: 1,
  sources: [],
  join_url: "https://example.test/join",
  rounds: [currentRound],
} satisfies MusicQuizGuessTheSongHostState;

interface GameMountFixture {
  playerState: MusicQuizGuessTheSongPersonalizedState;
  hostState: MusicQuizGuessTheSongHostState;
  currentRound: MusicQuizGuessTheSongRound;
}

const GAME_MOUNT_FIXTURES = {
  guess_the_song: {
    playerState,
    hostState,
    currentRound,
  },
} satisfies Record<MusicQuizType, GameMountFixture>;

const ANSWER_MOUNT_FIXTURES = {
  multiple_choice: {
    playerState,
    hostState,
    currentRound,
  },
} satisfies Record<MusicQuizAnswerType, GameMountFixture>;

describe("Music Quiz registries", () => {
  it("contains every game and answer exactly once", () => {
    expect(MUSIC_QUIZ_GAME_TYPES.map((game) => game.id)).toEqual([
      "guess_the_song",
    ]);
    expect(MUSIC_QUIZ_ANSWER_TYPES.map((answer) => answer.id)).toEqual([
      "multiple_choice",
    ]);
    expect(new Set(MUSIC_QUIZ_GAME_TYPES.map((game) => game.id)).size).toBe(
      MUSIC_QUIZ_GAME_TYPES.length,
    );
    expect(
      new Set(MUSIC_QUIZ_ANSWER_TYPES.map((answer) => answer.id)).size,
    ).toBe(MUSIC_QUIZ_ANSWER_TYPES.length);
    expect(
      MUSIC_QUIZ_GAME_TYPES.some(
        (game) => game.id === DEFAULT_MUSIC_QUIZ_GAME_TYPE,
      ),
    ).toBe(true);
  });

  it("resolves only the declared game and answer pair", () => {
    for (const game of MUSIC_QUIZ_GAME_TYPES) {
      for (const answer of MUSIC_QUIZ_ANSWER_TYPES) {
        const resolved = resolveMusicQuizDefinition(game.id, answer.id);
        expect(!!resolved).toBe(game.answerType === answer.id);
      }
    }

    expect(
      resolveMusicQuizDefinition("future_game", "multiple_choice"),
    ).toBeUndefined();
    expect(
      resolveMusicQuizDefinition("guess_the_song", "timeline"),
    ).toBeUndefined();
  });

  it("keeps the game-to-answer mapping exact", () => {
    const mapping = Object.fromEntries(
      MUSIC_QUIZ_GAME_TYPES.map((game) => [game.id, game.answerType]),
    );
    const expected = {
      guess_the_song: "multiple_choice",
    } satisfies MusicQuizGameAnswerTypeMap;

    expect(mapping).toEqual(expected);
  });

  it.each(MUSIC_QUIZ_GAME_TYPES)("mounts every $id game adapter", (game) => {
    const fixture = GAME_MOUNT_FIXTURES[game.id];
    const wrappers = [
      shallowMount(game.adapters.setup, {
        props: { busy: false },
      }),
      shallowMount(game.adapters.player, {
        props: {
          state: fixture.playerState,
          currentRound: fixture.currentRound,
          busy: false,
        },
      }),
      shallowMount(game.adapters.hostPanel, {
        props: {
          state: fixture.hostState,
          currentRound: fixture.currentRound,
        },
      }),
      shallowMount(game.adapters.host, {
        props: {
          state: fixture.hostState,
          currentRound: fixture.currentRound,
        },
      }),
      shallowMount(game.adapters.present, {
        props: {
          state: fixture.hostState,
          currentRound: fixture.currentRound,
        },
      }),
    ];

    expect(wrappers.every((wrapper) => wrapper.exists())).toBe(true);
    wrappers.forEach((wrapper) => wrapper.unmount());
  });

  it.each(MUSIC_QUIZ_ANSWER_TYPES)(
    "mounts every $id answer adapter",
    (answer) => {
      const fixture = ANSWER_MOUNT_FIXTURES[answer.id];
      const wrappers = [
        shallowMount(answer.adapters.player, {
          props: {
            state: fixture.playerState,
            currentRound: fixture.currentRound,
            busy: false,
          },
        }),
        shallowMount(answer.adapters.host, {
          props: {
            state: fixture.hostState,
            currentRound: fixture.currentRound,
          },
          slots: { leaderboard: "<div>Leaderboard</div>" },
        }),
        shallowMount(answer.adapters.present, {
          props: {
            state: fixture.hostState,
            currentRound: fixture.currentRound,
          },
          slots: { leaderboard: "<div>Leaderboard</div>" },
        }),
      ];

      expect(wrappers.every((wrapper) => wrapper.exists())).toBe(true);
      wrappers.forEach((wrapper) => wrapper.unmount());
    },
  );
});
