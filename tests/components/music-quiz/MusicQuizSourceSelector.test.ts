import MediaSearch from "@/components/MediaSearch.vue";
import MusicQuizSourceSelector from "@/components/music-quiz/MusicQuizSourceSelector.vue";
import { MediaType, type Playlist } from "@/plugins/api/interfaces";
import { flushPromises, mount } from "@vue/test-utils";
import { nextTick } from "vue";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/components/MediaSearch.vue", async () => {
  const { defineComponent } = await import("vue");
  return {
    default: defineComponent({
      name: "MediaSearch",
      inheritAttrs: false,
      props: {
        inputId: {
          type: String,
          required: true,
        },
      },
      emits: ["select"],
      template: '<input :id="inputId" data-testid="media-search-input" />',
    }),
  };
});

vi.mock("@/plugins/i18n", () => ({
  $t: (key: string, values: unknown[] = []) =>
    values.length ? `${key}:${values.join(",")}` : key,
}));

describe("MusicQuizSourceSelector", () => {
  afterEach(() => {
    document.body.replaceChildren();
  });

  it("uses its available width for the tablet source layout", () => {
    const wrapper = mountSelector();

    expect(wrapper.classes()).toContain("md:grid-cols-2");
    expect(wrapper.classes()).not.toContain("lg:grid-cols-2");
  });

  it.each([
    { description: "middle", removedIndex: 1, expectedFocusIndex: 1 },
    { description: "first", removedIndex: 0, expectedFocusIndex: 0 },
    { description: "final item", removedIndex: 2, expectedFocusIndex: 1 },
  ])(
    "focuses the adjacent source after removing the $description source",
    async ({ removedIndex, expectedFocusIndex }) => {
      const wrapper = mountSelector();
      const sources = [
        createPlaylist("First", 1),
        createPlaylist("Second", 2),
        createPlaylist("Third", 3),
      ];
      await selectSources(wrapper, sources);

      const removeButton = getRemoveButtons(wrapper)[removedIndex];
      removeButton.element.focus();
      await removeButton.trigger("click");
      await flushPromises();

      const remainingButtons = getRemoveButtons(wrapper);
      expect(
        remainingButtons.map((button) => button.attributes("aria-label")),
      ).toEqual(
        sources
          .filter((_, index) => index !== removedIndex)
          .map(
            (source) =>
              `providers.music_quiz.remove_music_source:${source.name}`,
          ),
      );
      expect(document.activeElement).toBe(
        remainingButtons[expectedFocusIndex].element,
      );
      expect(document.activeElement).not.toBe(
        wrapper.get('[data-testid="media-search-input"]').element,
      );
      wrapper.unmount();
    },
  );

  it("focuses the empty status after removing the last source", async () => {
    const wrapper = mountSelector();
    await selectSources(wrapper, [createPlaylist("Only", 1)]);

    const removeButton = getRemoveButtons(wrapper)[0];
    removeButton.element.focus();
    await removeButton.trigger("click");
    await flushPromises();

    const emptyStatus = wrapper.get('[role="status"]');
    expect(emptyStatus.attributes("tabindex")).toBe("-1");
    expect(emptyStatus.text()).toBe(
      "providers.music_quiz.pick_at_least_one_source",
    );
    expect(document.activeElement).toBe(emptyStatus.element);
    expect(document.activeElement).not.toBe(
      wrapper.get('[data-testid="media-search-input"]').element,
    );
    wrapper.unmount();
  });
});

function mountSelector() {
  return mount(MusicQuizSourceSelector, {
    attachTo: document.body,
    props: {
      inputId: "quiz-source-search",
      modelValue: [],
    },
  });
}

async function selectSources(
  wrapper: ReturnType<typeof mountSelector>,
  sources: Playlist[],
) {
  const mediaSearch = wrapper.getComponent(MediaSearch);
  for (const source of sources) {
    mediaSearch.vm.$emit("select", source);
    await nextTick();
  }
}

function getRemoveButtons(wrapper: ReturnType<typeof mountSelector>) {
  return wrapper.findAll<HTMLButtonElement>(
    'button[aria-label^="providers.music_quiz.remove_music_source"]',
  );
}

function createPlaylist(name: string, index: number): Playlist {
  return {
    item_id: String(index),
    provider: "library",
    name,
    uri: `library://playlist/${index}`,
    is_playable: true,
    media_type: MediaType.PLAYLIST,
    provider_mappings: [],
    metadata: {},
    favorite: false,
    timestamp_added: 0,
    timestamp_modified: 0,
    owner: "",
    is_editable: false,
    supported_mediatypes: [MediaType.TRACK],
    is_dynamic: false,
  };
}
