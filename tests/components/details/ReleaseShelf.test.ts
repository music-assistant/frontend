/**
 * What each release says about itself under its artwork: its type, or that it
 * is not in the library. And where the title goes when a label takes its line.
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
    template: `<div>
      <div class="heading"><slot name="heading" /></div>
      <div class="header"><slot name="header" /></div>
      <slot />
    </div>`,
  },
}));
vi.mock("@/components/discover/EditorialMediaCard.vue", () => ({
  default: {
    name: "EditorialMediaCard",
    props: ["item", "isAvailable", "parentItem"],
    template: '<div class="card"><slot name="subtitle" /></div>',
  },
}));

const DetailSectionTitle = {
  props: ["title"],
  template: '<h2 class="title">{{ title }}</h2>',
};

function mountShelf(
  items: Album[],
  options: { hideTitle?: boolean; label?: string } = {},
) {
  return mount(ReleaseShelf, {
    props: { title: "Discography", items, hideTitle: options.hideTitle },
    slots: options.label ? { label: options.label } : {},
    global: {
      directives: { hold: () => undefined },
      mocks: { $t: (key: string) => key },
      stubs: { RouterLink: true, DetailSectionTitle },
    },
  });
}

describe("ReleaseShelf subtitles", () => {
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

describe("ReleaseShelf label", () => {
  it("puts the label on the title line, with the title above it", () => {
    const wrapper = mountShelf([], { label: "Albums" });

    expect(wrapper.get(".header").text()).toBe("Albums");
    expect(wrapper.get(".heading .title").text()).toBe("Discography");
  });

  it("leaves the title out for a row below another that has it", () => {
    const wrapper = mountShelf([], { label: "Live", hideTitle: true });

    expect(wrapper.get(".header").text()).toBe("Live");
    expect(wrapper.find(".title").exists()).toBe(false);
  });

  it("keeps the title on its line without a label", () => {
    const wrapper = mountShelf([]);

    expect(wrapper.get(".header .title").text()).toBe("Discography");
    expect(wrapper.get(".heading").text()).toBe("");
  });
});
