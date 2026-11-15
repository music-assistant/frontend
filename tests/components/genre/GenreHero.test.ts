import GenreHero from "@/components/genre/GenreHero.vue";
import { MediaType, Scope, type Genre } from "@/plugins/api/interfaces";
import { enableAutoUnmount, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { genre } from "../../fixtures/genre";

const { hasScopeMock, emitMock } = vi.hoisted(() => ({
  hasScopeMock: vi.fn(),
  emitMock: vi.fn(),
}));

vi.mock("@/plugins/auth", () => ({
  authManager: { hasScope: hasScopeMock },
}));
vi.mock("@/plugins/eventbus", () => ({
  eventbus: { emit: emitMock },
}));
vi.mock("@/plugins/breakpoint", () => ({
  isPhoneSizedScreen: () => false,
}));
vi.mock("@/helpers/utils", () => ({
  getImageThumbForItem: () => undefined,
}));
vi.mock("@/components/details/DetailHero.vue", () => ({
  default: {
    name: "DetailHero",
    template: '<div><slot name="toolbar-append" /><slot name="main" /></div>',
  },
}));
vi.mock("@/components/details/DetailHeroButton.vue", () => ({
  default: {
    name: "DetailHeroButton",
    props: ["icon", "label"],
    emits: ["click"],
    template:
      '<button :aria-label="label" @click="$emit(\'click\', $event)">{{ label }}</button>',
  },
}));
vi.mock("@/components/details/DetailHeroFavorite.vue", () => ({
  default: { template: "<div />" },
}));
vi.mock("@/components/details/DetailHeroPlayButton.vue", () => ({
  default: { template: "<div />" },
}));
vi.mock("@/components/details/DetailHeroSourceBadge.vue", () => ({
  default: { template: "<div />" },
}));
vi.mock("@/plugins/i18n", () => ({
  $t: (key: string) => key,
}));

enableAutoUnmount(afterEach);

function mountHero(item: Genre) {
  return mount(GenreHero, {
    props: { item },
    global: { mocks: { $t: (key: string) => key } },
  });
}

describe("GenreHero", () => {
  beforeEach(() => {
    hasScopeMock.mockReset().mockReturnValue(true);
    emitMock.mockReset();
  });

  it("shows merge and delete actions only to library managers for library genres", () => {
    const wrapper = mountHero(genre({ provider: "library" }));

    expect(wrapper.find('[aria-label="merge_into"]').exists()).toBe(true);
    expect(wrapper.find('[aria-label="delete_genre"]').exists()).toBe(true);
    expect(hasScopeMock).toHaveBeenCalledWith(Scope.LIBRARY_MANAGE);
  });

  it("emits the existing merge and delete events with the selected genre", async () => {
    const item = genre({
      item_id: "42",
      name: "Jazz",
      provider: "library",
      content_type: MediaType.PODCAST,
    });
    const wrapper = mountHero(item);

    await wrapper.get('[aria-label="merge_into"]').trigger("click");
    await wrapper.get('[aria-label="delete_genre"]').trigger("click");

    expect(emitMock).toHaveBeenNthCalledWith(1, "mergeGenreDialog", {
      genreIds: ["42"],
      genreNames: ["Jazz"],
      genreContentTypes: [MediaType.PODCAST],
    });
    expect(emitMock).toHaveBeenNthCalledWith(2, "deleteGenreDialog", {
      genreIds: ["42"],
      navigateBack: true,
    });
  });

  it.each([
    {
      description: "a provider genre",
      item: genre({ provider: "spotify--account" }),
      allowed: true,
    },
    {
      description: "a library genre without manage permission",
      item: genre(),
      allowed: false,
    },
  ])("hides genre management actions for $description", ({ item, allowed }) => {
    hasScopeMock.mockReturnValue(allowed);
    const wrapper = mountHero(item);

    expect(wrapper.find('[aria-label="merge_into"]').exists()).toBe(false);
    expect(wrapper.find('[aria-label="delete_genre"]').exists()).toBe(false);
  });
});
