import MusicTimelinePresentBody from "@/components/music-quiz/game-types/music-timeline/MusicTimelinePresentBody.vue";
import type { MusicQuizLeaderboardRow } from "@/components/music-quiz/MusicQuizLeaderboard.vue";
import type {
  MusicQuizTimelineEntry,
  MusicQuizTimelineHostState,
  MusicQuizTimelineRound,
} from "@/composables/useMusicQuiz";
import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/plugins/i18n", () => ({
  $t: (key: string) => key,
}));

vi.mock("@/helpers/utils", () => ({
  getAvatarImage: () => "",
  getMediaImageUrl: (url: string) => url,
}));

const entries = Array.from({ length: 12 }, (_, index) => ({
  entry_id: `entry-${index}`,
  release_year: 1980 + index,
  title: `Song ${index}`,
  artist: `Artist ${index}`,
  track_uri: `library://track/${index}`,
  image_url: null,
  is_anchor: index === 0,
})) satisfies MusicQuizTimelineEntry[];
const revealedEntry = entries.at(-1)!;
const currentRound = {
  round_index: 0,
  started_at: 1,
  deadline: 31,
  auto_advance_at: null,
  question: null,
  timeline: entries,
  bonus_definitions: [],
  revealed_entry: revealedEntry,
  answer_label: `${revealedEntry.artist} - ${revealedEntry.title}`,
  track_uri: revealedEntry.track_uri,
  image_url: revealedEntry.image_url,
  duration: 180,
  ended_at: 20,
} satisfies MusicQuizTimelineRound;
const players = Array.from({ length: 24 }, (_, index) => ({
  name: `Player ${index + 1} with a safely truncated long name`,
  score: 24_000 - index * 100,
  ready: false,
  answered: true,
  active_from_round: 0,
  placed: true,
  artist_bonus_answered: true,
  title_bonus_answered: true,
  last_answer: {
    placement: {
      previous_entry_id: entries.at(-2)!.entry_id,
      next_entry_id: null,
      correct: index % 2 === 0,
      points: index % 2 === 0 ? 1_000 : 0,
    },
    artist: {
      correct: true,
      points: 250,
    },
    title: {
      correct: true,
      points: 250,
    },
  },
}));
const state = {
  quiz_type: "music_timeline",
  answer_type: "timeline",
  phase: "reveal",
  name: "Music Timeline",
  round_count: 12,
  answer_duration: 30,
  artist_bonus_mode: "free_text",
  title_bonus_mode: "free_text",
  mode: "venue",
  players,
  current_round: currentRound,
  created_at: 1,
  sources: [],
  join_url: "https://example.test/join",
  rounds: [],
} satisfies MusicQuizTimelineHostState;
const leaderboardRows = players.map((player, index) => ({
  ...player,
  rank: index + 1,
  roundScoreLabel: index === 0 ? "+1500" : "",
})) satisfies MusicQuizLeaderboardRow[];

describe("MusicTimelinePresentBody", () => {
  it("keeps song and score panels before the bottom timeline", () => {
    const wrapper = mount(MusicTimelinePresentBody, {
      props: {
        state,
        currentRound,
        leaderboardRows,
      },
    });
    const body = wrapper.get('[data-testid="music-timeline-present-body"]');
    const currentSong = wrapper.get('[data-testid="music-timeline-round"]');
    const results = wrapper.get('[data-testid="timeline-round-results"]');
    const leaderboard = wrapper.get(
      '[aria-label="providers.music_quiz.leaderboard"]',
    );
    const history = wrapper.get('[data-testid="music-timeline-history"]');

    expect(body.classes()).toEqual(
      expect.arrayContaining([
        "flex",
        "flex-col",
        "min-h-0",
        "lg:grid",
        "lg:flex-1",
        "lg:overflow-hidden",
      ]),
    );
    expect(body.classes()).not.toContain("overflow-hidden");
    for (const panel of [currentSong, results, leaderboard]) {
      expect(
        panel.element.compareDocumentPosition(history.element) &
          Node.DOCUMENT_POSITION_FOLLOWING,
      ).toBeTruthy();
    }
    expect(currentSong.attributes("data-compact")).toBe("true");
    expect(results.attributes("role")).toBe("region");
    expect(leaderboard.attributes("role")).toBe("region");
  });

  it("bounds many-player results and gives the leaderboard internal scroll", () => {
    const wrapper = mount(MusicTimelinePresentBody, {
      props: {
        state,
        currentRound,
        leaderboardRows,
      },
    });
    const results = wrapper.get('[data-testid="timeline-round-results"]');
    const resultsContent = results.get('[data-slot="card-content"]');
    const leaderboardRegion = wrapper.get(
      '[data-testid="timeline-leaderboard-region"]',
    );
    const leaderboard = leaderboardRegion.get('[data-slot="card"]');
    const leaderboardContent = leaderboard.get('[data-slot="card-content"]');

    expect(results.classes()).toEqual(
      expect.arrayContaining(["lg:min-h-0", "lg:overflow-hidden"]),
    );
    expect(resultsContent.classes()).toEqual(
      expect.arrayContaining(["lg:min-h-0", "lg:overflow-y-auto"]),
    );
    const resultScore = results.get('[data-testid="timeline-result-score"]');
    expect(resultScore.classes()).not.toContain("shrink-0");
    expect(resultScore.get("span.truncate").classes()).toEqual(
      expect.arrayContaining(["min-w-0", "flex-1"]),
    );
    expect(leaderboardRegion.classes()).toEqual(
      expect.arrayContaining(["lg:min-h-0", "lg:overflow-hidden"]),
    );
    expect(leaderboard.classes()).toEqual(
      expect.arrayContaining(["min-h-0", "overflow-hidden", "lg:h-full"]),
    );
    expect(leaderboardContent.classes()).toEqual(
      expect.arrayContaining(["min-h-0", "flex-1", "overflow-y-auto"]),
    );
    expect(results.findAll("li")).toHaveLength(players.length);
    expect(leaderboard.findAll("li")).toHaveLength(players.length);
  });

  it("renders a small chronological highlighted strip without vertical growth", () => {
    const wrapper = mount(MusicTimelinePresentBody, {
      props: {
        state,
        currentRound,
        leaderboardRows,
      },
    });
    const history = wrapper.get('[data-testid="music-timeline-history"]');
    const scrollArea = history.get("[data-timeline-scroll]");
    const cards = history.findAll("article");

    expect(history.attributes("data-orientation")).toBe("horizontal");
    expect(history.classes()).toContain("lg:col-span-2");
    expect(scrollArea.classes()).toEqual(
      expect.arrayContaining(["min-w-0", "overflow-x-auto"]),
    );
    expect(history.get("ol").classes()).toEqual(
      expect.arrayContaining(["w-max", "min-w-full", "flex-row"]),
    );
    expect(cards.map((card) => card.attributes("data-entry-id"))).toEqual(
      entries.map((entry) => entry.entry_id),
    );
    expect(
      cards.every((card) => card.attributes("data-compact") === "true"),
    ).toBe(true);
    expect(
      history.get(`[data-entry-id="${revealedEntry.entry_id}"]`).classes(),
    ).toContain("border-primary");
    expect(
      history
        .findAll("li")
        .filter((item) => item.find("article").exists())
        .every((item) => item.classes().includes("shrink-0")),
    ).toBe(true);
  });
});
