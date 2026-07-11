import HitsterHostPanel from "@/components/music-quiz/game-types/hitster/HitsterHostPanel.vue";
import HitsterHostRound from "@/components/music-quiz/game-types/hitster/HitsterHostRound.vue";
import HitsterPlayerRound from "@/components/music-quiz/game-types/hitster/HitsterPlayerRound.vue";
import HitsterPresentRound from "@/components/music-quiz/game-types/hitster/HitsterPresentRound.vue";
import HitsterRound from "@/components/music-quiz/game-types/hitster/HitsterRound.vue";
import type {
  MusicQuizHitsterHostRound,
  MusicQuizHitsterHostState,
  MusicQuizHitsterPersonalizedState,
  MusicQuizHitsterRound,
} from "@/composables/useMusicQuiz";
import { mount, shallowMount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetTrackLyrics } = vi.hoisted(() => ({
  mockGetTrackLyrics: vi.fn(),
}));

vi.mock("@/plugins/api", () => ({
  default: {
    getTrackLyrics: mockGetTrackLyrics,
  },
}));

vi.mock("@/plugins/i18n", () => ({
  $t: (key: string, values?: Array<string | number>) =>
    values?.length ? `${key} ${values.join(" ")}` : key,
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
  auto_advance_at: null,
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
  round_count: 2,
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
const hostState = {
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
  created_at: 1,
  sources: [],
  join_url: "https://example.test/join",
  rounds: [],
} satisfies MusicQuizHitsterHostState;

describe("Hitster game adapters", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
    mockGetTrackLyrics.mockReset();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("never renders provided song details before reveal", () => {
    const wrapper = mount(HitsterRound, {
      props: {
        phase: "answering",
        round: revealRound,
        isFinalRound: false,
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
        isFinalRound: false,
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

  it("renders no auto-advance countdown without a server deadline", () => {
    const wrapper = mount(HitsterRound, {
      props: {
        phase: "reveal",
        round: revealRound,
        isFinalRound: false,
      },
    });

    expect(wrapper.find('[data-testid="hitster-auto-advance"]').exists()).toBe(
      false,
    );
  });

  it("renders the intermediate server-scheduled countdown", () => {
    const wrapper = mount(HitsterRound, {
      props: {
        phase: "reveal",
        round: {
          ...revealRound,
          auto_advance_at: Date.now() / 1000 + 30,
        },
        isFinalRound: false,
      },
    });
    const countdown = wrapper.get('[data-testid="hitster-auto-advance"]');

    expect(countdown.attributes("role")).toBe("timer");
    expect(countdown.text()).toContain("providers.music_quiz.next_round_in");
    expect(countdown.text()).toContain("30s");
    expect(countdown.attributes("aria-label")).toContain("30s");
  });

  it("renders final-results semantics for the last countdown", () => {
    const wrapper = mount(HitsterRound, {
      props: {
        phase: "reveal",
        round: {
          ...revealRound,
          auto_advance_at: Date.now() / 1000 + 30,
        },
        isFinalRound: true,
      },
    });
    const countdown = wrapper.get('[data-testid="hitster-auto-advance"]');

    expect(countdown.text()).toContain("providers.music_quiz.final_results_in");
    expect(countdown.text()).not.toContain(
      "providers.music_quiz.next_round_in",
    );
    expect(countdown.text()).toContain("30s");
  });

  it("resumes an elapsed server countdown after reconnect", async () => {
    const autoAdvanceAt = Date.now() / 1000 + 30;
    vi.advanceTimersByTime(18_000);
    const wrapper = mount(HitsterRound, {
      props: {
        phase: "reveal",
        round: {
          ...revealRound,
          auto_advance_at: autoAdvanceAt,
        },
        isFinalRound: false,
      },
    });
    const countdown = wrapper.get('[data-testid="hitster-auto-advance"]');

    expect(countdown.text()).toContain("12s");

    await vi.advanceTimersByTimeAsync(13_000);

    expect(countdown.text()).toContain("0s");
  });

  it("keeps intermediate Ready after song details", async () => {
    const wrapper = mount(HitsterPlayerRound, {
      props: {
        state: playerState,
        currentRound: revealRound,
        busy: false,
      },
    });
    const title = wrapper.get("h2");
    const readyButton = wrapper.get('[data-testid="hitster-ready"]');

    expect(
      title.element.compareDocumentPosition(readyButton.element) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(readyButton.text()).toContain("providers.music_quiz.ready");

    await readyButton.trigger("click");

    expect(wrapper.emitted("ready")).toEqual([[]]);
    expect(mockGetTrackLyrics).not.toHaveBeenCalled();

    await wrapper.setProps({
      state: {
        ...playerState,
        you: {
          ...playerState.you,
          ready: true,
        },
      },
    });

    expect(readyButton.text()).toContain(
      "providers.music_quiz.waiting_for_next",
    );
    expect(readyButton.text()).not.toContain(
      "providers.music_quiz.waiting_for_final_results",
    );
  });

  it("uses final-results Ready and waiting labels without changing its action", async () => {
    const finalState = {
      ...playerState,
      round_count: 1,
    } satisfies MusicQuizHitsterPersonalizedState;
    const wrapper = mount(HitsterPlayerRound, {
      props: {
        state: finalState,
        currentRound: revealRound,
        busy: false,
      },
    });
    const title = wrapper.get("h2");
    const readyButton = wrapper.get('[data-testid="hitster-ready"]');

    expect(
      title.element.compareDocumentPosition(readyButton.element) &
        Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
    expect(readyButton.text()).toContain(
      "providers.music_quiz.ready_for_final_results",
    );

    await readyButton.trigger("click");

    expect(wrapper.emitted("ready")).toEqual([[]]);

    await wrapper.setProps({
      state: {
        ...finalState,
        you: {
          ...finalState.you,
          ready: true,
        },
      },
    });

    expect(readyButton.text()).toContain(
      "providers.music_quiz.waiting_for_final_results",
    );
    expect(readyButton.attributes()).toHaveProperty("disabled");
  });

  it("passes final-round semantics through host and present adapters", () => {
    const hostWrapper = shallowMount(HitsterHostRound, {
      props: {
        state: hostState,
        currentRound: revealRound,
      },
    });
    const presentWrapper = shallowMount(HitsterPresentRound, {
      props: {
        state: hostState,
        currentRound: revealRound,
      },
    });

    expect(hostWrapper.getComponent(HitsterRound).props("isFinalRound")).toBe(
      true,
    );
    expect(
      presentWrapper.getComponent(HitsterRound).props("isFinalRound"),
    ).toBe(true);
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
      auto_advance_at: null,
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
