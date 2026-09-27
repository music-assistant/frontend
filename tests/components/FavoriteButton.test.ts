import FavoriteButton from "@/components/FavoriteButton.vue";
import { authManager } from "@/plugins/auth";
import { mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BUILTIN_ROLE_SCOPES, scopeChecker } from "../fixtures/scopes";
import { track } from "../fixtures/track";

// the menu only reaches the api once an entry is picked, which needs the menu
// open; these tests stay on the trigger the row shows
vi.mock("@/plugins/api", () => {
  const api = { subscribe: vi.fn(() => () => {}) };
  return { api, default: api };
});

vi.mock("@/plugins/auth", () => ({ authManager: { hasScope: vi.fn() } }));

const TRIGGER = "button[type='button']";

function mountButton(favorite: boolean | null) {
  return mount(FavoriteButton, {
    props: { item: track({ favorite }) },
    global: { mocks: { $t: (key: string) => key } },
  });
}

describe("FavoriteButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(authManager.hasScope).mockImplementation(
      scopeChecker(BUILTIN_ROLE_SCOPES.user),
    );
  });

  // one slot, three looks; the menu component covers them all, this covers the
  // row handing it the item
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

  // a row's heart is dimmed until it is hovered, or the item is a favorite
  it("dims the trigger a row shows", () => {
    expect(mountButton(null).get(TRIGGER).classes()).toContain("opacity-70");
  });

  it("is not offered to a role that may not change the library", () => {
    vi.mocked(authManager.hasScope).mockImplementation(
      scopeChecker(BUILTIN_ROLE_SCOPES.guest),
    );

    expect(mountButton(null).find(TRIGGER).exists()).toBe(false);
  });
});
