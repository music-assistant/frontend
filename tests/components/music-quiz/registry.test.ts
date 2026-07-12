import { MUSIC_QUIZ_ANSWER_TYPES } from "@/components/music-quiz/answer_types";
import {
  DEFAULT_MUSIC_QUIZ_GAME_TYPE,
  MUSIC_QUIZ_GAME_TYPES,
  isMusicQuizGameAvailable,
  resolveMusicQuizDefinition,
} from "@/components/music-quiz/game_types";
import type {
  MusicQuizAnswerType,
  MusicQuizGameAnswerTypeMap,
  MusicQuizGuessTheSongHostState,
  MusicQuizGuessTheSongPersonalizedState,
  MusicQuizGuessTheSongRound,
  MusicQuizTimelineHostState,
  MusicQuizTimelinePersonalizedState,
  MusicQuizTimelineRound,
  MusicQuizSupportedHostState,
  MusicQuizSupportedPersonalizedState,
  MusicQuizSupportedRound,
  MusicQuizTriviaHostState,
  MusicQuizTriviaPersonalizedState,
  MusicQuizTriviaRound,
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
  auto_advance_at: null,
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

const musicTimelineRound = {
  question: null,
  round_index: 0,
  started_at: 1,
  deadline: Date.now() / 1000 + 30,
  auto_advance_at: null,
  timeline: [
    {
      entry_id: "anchor",
      release_year: 1990,
      title: "Anchor",
      artist: "Artist",
      track_uri: "library://track/anchor",
      image_url: null,
      is_anchor: true,
    },
  ],
  bonus_definitions: [],
} satisfies MusicQuizTimelineRound;

const musicTimelinePlayerState = {
  quiz_type: "music_timeline",
  answer_type: "timeline",
  phase: "answering",
  name: "Music Timeline",
  round_count: 5,
  answer_duration: 30,
  artist_bonus_mode: "off",
  title_bonus_mode: "off",
  mode: "venue",
  players: [],
  current_round: musicTimelineRound,
  you: {
    name: "Player",
    score: 0,
    ready: false,
    active_from_round: 0,
  },
} satisfies MusicQuizTimelinePersonalizedState;

const musicTimelineHostState = {
  quiz_type: "music_timeline",
  answer_type: "timeline",
  phase: "answering",
  name: "Music Timeline",
  round_count: 5,
  answer_duration: 30,
  artist_bonus_mode: "off",
  title_bonus_mode: "off",
  mode: "venue",
  players: [],
  current_round: musicTimelineRound,
  created_at: 1,
  sources: [],
  join_url: "https://example.test/join",
  rounds: [],
} satisfies MusicQuizTimelineHostState;

const triviaRound = {
  question: "Which artist released this album?",
  round_index: 0,
  started_at: 1,
  deadline: Date.now() / 1000 + 30,
  auto_advance_at: null,
  suggestions: [
    { suggestion_id: "one", label: "Artist One" },
    { suggestion_id: "two", label: "Artist Two" },
  ],
} satisfies MusicQuizTriviaRound;

const triviaPlayerState = {
  quiz_type: "trivia",
  answer_type: "multiple_choice",
  language: "en",
  phase: "answering",
  name: "Trivia",
  round_count: 5,
  suggestion_count: 2,
  answer_duration: 30,
  mode: "venue",
  players: [],
  current_round: triviaRound,
  you: {
    name: "Player",
    score: 0,
    ready: false,
    active_from_round: 0,
  },
} satisfies MusicQuizTriviaPersonalizedState;

const triviaHostState = {
  ...triviaPlayerState,
  created_at: 1,
  sources: [],
  join_url: "https://example.test/join",
  rounds: [],
} satisfies MusicQuizTriviaHostState;

interface GameMountFixture {
  playerState: MusicQuizSupportedPersonalizedState;
  hostState: MusicQuizSupportedHostState;
  currentRound: MusicQuizSupportedRound;
}

const GAME_MOUNT_FIXTURES = {
  guess_the_song: {
    playerState,
    hostState,
    currentRound,
  },
  music_timeline: {
    playerState: musicTimelinePlayerState,
    hostState: musicTimelineHostState,
    currentRound: musicTimelineRound,
  },
  trivia: {
    playerState: triviaPlayerState,
    hostState: triviaHostState,
    currentRound: triviaRound,
  },
} satisfies Record<MusicQuizType, GameMountFixture>;

const ANSWER_MOUNT_FIXTURES = {
  multiple_choice: {
    playerState,
    hostState,
    currentRound,
  },
  timeline: {
    playerState: musicTimelinePlayerState,
    hostState: musicTimelineHostState,
    currentRound: musicTimelineRound,
  },
} satisfies Record<MusicQuizAnswerType, GameMountFixture>;

describe("Music Quiz registries", () => {
  it("contains every game and answer exactly once", () => {
    expect(MUSIC_QUIZ_GAME_TYPES.map((game) => game.id)).toEqual([
      "guess_the_song",
      "music_timeline",
      "trivia",
    ]);
    expect(MUSIC_QUIZ_ANSWER_TYPES.map((answer) => answer.id)).toEqual([
      "multiple_choice",
      "timeline",
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
      music_timeline: "timeline",
      trivia: "multiple_choice",
    } satisfies MusicQuizGameAnswerTypeMap;

    expect(mapping).toEqual(expected);
    expect(
      MUSIC_QUIZ_GAME_TYPES.find((game) => game.id === "music_timeline")
        ?.supportsListenIn,
    ).toBe(true);
    expect(
      MUSIC_QUIZ_GAME_TYPES.find((game) => game.id === "trivia")
        ?.supportsListenIn,
    ).toBe(false);
  });

  it("gates only Trivia on backend availability", () => {
    const guess = MUSIC_QUIZ_GAME_TYPES.find(
      (game) => game.id === "guess_the_song",
    );
    const musicTimeline = MUSIC_QUIZ_GAME_TYPES.find(
      (game) => game.id === "music_timeline",
    );
    const trivia = MUSIC_QUIZ_GAME_TYPES.find((game) => game.id === "trivia");

    expect(guess && isMusicQuizGameAvailable(guess, [])).toBe(true);
    expect(musicTimeline && isMusicQuizGameAvailable(musicTimeline, [])).toBe(
      true,
    );
    expect(trivia && isMusicQuizGameAvailable(trivia, [])).toBe(false);
    expect(trivia && isMusicQuizGameAvailable(trivia, ["trivia"])).toBe(true);
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
