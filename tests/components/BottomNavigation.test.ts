import BottomNavigation from "@/components/navigation/BottomNavigation.vue";
import { enableAutoUnmount, mount, type VueWrapper } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";

const { routeState, mockRouterPush, mockEmit } = vi.hoisted(() => ({
  routeState: { name: "discover" } as { name: string },
  mockRouterPush: vi.fn(),
  mockEmit: vi.fn(),
}));

vi.mock("vue-router", () => ({
  useRoute: () => routeState,
  useRouter: () => ({ push: mockRouterPush }),
}));

vi.mock("@/plugins/eventbus", () => ({
  eventbus: { emit: mockEmit },
}));

vi.mock("@/plugins/i18n", () => ({ $t: (key: string) => key }));

vi.mock("@/plugins/store", async () => {
  const { reactive } = await vi.importActual<typeof import("vue")>("vue");
  return { store: reactive({ showPlayersMenu: false }) };
});

const { store } = await import("@/plugins/store");

enableAutoUnmount(afterEach);

/** Finds a bar item by its accessible name, so order changes cannot mislead. */
function itemNamed(wrapper: VueWrapper, name: string) {
  return wrapper
    .findAll("button")
    .find((button) => button.attributes("aria-label") === name)!;
}

function mountNavigation() {
  return mount(BottomNavigation, {
    global: {
      stubs: { PlayerBarPlayerButton: true },
      mocks: { $t: (key: string) => key },
    },
  });
}

afterEach(() => {
  routeState.name = "discover";
  store.showPlayersMenu = false;
  vi.clearAllMocks();
});

describe("BottomNavigation", () => {
  it("puts search at the end, past the player", () => {
    const wrapper = mountNavigation();
    const order = wrapper
      .findAll("button, player-bar-player-button-stub")
      .map((element) => element.attributes("aria-label") ?? "player");

    expect(order).toEqual(["menu", "discover", "player", "search"]);
  });

  it("names the icon-only ends without printing a label", () => {
    const wrapper = mountNavigation();
    // both keep an accessible name; only the middle items show text
    expect(
      itemNamed(wrapper, "menu").find(".mobile-navigation-label").exists(),
    ).toBe(false);
    expect(
      itemNamed(wrapper, "search").find(".mobile-navigation-label").exists(),
    ).toBe(false);
  });

  it("names the bar itself for landmark navigation", () => {
    const wrapper = mountNavigation();

    // $t is mocked to its key here, so a literal would mean an untranslated name
    expect(wrapper.get("nav").attributes("aria-label")).toBe("main_navigation");
  });

  it("marks the page you are on", () => {
    const wrapper = mountNavigation();
    const active = wrapper
      .findAll("button")
      .filter((button) => button.attributes("data-active") === "true")
      .map((button) => button.attributes("aria-label"));

    expect(active).toEqual(["discover"]);
  });

  it("names the current page for assistive tech, not just by tint", () => {
    routeState.name = "search";
    const wrapper = mountNavigation();
    const current = wrapper
      .findAll("button")
      .filter((button) => button.attributes("aria-current") === "page")
      .map((button) => button.attributes("aria-label"));

    // search carries no visible label, so the tint alone would leave its state
    // invisible to a screen reader
    expect(current).toEqual(["search"]);
  });

  it("hands the active state to an open player picker", async () => {
    const wrapper = mountNavigation();
    expect(wrapper.get("nav").attributes("data-picker-open")).toBe("false");

    store.showPlayersMenu = true;
    await wrapper.vm.$nextTick();

    // the styling keys off this, so the page underneath stops looking active
    expect(wrapper.get("nav").attributes("data-picker-open")).toBe("true");
  });

  it("closes the player picker when navigating away", async () => {
    store.showPlayersMenu = true;
    const wrapper = mountNavigation();

    await itemNamed(wrapper, "discover").trigger("click");

    expect(mockRouterPush).toHaveBeenCalledWith({ name: "discover" });
    expect(store.showPlayersMenu).toBe(false);
  });

  it("opens the sidebar from the menu button", async () => {
    const wrapper = mountNavigation();

    await itemNamed(wrapper, "menu").trigger("click");

    expect(mockEmit).toHaveBeenCalledWith("mobile-sidebar-open");
  });
});
