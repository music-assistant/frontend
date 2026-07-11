import MediaSearch from "@/components/MediaSearch.vue";
import TriviaSetup from "@/components/music-quiz/game-types/trivia/TriviaSetup.vue";
import { NumberField } from "@/components/ui/number-field";
import {
  MUSIC_QUIZ_DEFAULT_SOURCE_MEDIA_TYPES,
  MUSIC_QUIZ_SOURCE_MEDIA_TYPES,
} from "@/composables/useMusicQuizSources";
import { MediaType } from "@/plugins/api/interfaces";
import { mount } from "@vue/test-utils";
import { nextTick } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetLibraryGenres, mockSearch } = vi.hoisted(() => ({
  mockGetLibraryGenres: vi.fn(),
  mockSearch: vi.fn(),
}));

vi.mock("@/plugins/api", () => ({
  api: {
    providers: {},
    providerManifests: {},
    search: mockSearch,
    getLibraryGenres: mockGetLibraryGenres,
  },
}));

vi.mock("@/plugins/i18n", () => ({
  $t: (key: string) => key,
}));

vi.mock("@/helpers/utils", () => ({
  getArtistsString: (artists?: Array<{ name: string }>) =>
    artists?.map((artist) => artist.name).join(" / ") || "",
}));

vi.mock("@/components/MediaItemThumb.vue", () => ({
  default: {
    name: "MediaItemThumb",
    template: "<div />",
  },
}));

interface TestSource {
  uri: string;
  name: string;
  media_type: MediaType;
}

function source(mediaType: MediaType, name: string = mediaType): TestSource {
  return {
    uri: `library://${mediaType}/${name.toLowerCase()}`,
    name,
    media_type: mediaType,
  };
}

function mountSetup(props: { busy?: boolean; available?: boolean } = {}) {
  return mount(TriviaSetup, {
    props: {
      busy: props.busy ?? false,
      available: props.available ?? true,
    },
    global: {
      stubs: {
        Button: {
          emits: ["click"],
          template:
            '<button :disabled="$attrs.disabled" @click="$emit(\'click\')"><slot /></button>',
        },
      },
    },
  });
}

function createButton(wrapper: ReturnType<typeof mountSetup>) {
  const button = wrapper
    .findAll("button")
    .find((candidate) => candidate.text().includes("create"));
  if (!button) throw new Error("Create button not found");
  return button;
}

describe("TriviaSetup", () => {
  beforeEach(() => {
    mockSearch.mockReset();
    mockGetLibraryGenres.mockReset();
    mockGetLibraryGenres.mockResolvedValue([]);
  });

  it("uses the shared five-type source picker and Playlist/Genre defaults", () => {
    const wrapper = mountSetup();
    const search = wrapper.getComponent(MediaSearch);

    expect(search.props("allowedMediaTypes")).toEqual(
      MUSIC_QUIZ_SOURCE_MEDIA_TYPES,
    );
    expect(search.props("defaultSelectedMediaTypes")).toEqual(
      MUSIC_QUIZ_DEFAULT_SOURCE_MEDIA_TYPES,
    );
    expect(search.props("allowedMediaTypes")).toEqual([
      MediaType.TRACK,
      MediaType.PLAYLIST,
      MediaType.GENRE,
      MediaType.ALBUM,
      MediaType.ARTIST,
    ]);
    expect(search.props("allowedMediaTypes")).not.toEqual(
      expect.arrayContaining([
        MediaType.RADIO,
        MediaType.PODCAST,
        MediaType.PODCAST_EPISODE,
        MediaType.AUDIOBOOK,
      ]),
    );
    wrapper.unmount();
  });

  it("emits the exact Trivia request for every supported source type", async () => {
    const wrapper = mountSetup();
    const search = wrapper.getComponent(MediaSearch);
    const sources = MUSIC_QUIZ_SOURCE_MEDIA_TYPES.map((mediaType) =>
      source(mediaType),
    );
    for (const item of sources) search.vm.$emit("select", item);
    await nextTick();

    await wrapper.get("#trivia-name").setValue("  Friday Trivia  ");
    const numberFields = wrapper.findAllComponents(NumberField);
    numberFields[0].vm.$emit("update:modelValue", 8);
    numberFields[1].vm.$emit("update:modelValue", 5);
    numberFields[2].vm.$emit("update:modelValue", 45);
    await wrapper.get("#trivia-difficulty").setValue("hard");
    await nextTick();
    await createButton(wrapper).trigger("click");

    expect(wrapper.emitted("create")).toEqual([
      [
        {
          quiz_type: "trivia",
          answer_type: "multiple_choice",
          config: {
            round_count: 8,
            suggestion_count: 5,
            answer_duration: 45,
            source_uris: sources.map((item) => item.uri),
            name: "Friday Trivia",
            difficulty: "hard",
          },
        },
      ],
    ]);
    wrapper.unmount();
  });

  it("omits a blank optional name", async () => {
    const wrapper = mountSetup();
    wrapper
      .getComponent(MediaSearch)
      .vm.$emit("select", source(MediaType.PLAYLIST));
    await nextTick();
    await createButton(wrapper).trigger("click");

    const request = wrapper.emitted("create")?.[0]?.[0] as {
      config: Record<string, unknown>;
    };
    expect(request.config).not.toHaveProperty("name");
    wrapper.unmount();
  });

  it("disables creation while invalid, busy, or unavailable", async () => {
    const wrapper = mountSetup();

    expect(createButton(wrapper).attributes("disabled")).toBeDefined();
    wrapper
      .getComponent(MediaSearch)
      .vm.$emit("select", source(MediaType.PLAYLIST));
    await nextTick();
    expect(createButton(wrapper).attributes("disabled")).toBeUndefined();

    await wrapper.setProps({ busy: true });
    expect(createButton(wrapper).attributes("disabled")).toBeDefined();
    await wrapper.setProps({ busy: false, available: false });
    expect(createButton(wrapper).attributes("disabled")).toBeDefined();
    expect(wrapper.get('[role="alert"]').text()).toContain(
      "providers.music_quiz.trivia_requires_ai_provider",
    );

    await wrapper.setProps({ available: true });
    wrapper.findAllComponents(NumberField)[0].vm.$emit("update:modelValue", 0);
    await nextTick();
    expect(createButton(wrapper).attributes("disabled")).toBeDefined();
    wrapper.unmount();
  });

  it("ignores unsupported sources and supports removing a selection", async () => {
    const wrapper = mountSetup();
    const search = wrapper.getComponent(MediaSearch);

    search.vm.$emit("select", source(MediaType.RADIO));
    await nextTick();
    expect(createButton(wrapper).attributes("disabled")).toBeDefined();

    search.vm.$emit("select", source(MediaType.ARTIST, "Artist"));
    await nextTick();
    expect(createButton(wrapper).attributes("disabled")).toBeUndefined();
    await wrapper
      .get('button[aria-label="providers.music_quiz.remove_music_source"]')
      .trigger("click");
    expect(createButton(wrapper).attributes("disabled")).toBeDefined();
    wrapper.unmount();
  });
});
