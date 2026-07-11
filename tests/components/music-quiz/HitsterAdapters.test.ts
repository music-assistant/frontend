import HitsterHostPanel from "@/components/music-quiz/game-types/hitster/HitsterHostPanel.vue";
import HitsterHostRound from "@/components/music-quiz/game-types/hitster/HitsterHostRound.vue";
import HitsterPlayerRound from "@/components/music-quiz/game-types/hitster/HitsterPlayerRound.vue";
import HitsterPresentRound from "@/components/music-quiz/game-types/hitster/HitsterPresentRound.vue";
import { getMusicQuizGameType } from "@/components/music-quiz/game_types";
import type {
  MusicQuizHitsterHostState,
  MusicQuizHitsterPersonalizedState,
  MusicQuizTimelineEntry,
  MusicQuizTimelineHostRound,
  MusicQuizTimelineRound,
} from "@/composables/useMusicQuiz";
import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";

const { mockGetItemByUri, mockGetTrackLyrics } = vi.hoisted(() => ({
  mockGetItemByUri: vi.fn(),
  mockGetTrackLyrics: vi.fn(),
}));

vi.mock("@/plugins/api", () => ({
  default: {
    getItemByUri: mockGetItemByUri,
    getTrackLyrics: mockGetTrackLyrics,
    search: vi.fn(),
  },
}));

vi.mock("@/plugins/i18n", () => ({
  $t: (key: string, args?: unknown[]) =>
    args?.length ? `${key}:${args.join(",")}` : key,
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
  isTouchscreenDevice: () => false,
}));

const anchor = timelineEntry("anchor", 1980, "Anchor song", true);
const prior = timelineEntry("prior", 1990, "Prior song");
const revealed = timelineEntry("revealed", 1985, "New song");
const answeringRound = {
  round_index: 1,
  started_at: 1,
  deadline: 31,
  question: null,
  timeline: [anchor, prior],
  bonus_definitions: [],
} satisfies MusicQuizTimelineRound;
const revealedRound = {
  ...answeringRound,
  timeline: [anchor, revealed, prior],
  revealed_entry: revealed,
  answer_label: "New Artist - New song",
  track_uri: revealed.track_uri,
  image_url: null,
  duration: 180,
  ended_at: 20,
} satisfies MusicQuizTimelineRound;

describe("Hitster game adapters", () => {
  it("shows only revealed timeline content while answering", () => {
    const state = hostState(answeringRound, "answering");
    const wrapper = mount(HitsterHostRound, {
      props: {
        state,
        currentRound: answeringRound,
      },
    });

    expect(wrapper.text()).toContain("Anchor song");
    expect(wrapper.text()).toContain("Prior song");
    expect(wrapper.text()).toContain(
      "providers.music_quiz.timeline_current_hidden",
    );
    expect(wrapper.text()).not.toContain("Secret candidate");
    expect(wrapper.text()).not.toContain("Accepted Artist Alias");
    wrapper.unmount();
  });

  it("highlights the newly revealed card in deterministic timeline order", () => {
    const wrapper = mount(HitsterHostRound, {
      props: {
        state: hostState(revealedRound, "reveal"),
        currentRound: revealedRound,
      },
    });
    const cards = wrapper.findAll("[data-entry-id]");

    expect(cards.map((card) => card.attributes("data-entry-id"))).toEqual([
      "anchor",
      "revealed",
      "prior",
    ]);
    expect(wrapper.get('[data-entry-id="revealed"]').text()).toContain(
      "providers.music_quiz.timeline_new_entry",
    );
    wrapper.unmount();
  });

  it("renders a complete reveal and ready action for the player", async () => {
    const state = playerState(revealedRound);
    const wrapper = mount(HitsterPlayerRound, {
      props: {
        state,
        currentRound: revealedRound,
        busy: false,
      },
    });

    expect(wrapper.text()).toContain("New song");
    expect(wrapper.find('[data-entry-id="revealed"]').exists()).toBe(true);
    const readyButton = wrapper
      .findAll("button")
      .find((button) => button.text().includes("providers.music_quiz.ready"));
    await readyButton?.trigger("click");
    expect(wrapper.emitted("ready")).toEqual([[]]);
    wrapper.unmount();
  });

  it("keeps the full present reveal inside the game adapter", () => {
    const wrapper = mount(HitsterPresentRound, {
      props: {
        state: hostState(revealedRound, "reveal"),
        currentRound: revealedRound,
      },
    });

    expect(wrapper.text()).toContain("New song");
    expect(wrapper.text()).toContain(
      "providers.music_quiz.timeline_revealed_description",
    );
    expect(wrapper.find('[data-entry-id="revealed"]').exists()).toBe(true);
    wrapper.unmount();
  });

  it("shows safe host source and player progress", async () => {
    const state = hostState(answeringRound, "answering");
    state.players = [
      {
        name: "Placed",
        score: 0,
        ready: false,
        answered: false,
        placed: true,
        artist_bonus_answered: false,
        title_bonus_answered: false,
      },
      {
        name: "Finished",
        score: 10,
        ready: false,
        answered: true,
        placed: true,
        artist_bonus_answered: false,
        title_bonus_answered: false,
      },
    ];
    state.sources = [
      {
        uri: "library://playlist/decades",
        name: "Decades",
        media_type: "playlist",
      },
    ];
    const wrapper = mount(HitsterHostPanel, {
      props: {
        state,
        currentRound: answeringRound,
      },
    });

    expect(wrapper.text()).toContain("1 / 2");
    expect(wrapper.text()).toContain("2 / 2");
    await wrapper
      .findAll("button")
      .find((button) =>
        button.text().includes("providers.music_quiz.selected_music"),
      )
      ?.trigger("click");
    expect(wrapper.text()).toContain("Decades");
    wrapper.unmount();
  });

  it("supports ListenIn without loading Guess-the-Song content APIs", () => {
    expect(getMusicQuizGameType("hitster")?.supportsListenIn).toBe(true);
    expect(mockGetItemByUri).not.toHaveBeenCalled();
    expect(mockGetTrackLyrics).not.toHaveBeenCalled();
  });
});

function timelineEntry(
  entryId: string,
  releaseYear: number,
  title: string,
  isAnchor = false,
): MusicQuizTimelineEntry {
  return {
    entry_id: entryId,
    release_year: releaseYear,
    title,
    artist: `${title} Artist`,
    track_uri: `library://track/${entryId}`,
    image_url: null,
    is_anchor: isAnchor,
  };
}

function protectedRound(
  round: MusicQuizTimelineRound,
): MusicQuizTimelineHostRound {
  return {
    round_index: round.round_index,
    answer_label: "Secret candidate",
    placement_snapshot: [anchor, prior],
    candidate: {
      entry: timelineEntry("secret", 1985, "Secret candidate"),
      artist_answers: ["Accepted Artist Alias"],
      title_answers: ["Accepted Title Alias"],
    },
    bonus_definitions: [],
    placements: {},
    bonus_answers: {},
    finished_at: {},
    results: {},
    revealed: "revealed_entry" in round,
    track_uri: "library://track/secret",
    question: null,
    image_url: null,
    duration: 180,
    started_at: 1,
    ended_at: "revealed_entry" in round ? 20 : null,
  };
}

function hostState(
  round: MusicQuizTimelineRound,
  phase: "answering" | "reveal",
): MusicQuizHitsterHostState {
  return {
    quiz_type: "hitster",
    answer_type: "timeline",
    phase,
    name: "Timeline Quiz",
    round_count: 5,
    answer_duration: 30,
    artist_bonus_mode: "off",
    title_bonus_mode: "off",
    mode: "venue",
    players: [],
    current_round: round,
    created_at: 1,
    sources: [],
    join_url: "https://example.test/join",
    rounds: [protectedRound(round)],
  };
}

function playerState(
  round: MusicQuizTimelineRound,
): MusicQuizHitsterPersonalizedState {
  return {
    quiz_type: "hitster",
    answer_type: "timeline",
    phase: "reveal",
    name: "Timeline Quiz",
    round_count: 5,
    answer_duration: 30,
    artist_bonus_mode: "off",
    title_bonus_mode: "off",
    mode: "venue",
    players: [],
    current_round: round,
    you: {
      name: "Player",
      score: 0,
      ready: false,
      active_from_round: 0,
    },
  };
}
