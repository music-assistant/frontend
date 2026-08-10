import TimelineAudienceAnswer from "@/components/music-quiz/answer-types/timeline/TimelineAudienceAnswer.vue";
import TimelineDisplay from "@/components/music-quiz/answer-types/timeline/TimelineDisplay.vue";
import TimelineProgress from "@/components/music-quiz/answer-types/timeline/TimelineProgress.vue";
import type {
  MusicQuizTimelineHostRound,
  MusicQuizTimelineHostState,
  MusicQuizTimelineRound,
} from "@/composables/music-quiz/useMusicQuiz";
import { mount, shallowMount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/plugins/i18n", () => ({
  $t: (key: string) => key,
}));

vi.mock("@/helpers/utils", () => ({
  getAvatarImage: () => "",
  getMediaImageUrl: (url: string) => url,
}));

const anchor = {
  entry_id: "anchor",
  release_year: 1990,
  title: "Anchor Song",
  artist: "Known Artist",
  track_uri: "library://track/anchor",
  image_url: null,
  is_anchor: true,
} as const;
const currentRound = {
  round_index: 0,
  started_at: 1,
  deadline: Date.now() / 1000 + 30,
  auto_advance_at: null,
  question: null,
  timeline: [anchor],
  bonus_definitions: [
    {
      bonus_type: "artist",
      mode: "free_text",
    },
  ],
} satisfies MusicQuizTimelineRound;
const protectedHostRound = {
  round_index: 0,
  answer_label: "SECRET ARTIST - SECRET TITLE",
  placement_snapshot: [anchor],
  candidate: {
    entry: {
      ...anchor,
      entry_id: "secret",
      title: "SECRET TITLE",
      artist: "SECRET ARTIST",
      is_anchor: false,
    },
    artist_answers: ["SECRET ARTIST"],
    title_answers: ["SECRET TITLE"],
  },
  bonus_definitions: [],
  placements: {},
  bonus_answers: {},
  finished_at: {},
  results: {},
  revealed: false,
  track_uri: "library://track/secret",
  question: null,
  image_url: null,
  duration: 180,
  started_at: 1,
  ended_at: null,
  auto_advance_at: null,
} satisfies MusicQuizTimelineHostRound;

const hostState = {
  quiz_type: "music_timeline",
  answer_type: "timeline",
  phase: "answering",
  name: "Music Timeline",
  round_count: 1,
  answer_duration: 30,
  artist_bonus_mode: "free_text",
  title_bonus_mode: "off",
  mode: "venue",
  players: [
    {
      name: "Placed",
      score: 0,
      ready: false,
      answered: false,
      active_from_round: 0,
      placed: true,
      artist_bonus_answered: false,
      title_bonus_answered: false,
    },
    {
      name: "Complete",
      score: 0,
      ready: false,
      answered: true,
      active_from_round: 0,
      placed: true,
      artist_bonus_answered: true,
      title_bonus_answered: false,
    },
    {
      name: "Late",
      score: 0,
      ready: false,
      answered: false,
      active_from_round: 1,
      placed: false,
      artist_bonus_answered: false,
      title_bonus_answered: false,
    },
  ],
  current_round: currentRound,
  created_at: 1,
  sources: [],
  join_url: "https://example.test/join",
  rounds: [protectedHostRound],
} satisfies MusicQuizTimelineHostState;

describe("timeline host and present answers", () => {
  it("uses only the redacted current round before reveal", () => {
    const wrapper = shallowMount(TimelineAudienceAnswer, {
      props: {
        state: hostState,
        currentRound,
      },
      slots: {
        leaderboard: '<div data-testid="leaderboard">Leaderboard</div>',
      },
    });

    expect(wrapper.getComponent(TimelineDisplay).props("entries")).toEqual([
      anchor,
    ]);
    expect(wrapper.getComponent(TimelineDisplay).props("selectable")).toBe(
      false,
    );
    expect(wrapper.getComponent(TimelineProgress).props("statuses")).toEqual(
      hostState.players.slice(0, 2),
    );
    expect(wrapper.text()).not.toContain("SECRET TITLE");
    expect(wrapper.html()).not.toContain("library://track/secret");
  });

  it("excludes late joiners from host and present progress totals", () => {
    for (const present of [false, true]) {
      const wrapper = shallowMount(TimelineAudienceAnswer, {
        props: {
          state: hostState,
          currentRound,
          present,
        },
        slots: {
          leaderboard: "<div>Leaderboard</div>",
        },
      });

      expect(wrapper.getComponent(TimelineProgress).props("statuses")).toEqual(
        hostState.players.slice(0, 2),
      );
      expect(wrapper.getComponent(TimelineProgress).props("scrollable")).toBe(
        present,
      );
      wrapper.unmount();
    }
  });

  it("contains long present progress lists with internal scrolling", () => {
    const wrapper = mount(TimelineProgress, {
      props: {
        statuses: hostState.players,
        scrollable: true,
      },
    });

    expect(wrapper.get('[data-slot="card"]').classes()).toEqual(
      expect.arrayContaining(["min-h-0", "overflow-hidden"]),
    );
    expect(wrapper.get('[data-slot="card-content"]').classes()).toEqual(
      expect.arrayContaining([
        "min-h-0",
        "flex-1",
        "overflow-y-auto",
        "overscroll-contain",
      ]),
    );
  });

  it("shows aggregate reveal results and preserves the leaderboard slot", () => {
    const revealedEntry = {
      ...anchor,
      entry_id: "current",
      release_year: 2000,
      title: "Revealed",
      is_anchor: false,
    };
    const revealedRound = {
      ...currentRound,
      timeline: [anchor, revealedEntry],
      revealed_entry: revealedEntry,
      answer_label: "Known Artist - Revealed",
      track_uri: "library://track/current",
      image_url: null,
      duration: 180,
      ended_at: 20,
    } satisfies MusicQuizTimelineRound;
    const state = {
      ...hostState,
      phase: "reveal",
      current_round: revealedRound,
      players: [
        {
          ...hostState.players[1],
          score: 250,
          last_answer: {
            placement: {
              previous_entry_id: "anchor",
              next_entry_id: null,
              correct: false,
              points: 0,
            },
            artist: {
              correct: true,
              points: 250,
            },
          },
        },
      ],
    } satisfies MusicQuizTimelineHostState;
    const wrapper = mount(TimelineAudienceAnswer, {
      props: {
        state,
        currentRound: revealedRound,
        present: true,
      },
      slots: {
        leaderboard: '<div data-testid="leaderboard">Leaderboard</div>',
      },
      global: {
        stubs: {
          MusicQuizCountdown: true,
          TimelineDisplay: true,
          TimelineProgress: true,
        },
      },
    });

    expect(wrapper.text()).toContain("Complete");
    expect(wrapper.text()).toContain("+250");
    expect(wrapper.findComponent(TimelineProgress).exists()).toBe(false);
    expect(wrapper.find(".sr-only").text()).toContain(
      "providers.music_quiz.timeline_incorrect_placement",
    );
    expect(
      wrapper
        .get('[data-testid="timeline-result-score"] span.truncate')
        .classes(),
    ).toContain("text-green-600");
    expect(wrapper.find('[data-testid="leaderboard"]').exists()).toBe(true);
  });
});
