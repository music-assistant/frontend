import MediaSearch from "@/components/MediaSearch.vue";
import MusicQuizSourceSelector from "@/components/music-quiz/MusicQuizSourceSelector.vue";
import MusicQuizSteppedSetup from "@/components/music-quiz/MusicQuizSteppedSetup.vue";
import GuessTheSongSetup from "@/components/music-quiz/game-types/guess-the-song/GuessTheSongSetup.vue";
import type { MusicQuizPlaybackOptions } from "@/composables/music-quiz/useMusicQuiz";
import type { MusicAssistantApi } from "@/plugins/api";
import type { Playlist, SearchResults } from "@/plugins/api/interfaces";
import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { nextTick } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { playlist } from "../../fixtures/playlist";
import { pickSelectOption } from "../../fixtures/rekaSelect";

const { mockSearch } = vi.hoisted(() => ({
  mockSearch: vi.fn<MusicAssistantApi["search"]>(),
}));

vi.mock("@/plugins/api", () => {
  const api = { search: mockSearch };
  return { api, default: api };
});

vi.mock("@/plugins/i18n", () => ({
  $t: (key: string, values: unknown[] = []) =>
    values.length ? `${key}:${values.join(",")}` : key,
  canonicalizeLocale: (locale: string) => locale,
  getLocaleDisplayName: (locale: string) => locale,
  getLocaleOptions: () => [],
  i18n: {
    global: {
      availableLocales: ["en"],
      locale: { value: "en" },
    },
  },
}));

// helpers/utils transitively imports router/auth, which need a real browser
vi.mock("@/helpers/utils", () => ({
  copyToClipboard: vi.fn(),
  getArtistsString: () => "",
  getAvatarImage: () => "",
  getImageThumbForItem: () => undefined,
  getMediaImageUrl: (url: string) => url,
}));

vi.mock("@/components/MediaItemThumb.vue", () => ({
  default: { name: "MediaItemThumb", template: "<div />" },
}));

// The search field is driven by emitting its "select", as a pick would.
vi.mock("@/components/MediaSearch.vue", async () => {
  const { defineComponent } = await import("vue");
  return {
    default: defineComponent({
      name: "MediaSearch",
      inheritAttrs: false,
      props: { inputId: { type: String, required: true } },
      emits: ["select"],
      template: '<input :id="inputId" data-testid="media-search-input" />',
    }),
  };
});

const SUGGESTED = playlist({
  item_id: "0EFdkYy5imXOa9hgaRozM3",
  provider: "spotify",
  name: "Blind Test - 80s / 90s / 00s / 10s / 20s",
  uri: "spotify://playlist/0EFdkYy5imXOa9hgaRozM3",
});
// Named like the suggestion but not it: the exact playlist id wins.
const LOOKALIKE = playlist({
  item_id: "lookalike",
  provider: "spotify",
  name: "Blind Test party mix",
  uri: "spotify://playlist/lookalike",
});
const SEARCHED = playlist({
  item_id: "searched",
  name: "Road trip",
  uri: "library://playlist/searched",
});

const PLAYBACK_OPTIONS = {
  default_playback_mode: "venue",
  default_venue_player_id: null,
  venue_available: true,
  remote_available: true,
  venue_players: [
    { player_id: "living-room", name: "Living Room" },
    { player_id: "kitchen", name: "Kitchen" },
  ],
} satisfies MusicQuizPlaybackOptions;

const SUGGESTION = '[data-testid="music-quiz-suggested-source"]';
const SUGGESTION_ADD = '[data-testid="music-quiz-suggested-source-add"]';
const NEXT = '[data-testid="setup-next"]';
const CREATE = '[data-testid="setup-create"]';
// The Game step's cards; the suggested playlist is a toggle button too.
const GAME_BUTTONS = "section.grid > button";

// the venue player listbox is portalled out of the wrapper, so tear it down
// even when an assertion fails
enableAutoUnmount(afterEach);

describe("MusicQuizSteppedSetup", () => {
  beforeEach(() => {
    document.body.innerHTML = "";
    mockSearch.mockReset();
    mockSearch.mockResolvedValue(searchResults([LOOKALIKE, SUGGESTED]));
  });

  it("lists the available games and opens Music once one is picked", async () => {
    const wrapper = mountSetup();

    expect(progress(wrapper)).toBe("providers.music_quiz.setup_progress:1,5");
    expect(gameButtonLabels(wrapper)).toEqual([
      "providers.music_quiz.game_type_guess_the_song",
      "providers.music_quiz.game_type_music_timeline",
    ]);

    await wrapper.setProps({ availableQuizTypes: ["trivia"] });
    expect(gameButtonLabels(wrapper)).toEqual([
      "providers.music_quiz.game_type_guess_the_song",
      "providers.music_quiz.game_type_music_timeline",
      "providers.music_quiz.game_type_trivia",
    ]);

    await pickGame(wrapper, "providers.music_quiz.game_type_music_timeline");

    expect(progress(wrapper)).toBe("providers.music_quiz.setup_progress:2,5");
    expect(heading(wrapper)).toBe("providers.music_quiz.setup_step_music");
  });

  it("keeps Next disabled on Music until a source is picked", async () => {
    const wrapper = mountSetup();
    await pickGame(wrapper, "providers.music_quiz.game_type_guess_the_song");

    expect(wrapper.get(NEXT).attributes("disabled")).toBeDefined();

    wrapper.getComponent(MediaSearch).vm.$emit("select", SEARCHED);
    await nextTick();

    expect(wrapper.get(NEXT).attributes("disabled")).toBeUndefined();
  });

  it("adds the suggested playlist and enables Next", async () => {
    const wrapper = mountSetup();
    await pickGame(wrapper, "providers.music_quiz.game_type_guess_the_song");

    const add = wrapper.get(SUGGESTION_ADD);
    expect(add.text()).toContain(SUGGESTED.name);
    expect(add.attributes("aria-pressed")).toBe("false");

    await add.trigger("click");

    expect(add.attributes("aria-pressed")).toBe("true");
    expect(removeButtonLabels(wrapper)).toEqual([
      `providers.music_quiz.remove_music_source:${SUGGESTED.name}`,
    ]);
    expect(wrapper.get(NEXT).attributes("disabled")).toBeUndefined();
  });

  it("hides the suggestion when the search finds nothing", async () => {
    mockSearch.mockResolvedValue(searchResults([]));
    const wrapper = mountSetup();
    await pickGame(wrapper, "providers.music_quiz.game_type_guess_the_song");

    expect(wrapper.find(SUGGESTION).exists()).toBe(false);
    // the search below still works
    expect(wrapper.find('[data-testid="media-search-input"]').exists()).toBe(
      true,
    );
  });

  it("goes back a step without losing the picks", async () => {
    const wrapper = mountSetup();
    await pickGame(wrapper, "providers.music_quiz.game_type_guess_the_song");
    await wrapper.get(SUGGESTION_ADD).trigger("click");
    await next(wrapper);
    expect(progress(wrapper)).toBe("providers.music_quiz.setup_progress:3,5");

    await back(wrapper);

    expect(progress(wrapper)).toBe("providers.music_quiz.setup_progress:2,5");
    expect(removeButtonLabels(wrapper)).toEqual([
      `providers.music_quiz.remove_music_source:${SUGGESTED.name}`,
    ]);
    expect(wrapper.get(NEXT).attributes("disabled")).toBeUndefined();

    await back(wrapper);

    expect(progress(wrapper)).toBe("providers.music_quiz.setup_progress:1,5");
    expect(
      wrapper
        .findAll(GAME_BUTTONS)
        .map((button) => button.attributes("aria-pressed")),
    ).toEqual(["true", "false"]);
  });

  it("shows only the chosen game's rules on the Rules step", async () => {
    const wrapper = mountSetup();
    await pickGame(wrapper, "providers.music_quiz.game_type_guess_the_song");
    await wrapper.get(SUGGESTION_ADD).trigger("click");
    await next(wrapper);

    expect(heading(wrapper)).toBe("providers.music_quiz.setup_step_rules");
    const rules = wrapper.getComponent(GuessTheSongSetup);
    expect(rules.props("stage")).toBe("rules");
    expect(rules.find("#quiz-rounds").exists()).toBe(true);
    // the music has its own step and Create comes at the end
    expect(rules.findComponent(MusicQuizSourceSelector).exists()).toBe(false);
    expect(wrapper.findAllComponents(MusicQuizSourceSelector)).toHaveLength(1);
    expect(
      rules.findAll("button").some((button) => button.text() === "create"),
    ).toBe(false);
  });

  it("waits on Plays on until the playback choice is valid", async () => {
    const wrapper = mountSetup({ playbackOptionsLoading: true });
    await reachStep(wrapper, 4);

    expect(heading(wrapper)).toBe("providers.music_quiz.setup_step_plays_on");
    expect(
      wrapper.find('[data-testid="music-quiz-playback-loading"]').exists(),
    ).toBe(true);
    expect(wrapper.get(NEXT).attributes("disabled")).toBeDefined();

    // Venue is the default, but no speaker is picked yet
    await wrapper.setProps({
      playbackOptionsLoading: false,
      playbackOptions: PLAYBACK_OPTIONS,
    });
    expect(
      wrapper.get("#music-quiz-playback-venue").attributes("aria-checked"),
    ).toBe("true");
    expect(wrapper.get(NEXT).attributes("disabled")).toBeDefined();

    await pickSelectOption(wrapper, "#music-quiz-venue-player", "Kitchen");

    expect(wrapper.get(NEXT).attributes("disabled")).toBeUndefined();
  });

  it("summarises every pick and jumps back to the step a Change opens", async () => {
    const wrapper = mountSetup({ playbackOptions: PLAYBACK_OPTIONS });
    await reachStep(wrapper, 4);
    await pickSelectOption(wrapper, "#music-quiz-venue-player", "Kitchen");
    await next(wrapper);

    expect(heading(wrapper)).toBe("providers.music_quiz.setup_step_check");
    expect(summaryRows(wrapper)).toEqual([
      [
        "providers.music_quiz.setup_step_game",
        "providers.music_quiz.game_type_guess_the_song",
      ],
      ["providers.music_quiz.setup_step_music", SUGGESTED.name],
      [
        "providers.music_quiz.setup_step_rules",
        expect.stringContaining("providers.music_quiz.setup_rules_rounds:5"),
      ],
      [
        "providers.music_quiz.setup_step_plays_on",
        "providers.music_quiz.playback_summary_venue:Kitchen",
      ],
    ]);
    expect(wrapper.find(NEXT).exists()).toBe(false);
    expect(wrapper.get(CREATE).attributes("disabled")).toBeUndefined();

    await wrapper
      .get(
        'button[aria-label="providers.music_quiz.setup_change_item:providers.music_quiz.setup_step_music"]',
      )
      .trigger("click");
    await nextTick();

    expect(progress(wrapper)).toBe("providers.music_quiz.setup_progress:2,5");
    expect(wrapper.find('[data-testid="setup-summary"]').exists()).toBe(false);
    expect(removeButtonLabels(wrapper)).toEqual([
      `providers.music_quiz.remove_music_source:${SUGGESTED.name}`,
    ]);
  });

  it("creates the game from its rules, the picked music and the playback choice", async () => {
    const wrapper = mountSetup({ playbackOptions: PLAYBACK_OPTIONS });
    await pickGame(wrapper, "providers.music_quiz.game_type_guess_the_song");
    await wrapper.get(SUGGESTION_ADD).trigger("click");
    wrapper.getComponent(MediaSearch).vm.$emit("select", SEARCHED);
    await wrapper.get("#setup-include-similar-music").trigger("click");
    await next(wrapper);
    await next(wrapper);
    await pickSelectOption(wrapper, "#music-quiz-venue-player", "Kitchen");
    await next(wrapper);

    await wrapper.get(CREATE).trigger("click");

    expect(wrapper.emitted("create")).toEqual([
      [
        {
          quiz_type: "guess_the_song",
          answer_type: "multiple_choice",
          playback_mode: "venue",
          venue_player_id: "kitchen",
          config: {
            round_count: 5,
            suggestion_count: 4,
            answer_duration: 30,
            difficulty: "normal",
            source_uris: [SUGGESTED.uri, SEARCHED.uri],
            include_similar_music: true,
          },
        },
      ],
    ]);
  });
});

function mountSetup(
  props: {
    availableQuizTypes?: string[];
    playbackOptions?: MusicQuizPlaybackOptions | null;
    playbackOptionsLoading?: boolean;
  } = {},
) {
  return mount(MusicQuizSteppedSetup, {
    props: { busy: false, ...props },
    attachTo: document.body,
  });
}

type SetupWrapper = ReturnType<typeof mountSetup>;

function searchResults(playlists: Playlist[]): SearchResults {
  return {
    artists: [],
    albums: [],
    tracks: [],
    playlists,
    radio: [],
    podcasts: [],
    audiobooks: [],
    genres: [],
  };
}

function progress(wrapper: SetupWrapper) {
  return wrapper.get('[data-testid="setup-progress"]').text();
}

function heading(wrapper: SetupWrapper) {
  return wrapper.get("h2").text();
}

function gameButtonLabels(wrapper: SetupWrapper) {
  return wrapper
    .findAll(GAME_BUTTONS)
    .map((button) => button.get(".font-semibold").text());
}

function removeButtonLabels(wrapper: SetupWrapper) {
  return wrapper
    .findAll('button[aria-label^="providers.music_quiz.remove_music_source"]')
    .map((button) => button.attributes("aria-label"));
}

function summaryRows(wrapper: SetupWrapper) {
  return wrapper
    .get('[data-testid="setup-summary"]')
    .findAll("dl > div")
    .map((row) => [row.get("dt").text(), row.get("dd").text()]);
}

async function pickGame(wrapper: SetupWrapper, label: string) {
  const button = wrapper
    .findAll(GAME_BUTTONS)
    .find((candidate) => candidate.text().includes(label));
  if (!button) throw new Error(`no game button labelled ${label}`);
  await button.trigger("click");
  // the suggestion's search resolves after mount
  await flushPromises();
}

async function next(wrapper: SetupWrapper) {
  await wrapper.get(NEXT).trigger("click");
  await nextTick();
}

async function back(wrapper: SetupWrapper) {
  await wrapper.get('button[aria-label="back"]').trigger("click");
  await nextTick();
}

/** Guess the Song with the suggested playlist, up to `step`. */
async function reachStep(wrapper: SetupWrapper, step: number) {
  await pickGame(wrapper, "providers.music_quiz.game_type_guess_the_song");
  await wrapper.get(SUGGESTION_ADD).trigger("click");
  for (let current = 2; current < step; current++) await next(wrapper);
}
