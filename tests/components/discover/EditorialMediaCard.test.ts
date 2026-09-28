/**
 * The card's own looks: the muted treatment a release that is not in the
 * library gets (instead of the harsh unavailable one), and the placeholder it
 * falls back to when its cover art can not be loaded.
 */
import EditorialMediaCard from "@/components/discover/EditorialMediaCard.vue";
import { ImageType, type Album } from "@/plugins/api/interfaces";
import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import { album } from "../../fixtures/album";

vi.mock("@/plugins/api", () => {
  const api = { providers: {}, providerManifests: {} };
  return { api, default: api };
});

vi.mock("@/helpers/media_item_actions", () => ({
  handleMediaItemClick: vi.fn(),
  handleMenuBtnClick: vi.fn(),
  handlePlayBtnClick: vi.fn(),
}));

// the icon composable reads vuetify's theme, which a bare mount has none of
vi.mock("@/composables/useProviderIcon", async () => {
  const { ref } = await import("vue");
  return { useProviderIcon: () => ({ iconDataUri: ref(null) }) };
});

// the subtitle is translated in the component, so the key is what it reports;
// the rest of vue-i18n stays real, since the app instance is built on it
vi.mock("vue-i18n", async (importOriginal) => ({
  ...(await importOriginal<typeof import("vue-i18n")>()),
  useI18n: () => ({ t: (key: string) => key }),
}));

// a cover the proxy hands out; a data uri keeps it out of the image proxy
const COVER = "data:image/png;base64,iVBORw0KGgo=";
const OTHER_COVER = "data:image/png;base64,iVBORw0KGgoAAAA=";

const withCover = (overrides: Partial<Album> = {}, cover = COVER) =>
  album({
    name: "Grace",
    metadata: {
      images: [
        {
          type: ImageType.THUMB,
          path: cover,
          provider: "builtin",
          remotely_accessible: true,
        },
      ],
    },
    ...overrides,
  });

const release = (overrides: Partial<Album> = {}, cover = COVER) =>
  withCover(
    {
      item_id: "rg-1",
      provider: "musicbrainz",
      provider_mappings: [],
      ...overrides,
    },
    cover,
  );

function mountCard(item: Album, isAvailable = true) {
  return mount(EditorialMediaCard, {
    props: { item, isAvailable },
    global: {
      directives: { hold: () => undefined },
      mocks: { $t: (key: string) => key },
      stubs: {
        ProviderIcon: true,
        NowPlayingBadge: true,
        MediaCollectionThumb: true,
      },
    },
  });
}

describe("EditorialMediaCard", () => {
  it("mutes a release that is not in the library instead of greying it out", () => {
    const wrapper = mountCard(release(), false);

    expect(wrapper.classes()).toContain("ed-card--not-in-library");
    expect(wrapper.classes()).not.toContain("ed-card--unavailable");
  });

  it("says a release is not in the library where the subtitle would go", () => {
    const wrapper = mountCard(release());

    expect(wrapper.get(".ed-card__sub").text()).toBe("not_in_library");
  });

  it("keeps the unavailable treatment for anything else", () => {
    const wrapper = mountCard(withCover({ item_id: "1" }), false);

    expect(wrapper.classes()).toContain("ed-card--unavailable");
    expect(wrapper.classes()).not.toContain("ed-card--not-in-library");
  });

  it("falls back to the initials placeholder when the cover fails to load", async () => {
    const wrapper = mountCard(release());
    expect(wrapper.get("img").attributes("src")).toBe(COVER);

    await wrapper.get("img").trigger("error");

    expect(wrapper.find("img").exists()).toBe(false);
    expect(wrapper.get(".ed-card__initials").text()).toBe("GR");
  });

  it("offers no play button for a release that is not in the library", () => {
    const wrapper = mountCard(release());

    expect(wrapper.find(".ed-card__play").exists()).toBe(false);
  });

  // a metadata refresh replaces the item under the same uri
  it("retries a cover the same item got since", async () => {
    const wrapper = mountCard(release());
    await wrapper.get("img").trigger("error");

    await wrapper.setProps({ item: release({}, OTHER_COVER) });

    expect(wrapper.get("img").attributes("src")).toBe(OTHER_COVER);
  });

  it("gives the next item its cover back", async () => {
    const wrapper = mountCard(release());
    await wrapper.get("img").trigger("error");

    await wrapper.setProps({
      item: release({ item_id: "rg-2", name: "Sketches" }),
    });

    expect(wrapper.get("img").attributes("src")).toBe(COVER);
    expect(wrapper.find(".ed-card__initials").exists()).toBe(false);
  });
});
