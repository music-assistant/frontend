import DetailHero from "@/components/details/DetailHero.vue";
import { backFromMediaDetails } from "@/helpers/navigation";
import { enableAutoUnmount, mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ref } from "vue";

vi.mock("@/components/Toolbar.vue", () => ({
  default: {
    props: ["iconAction"],
    template: '<button aria-label="Back" @click="iconAction()">Back</button>',
  },
}));
vi.mock("@/helpers/navigation", () => ({ backFromMediaDetails: vi.fn() }));
vi.mock("vue-router", () => ({ useRouter: () => ({}) }));
vi.mock("@/plugins/breakpoint", () => ({ isPhoneSizedScreen: () => false }));
vi.mock("@/composables/userPreferences", () => ({
  useUserPreferences: () => ({ getPreference: () => ref([]) }),
}));
vi.mock("@/layouts/default/ItemContextMenu.vue", () => ({
  getContextMenuItems: async () => [],
}));
vi.mock("@/plugins/store", () => ({
  store: {
    dialogActive: false,
    showPlayersMenu: false,
    showFullscreenPlayer: false,
  },
}));

enableAutoUnmount(afterEach);
afterEach(() => {
  document.body.replaceChildren();
  vi.clearAllMocks();
});

function escape() {
  const event = new KeyboardEvent("keydown", {
    key: "Escape",
    bubbles: true,
    cancelable: true,
  });
  document.body.dispatchEvent(event);
  return event;
}

describe("DetailHero Escape integration", () => {
  // AlbumHero, ArtistHero and TrackHero use this component, not InfoHeader.
  it("registers Escape for the actual hero and shares the toolbar Back action", async () => {
    const wrapper = mount(DetailHero);
    await wrapper.get('button[aria-label="Back"]').trigger("click");
    expect(backFromMediaDetails).toHaveBeenCalledTimes(1);
    expect(escape().defaultPrevented).toBe(true);
    expect(backFromMediaDetails).toHaveBeenCalledTimes(2);
    wrapper.unmount();
    escape();
    expect(backFromMediaDetails).toHaveBeenCalledTimes(2);
  });

  it("gives a menu dismissal priority, then navigates on the next Escape", () => {
    mount(DetailHero);
    const menu = document.createElement("div");
    menu.setAttribute("role", "menu");
    document.body.append(menu);
    document.addEventListener("keydown", () => menu.remove(), { once: true });
    escape();
    expect(backFromMediaDetails).not.toHaveBeenCalled();
    escape();
    expect(backFromMediaDetails).toHaveBeenCalledOnce();
  });
});
