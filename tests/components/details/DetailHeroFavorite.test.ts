import DetailHeroFavorite from "@/components/details/DetailHeroFavorite.vue";
import { authManager } from "@/plugins/auth";
import { mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BUILTIN_ROLE_SCOPES, scopeChecker } from "../../fixtures/scopes";
import { track } from "../../fixtures/track";

// the menu only reaches the api once an entry is picked, which needs the menu
// open; these tests stay on the trigger the hero shows
vi.mock("@/plugins/api", () => {
  const api = { subscribe: vi.fn(() => () => {}) };
  return { api, default: api };
});

vi.mock("@/plugins/auth", () => ({ authManager: { hasScope: vi.fn() } }));

const TRIGGER = "button[type='button']";

function mountButton(favorite: boolean | null) {
  return mount(DetailHeroFavorite, {
    props: { item: track({ favorite }) },
    global: { mocks: { $t: (key: string) => key } },
  });
}

describe("DetailHeroFavorite", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authManager.hasScope).mockImplementation(
      scopeChecker(BUILTIN_ROLE_SCOPES.user),
    );
  });

  // one slot, three looks; the menu component covers them all, this covers the
  // hero handing it the item
  it.each([
    { favorite: true, icon: "lucide-heart", fill: "currentColor" },
    { favorite: null, icon: "lucide-heart", fill: "none" },
    { favorite: false, icon: "lucide-thumbs-down", fill: "none" },
  ])("shows $icon for favorite $favorite", ({ favorite, icon, fill }) => {
    const trigger = mountButton(favorite).get(TRIGGER);

    expect(trigger.findAll("svg")).toHaveLength(1);
    expect(trigger.get("svg").classes()).toContain(icon);
    expect(trigger.get("svg").attributes("fill")).toBe(fill);
  });

  // it sits on the artwork, so it carries a backdrop of its own
  it("gives the trigger a backdrop", () => {
    expect(mountButton(null).get(TRIGGER).classes()).toContain("bg-black/35");
  });

  it("is not offered to a role that may not change the library", () => {
    vi.mocked(authManager.hasScope).mockImplementation(
      scopeChecker(BUILTIN_ROLE_SCOPES.guest),
    );

    expect(mountButton(null).find(TRIGGER).exists()).toBe(false);
  });
});
