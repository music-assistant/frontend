/**
 * What each release says about itself under its artwork: its type, or that it
 * is not in the library.
 */
import ReleaseShelf from "@/components/details/ReleaseShelf.vue";
import { AlbumType, type Album } from "@/plugins/api/interfaces";
import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import { album } from "../../fixtures/album";

vi.mock("@/plugins/api", () => {
  const api = { providers: {} };
  return { api, default: api };
});

vi.mock("@/plugins/i18n", () => ({ $t: (key: string) => key }));

// the shelf and the card carry their own looks; only the subtitle is read here
vi.mock("@/components/discover/EditorialShelf.vue", () => ({
  default: {
    name: "EditorialShelf",
    template:
      '<div><slot name="header" /><slot name="actions" /><slot /></div>',
  },
}));
vi.mock("@/components/discover/EditorialMediaCard.vue", () => ({
  default: {
    name: "EditorialMediaCard",
    props: ["item", "isAvailable", "parentItem"],
    template: '<div class="card"><slot name="subtitle" /></div>',
  },
}));

function mountShelf(items: Album[], itemCount?: number) {
  return mount(ReleaseShelf, {
    props: {
      title: "Discography",
      items,
      itemCount,
      viewAllTo: { name: "artistlisting" },
    },
    global: {
      directives: { hold: () => undefined },
      mocks: { $t: (key: string) => key },
      stubs: { RouterLink: { template: "<a><slot /></a>" } },
    },
  });
}

describe("ReleaseShelf subtitles", () => {
  it("adds the total count to the view-all action when provided", () => {
    const wrapper = mountShelf([], 42);

    expect(wrapper.get(".release-shelf__more").text()).toBe("view_all (42)");
    expect(wrapper.get(".release-shelf__more").attributes("aria-label")).toBe(
      "tooltip.view_all (42)",
    );
  });

  it("leaves the view-all action unchanged without a count", () => {
    const wrapper = mountShelf([]);

    expect(wrapper.get(".release-shelf__more").text()).toBe("view_all");
    expect(wrapper.get(".release-shelf__more").attributes("aria-label")).toBe(
      "tooltip.view_all",
    );
  });

  it("says a release is not in the library instead of naming its type", () => {
    const wrapper = mountShelf([
      album({
        item_id: "rg-1",
        provider: "musicbrainz",
        provider_mappings: [],
        album_type: AlbumType.SINGLE,
      }),
    ]);

    expect(wrapper.get(".card").text()).toBe("not_in_library");
  });

  it("names the type of a release that is on a music service", () => {
    const wrapper = mountShelf([
      album({ item_id: "1", album_type: AlbumType.SINGLE }),
    ]);

    expect(wrapper.get(".card").text()).toBe("album_type.single");
  });
});
