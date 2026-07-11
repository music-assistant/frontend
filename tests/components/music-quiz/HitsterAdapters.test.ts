import HitsterHostPanel from "@/components/music-quiz/game-types/hitster/HitsterHostPanel.vue";
import HitsterPlayerRound from "@/components/music-quiz/game-types/hitster/HitsterPlayerRound.vue";
import HitsterRound from "@/components/music-quiz/game-types/hitster/HitsterRound.vue";
import type {
  MusicQuizHitsterHostRound,
  MusicQuizHitsterHostState,
  MusicQuizHitsterPersonalizedState,
  MusicQuizHitsterRound,
} from "@/composables/useMusicQuiz";
import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";

const { mockGetTrackLyrics } = vi.hoisted(() => ({
  mockGetTrackLyrics: vi.fn(),
}));

vi.mock("@/plugins/api", () => ({
  default: {
    getTrackLyrics: mockGetTrackLyrics,
  },
}));

vi.mock("@/plugins/i18n", () => ({
  $t: (key: string) => key,
}));

vi.mock("@/helpers/utils", () => ({
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
const revealedEntry = {
  entry_id: "current",
  release_year: 2000,
  title: "Revealed Song",
  artist: "Revealed Artist",
  track_uri: "library://track/current",
  image_url: "https://example.test/current.jpg",
  is_anchor: false,
} as const;
const answeringRound = {
  round_index: 0,
  started_at: 1,
  deadline: 31,
  question: null,
  timeline: [anchor],
  bonus_definitions: [],
} satisfies MusicQuizHitsterRound;
const revealRound = {
  ...answeringRound,
  timeline: [anchor, revealedEntry],
  revealed_entry: revealedEntry,
  answer_label: "Revealed Artist - Revealed Song",
  track_uri: revealedEntry.track_uri,
  image_url: revealedEntry.image_url,
  duration: 180,
  ended_at: 20,
} satisfies MusicQuizHitsterRound;

const playerState = {
  quiz_type: "hitster",
  answer_type: "timeline",
  phase: "reveal",
  name: "Hitster",
  round_count: 1,
  answer_duration: 30,
  artist_bonus_mode: "off",
  title_bonus_mode: "off",
  mode: "venue",
  players: [],
  current_round: revealRound,
  you: {
    name: "Player",
    score: 0,
    ready: false,
    active_from_round: 0,
  },
} satisfies MusicQuizHitsterPersonalizedState;

describe("Hitster game adapters", () => {
  it("never renders provided song details before reveal", () => {
    const wrapper = mount(HitsterRound, {
      props: {
        phase: "answering",
        round: revealRound,
      },
    });

    expect(wrapper.text()).toContain(
      "providers.music_quiz.hitster_listen_title",
    );
    expect(wrapper.text()).not.toContain("Revealed Song");
    expect(wrapper.html()).not.toContain(revealedEntry.track_uri);
  });

  it("renders the revealed song responsively with accessible artwork", () => {
    const wrapper = mount(HitsterRound, {
      props: {
        phase: "reveal",
        round: revealRound,
      },
    });

    expect(wrapper.text()).toContain("2000");
    expect(wrapper.text()).toContain("Revealed Song");
    expect(wrapper.text()).toContain("Revealed Artist");
    expect(wrapper.get("img").attributes("alt")).toBe(
      "Revealed Song - Revealed Artist",
    );
    expect(wrapper.get("img").element.parentElement?.className).toContain(
      "sm:grid-cols",
    );
  });

  it("supports ready state without requesting lyrics", async () => {
    const wrapper = mount(HitsterPlayerRound, {
      props: {
        state: playerState,
        currentRound: revealRound,
        busy: false,
      },
    });

    await wrapper.get("button").trigger("click");

    expect(wrapper.emitted("ready")).toEqual([[]]);
    expect(mockGetTrackLyrics).not.toHaveBeenCalled();
  });

  it("keeps protected host round data hidden until reveal", async () => {
    const protectedRound = {
      round_index: 0,
      answer_label: "SECRET ARTIST - SECRET TITLE",
      placement_snapshot: [anchor],
      candidate: {
        entry: {
          ...revealedEntry,
          title: "SECRET TITLE",
          artist: "SECRET ARTIST",
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
    } satisfies MusicQuizHitsterHostRound;
    const state = {
      quiz_type: "hitster",
      answer_type: "timeline",
      phase: "answering",
      name: "Hitster",
      round_count: 1,
      answer_duration: 30,
      artist_bonus_mode: "off",
      title_bonus_mode: "off",
      mode: "venue",
      players: [],
      current_round: answeringRound,
      created_at: 1,
      sources: [],
      join_url: "https://example.test/join",
      rounds: [protectedRound],
    } satisfies MusicQuizHitsterHostState;
    const wrapper = mount(HitsterHostPanel, {
      props: {
        state,
        currentRound: answeringRound,
      },
    });
    await wrapper
      .findAll("button")
      .find((button) =>
        button.text().includes("providers.music_quiz.now_playing"),
      )
      ?.trigger("click");

    expect(wrapper.text()).toContain(
      "providers.music_quiz.hitster_song_hidden",
    );
    expect(wrapper.text()).not.toContain("SECRET TITLE");
    expect(wrapper.html()).not.toContain("library://track/secret");
  });
});
