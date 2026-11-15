/**
 * The thumbnail's stand-in for missing artwork: the media type's menu icon,
 * while real artwork and an explicit fallback keep their image.
 */
import MediaItemThumb from "@/components/MediaItemThumb.vue";
import {
  ImageType,
  MediaType,
  type MediaItemType,
  type QueueItem,
} from "@/plugins/api/interfaces";
import { Disc3, Folder, Music2 } from "@lucide/vue";
import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import { album } from "../fixtures/album";
import { queueItem } from "../fixtures/queueItem";
import { track } from "../fixtures/track";

vi.mock("@/plugins/api", () => {
  const api = { providers: {}, providerManifests: {} };
  return { api, default: api };
});

// the icon composable reads vuetify's theme, which a bare mount has none of
vi.mock("@/composables/useProviderIcon", async () => {
  const { ref } = await import("vue");
  return { useProviderIcon: () => ({ iconDataUri: ref(null) }) };
});

vi.mock("@/composables/useThemePreference", async () => {
  const { ref } = await import("vue");
  return { isDark: ref(false) };
});

vi.mock("@/components/QualityDetailsBtn.vue", () => ({
  default: {},
  imgCoverDark: "cover_dark.png",
  imgCoverLight: "cover_light.png",
}));

// a data uri keeps the cover out of the image proxy
const COVER = "data:image/png;base64,iVBORw0KGgo=";
const FALLBACK = "fallback.png";

function mountThumb(item: MediaItemType | QueueItem, fallback?: string) {
  return mount(MediaItemThumb, {
    props: { item, fallback },
    global: {
      stubs: {
        VImg: {
          props: ["src"],
          template: '<div class="v-img" :data-src="src"><slot /></div>',
        },
      },
    },
  });
}

describe("MediaItemThumb", () => {
  it("shows the media type's menu icon for an item without artwork", () => {
    const wrapper = mountThumb(album());

    expect(wrapper.findComponent(Disc3).exists()).toBe(true);
    expect(wrapper.get(".v-img").attributes("data-src")).toBe("");
  });

  it("shows the icon of a queue item's media item", () => {
    const wrapper = mountThumb(queueItem({ media_item: track() }));

    expect(wrapper.findComponent(Music2).exists()).toBe(true);
  });

  it("shows the artwork without an icon when there is some", () => {
    const wrapper = mountThumb(
      album({
        metadata: {
          images: [
            {
              type: ImageType.THUMB,
              path: COVER,
              provider: "builtin",
              remotely_accessible: true,
            },
          ],
        },
      }),
    );

    expect(wrapper.get(".v-img").attributes("data-src")).toBe(COVER);
    expect(wrapper.findComponent(Disc3).exists()).toBe(false);
  });

  it("shows the folder icon for a folder", () => {
    const folder = {
      ...album(),
      media_type: MediaType.FOLDER,
    } as unknown as MediaItemType;
    const wrapper = mountThumb(folder);

    expect(wrapper.findComponent(Folder).exists()).toBe(true);
  });

  it("prefers the given fallback image over the icon", () => {
    const wrapper = mountThumb(album(), FALLBACK);

    expect(wrapper.get(".v-img").attributes("data-src")).toBe(FALLBACK);
    expect(wrapper.findComponent(Disc3).exists()).toBe(false);
  });
});
