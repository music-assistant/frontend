import NavHomeAssistant from "@/components/navigation/NavHomeAssistant.vue";
import { enableAutoUnmount, mount } from "@vue/test-utils";
import { TooltipProvider } from "reka-ui";
import { h } from "vue";
import { afterEach, describe, expect, it, vi } from "vitest";

const { mockToggleHAMenu, mockSetOpenMobile, sidebar } = vi.hoisted(() => ({
  mockToggleHAMenu: vi.fn(),
  mockSetOpenMobile: vi.fn(),
  sidebar: { state: "expanded", isMobile: false },
}));

vi.mock("@/plugins/homeassistant", () => ({
  toggleHAMenu: mockToggleHAMenu,
}));

vi.mock("@/components/ui/sidebar", async () => {
  const { computed } = await vi.importActual<typeof import("vue")>("vue");
  return {
    useSidebar: () => ({
      state: computed(() => sidebar.state),
      isMobile: computed(() => sidebar.isMobile),
      setOpenMobile: mockSetOpenMobile,
    }),
  };
});

vi.mock("vue-i18n", () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

enableAutoUnmount(afterEach);

afterEach(() => {
  sidebar.state = "expanded";
  sidebar.isMobile = false;
  vi.clearAllMocks();
});

// The sidebar this lives in provides the tooltip context, same as in the app.
function mountButton() {
  return mount(TooltipProvider, {
    slots: { default: () => h(NavHomeAssistant) },
  });
}

describe("NavHomeAssistant", () => {
  it("asks Home Assistant for its menu", async () => {
    const wrapper = mountButton();

    await wrapper.get("button").trigger("click");

    expect(mockToggleHAMenu).toHaveBeenCalledOnce();
  });

  it("names itself for a collapsed rail that shows no label", () => {
    sidebar.state = "collapsed";
    const wrapper = mountButton();

    expect(wrapper.get("button").attributes("aria-label")).toBe(
      "home_assistant_menu",
    );
    expect(wrapper.text()).not.toContain("home_assistant_menu");
  });

  it("labels itself in the open sidebar", () => {
    const wrapper = mountButton();

    expect(wrapper.text()).toContain("home_assistant_menu");
  });

  it("gets out of the way of the menu it is opening on mobile", async () => {
    sidebar.isMobile = true;
    const wrapper = mountButton();

    await wrapper.get("button").trigger("click");

    // Both menus over the same screen would only cover each other up.
    expect(mockSetOpenMobile).toHaveBeenCalledWith(false);
  });

  it("leaves the sidebar alone on a screen with room for both", async () => {
    const wrapper = mountButton();

    await wrapper.get("button").trigger("click");

    expect(mockSetOpenMobile).not.toHaveBeenCalled();
  });
});
