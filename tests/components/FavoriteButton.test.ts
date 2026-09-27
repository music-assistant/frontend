import FavoriteButton from "@/components/FavoriteButton.vue";
import api from "@/plugins/api";
import { mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { track } from "../fixtures/track";

vi.mock("@/plugins/api", () => {
  const api = { toggleFavorite: vi.fn() };
  return { api, default: api };
});

vi.mock("@/plugins/i18n", () => ({ $t: (key: string) => key }));

const toggleFavorite = vi.mocked(api.toggleFavorite);

function mountButton(favorite: boolean | null) {
  return mount(FavoriteButton, { props: { item: track({ favorite }) } });
}

describe("FavoriteButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // one slot, three looks: the glyph carries the state and the label says what
  // a tap does with it
  it.each([
    {
      favorite: true,
      icon: "lucide-heart",
      fill: "currentColor",
      label: "favorites_remove",
    },
    {
      favorite: null,
      icon: "lucide-heart",
      fill: "none",
      label: "favorites_add",
    },
    {
      favorite: false,
      icon: "lucide-thumbs-down",
      fill: "none",
      label: "favorites_dislike_remove",
    },
  ])(
    "shows $icon labelled $label for favorite $favorite",
    ({ favorite, icon, fill, label }) => {
      const wrapper = mountButton(favorite);

      // one slot, so there is never a second glyph beside it
      expect(wrapper.findAll("svg")).toHaveLength(1);
      const glyph = wrapper.get("svg");
      expect(glyph.classes()).toContain(icon);
      expect(glyph.attributes("fill")).toBe(fill);
      expect(glyph.attributes("aria-label")).toBe(label);
      expect(glyph.attributes("title")).toBe(label);
    },
  );

  it.each([{ favorite: true }, { favorite: null }, { favorite: false }])(
    "hands a tap on favorite $favorite to the api",
    async ({ favorite }) => {
      const item = track({ favorite });

      await mount(FavoriteButton, { props: { item } })
        .get("svg")
        .trigger("click");

      expect(toggleFavorite).toHaveBeenCalledWith(item);
    },
  );
});
