import DetailHeroFavorite from "@/components/details/DetailHeroFavorite.vue";
import { api } from "@/plugins/api";
import { authManager } from "@/plugins/auth";
import { mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BUILTIN_ROLE_SCOPES, scopeChecker } from "../../fixtures/scopes";
import { track } from "../../fixtures/track";

vi.mock("@/plugins/api", () => {
  const api = { toggleFavorite: vi.fn() };
  return { api, default: api };
});

vi.mock("@/plugins/auth", () => ({ authManager: { hasScope: vi.fn() } }));

vi.mock("@/plugins/i18n", () => ({ $t: (key: string) => key }));

const toggleFavorite = vi.mocked(api.toggleFavorite);

function mountButton(favorite: boolean | null) {
  return mount(DetailHeroFavorite, { props: { item: track({ favorite }) } });
}

describe("DetailHeroFavorite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authManager.hasScope).mockImplementation(
      scopeChecker(BUILTIN_ROLE_SCOPES.user),
    );
  });

  // one slot, three looks: the glyph carries the state and the label says what
  // a tap does with it
  it.each([
    {
      favorite: true,
      icon: "tabler-icon-heart-filled",
      label: "favorites_remove",
    },
    { favorite: null, icon: "tabler-icon-heart", label: "favorites_add" },
    {
      favorite: false,
      icon: "tabler-icon-thumb-down",
      label: "favorites_dislike_remove",
    },
  ])(
    "shows $icon labelled $label for favorite $favorite",
    ({ favorite, icon, label }) => {
      const button = mountButton(favorite).get("button");

      // one slot, so the dislike replaces the heart rather than joining it
      expect(button.findAll("svg")).toHaveLength(1);
      expect(button.get("svg").classes()).toContain(icon);
      expect(button.attributes("aria-label")).toBe(label);
      expect(button.attributes("title")).toBe(label);
    },
  );

  it("hands a tap on a dislike to the api", async () => {
    const item = track({ favorite: false });

    await mount(DetailHeroFavorite, { props: { item } })
      .get("button")
      .trigger("click");

    expect(toggleFavorite).toHaveBeenCalledWith(item);
  });

  it("is not offered to a role that may not change the library", () => {
    vi.mocked(authManager.hasScope).mockImplementation(
      scopeChecker(BUILTIN_ROLE_SCOPES.guest),
    );

    expect(mountButton(null).find("button").exists()).toBe(false);
  });
});
