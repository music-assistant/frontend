import DetailHeroStickyBar from "@/components/details/DetailHeroStickyBar.vue";
import type { ContextMenuItem } from "@/helpers/context_menu_item";
import { eventbus } from "@/plugins/eventbus";
import { mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";

const MENU_ITEMS: ContextMenuItem[] = [{ label: "play_now", action: vi.fn() }];

function mountBar(props: { show?: boolean; showTitle?: boolean } = {}) {
  return mount(DetailHeroStickyBar, {
    props: {
      show: true,
      showTitle: false,
      title: "Happy Hits",
      menuItems: MENU_ITEMS,
      ...props,
    },
    global: { mocks: { $t: (key: string) => key } },
  });
}

describe("DetailHeroStickyBar", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("stays out of the page until the hero toolbar has scrolled away", () => {
    expect(mountBar({ show: false }).html()).not.toContain("Happy Hits");
  });

  it("keeps the title out of reach until it fades in", async () => {
    const bar = mountBar({ showTitle: false });
    const title = () =>
      bar.findAll("button").find((b) => b.text() === "Happy Hits")!;
    expect(title().attributes("inert")).toBeDefined();

    await bar.setProps({ showTitle: true });
    expect(title().attributes("inert")).toBeUndefined();
  });

  it("goes back from the back button", async () => {
    const bar = mountBar();
    await bar.get("button[aria-label='back']").trigger("click");
    expect(bar.emitted("back")).toHaveLength(1);
  });

  it("opens the item's menu where it was clicked", async () => {
    const emit = vi.spyOn(eventbus, "emit");
    const bar = mountBar();
    await bar
      .get("button[aria-label='menu']")
      .trigger("click", { clientX: 300, clientY: 20 });
    expect(emit).toHaveBeenCalledWith("contextmenu", {
      items: MENU_ITEMS,
      posX: 300,
      posY: 20,
    });
  });
});
