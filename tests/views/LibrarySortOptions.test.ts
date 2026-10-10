import LibraryAlbums from "@/views/LibraryAlbums.vue";
import LibraryArtists from "@/views/LibraryArtists.vue";
import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";

vi.mock("vue-i18n", () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

vi.mock("@/components/ItemsListing.vue", () => ({
  default: {
    name: "ItemsListing",
    props: ["sortKeys"],
    template: "<div />",
  },
}));

vi.mock("@/plugins/api", () => ({
  default: {
    subscribe: vi.fn(),
    getLibraryAlbums: vi.fn(),
    getLibraryArtists: vi.fn(),
    getLibraryAlbumsCount: vi.fn(),
    getLibraryArtistsCount: vi.fn(),
  },
}));

vi.mock("@/composables/useLibrarySync", () => ({
  onLibrarySyncCompleted: vi.fn(() => () => undefined),
}));

vi.mock("@/plugins/store", () => ({
  store: {
    libraryAlbumsCount: 0,
    libraryArtistsCount: 0,
  },
}));

describe("library sort options", () => {
  it("adds a random sort option to album listings", () => {
    const wrapper = mount(LibraryAlbums, {
      global: {
        mocks: {
          $t: (key: string) => key,
        },
      },
    });
    expect(
      wrapper.findComponent({ name: "ItemsListing" }).props("sortKeys"),
    ).toContain("random");
  });

  it("adds a random sort option to artist listings", () => {
    const wrapper = mount(LibraryArtists, {
      global: {
        mocks: {
          $t: (key: string) => key,
        },
      },
    });
    expect(
      wrapper.findComponent({ name: "ItemsListing" }).props("sortKeys"),
    ).toContain("random");
  });
});
