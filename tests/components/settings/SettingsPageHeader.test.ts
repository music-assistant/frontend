import type { ToolBarMenuItem } from "@/components/Toolbar.vue";
import SettingsPageHeader from "@/components/settings/SettingsPageHeader.vue";
import { provideSettingsPageMenu } from "@/composables/useSettingsPageMenu";
import { SETTINGS_COLORS } from "@/helpers/settings_colors";
import { enableAutoUnmount, mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h } from "vue";

vi.mock("@/plugins/i18n", () => ({ $t: (key: string) => key }));

enableAutoUnmount(afterEach);

// stands in for the dropdown, exposing the items it is handed
const OverflowMenuStub = {
  name: "OverflowMenu",
  props: ["items"],
  template: "<div><slot /></div>",
};

/**
 * The header on a page of the settings layout that publishes the given items
 * into its menu.
 */
function mountHeader(
  props: { page: string; title?: string; description?: string },
  {
    menu = [] as ToolBarMenuItem[],
    slots = {} as Record<string, () => unknown>,
  } = {},
) {
  const Page = defineComponent({
    setup() {
      provideSettingsPageMenu().value = menu;
      return () => h(SettingsPageHeader, props, slots);
    },
  });
  return mount(Page, {
    global: {
      mocks: { $t: (key: string) => key },
      stubs: { OverflowMenu: OverflowMenuStub },
    },
  });
}

describe("SettingsPageHeader", () => {
  it.each([
    ["music", "settings.music", "settings.music_description"],
    ["network", "settings.network.title", "settings.network.description"],
    [
      "remote_access",
      "settings.remote_access",
      "settings.remote_access_description",
    ],
  ])(
    "heads %s with the title and description of its card or tile",
    (page, title, description) => {
      const wrapper = mountHeader({ page });

      expect(wrapper.get("h1").text()).toBe(title);
      expect(wrapper.get("p").text()).toBe(description);
    },
  );

  it.each([
    ["catalog", "orange"],
    ["system", "purple"],
    ["genres", "pink"],
  ] as const)("draws the icon of %s soft, in its %s", (page, color) => {
    const icon = mountHeader({ page }).get(
      '[data-testid="settings-page-icon"]',
    );

    expect(icon.attributes("style")).toContain(
      `color: ${SETTINGS_COLORS[color]}`,
    );
    expect(icon.classes()).toContain("bg-current/12");
    expect(icon.classes()).toContain("size-12");
  });

  it("keeps the title and the buttons on a phone, without the icon and the description", () => {
    const wrapper = mountHeader(
      { page: "music" },
      { slots: { actions: () => h("button", "Installed") } },
    );

    expect(
      wrapper.get('[data-testid="settings-page-icon"]').element.parentElement!
        .classList,
    ).toContain("max-md:hidden");
    expect(wrapper.get("p").classes()).toContain("max-md:hidden");
    expect(wrapper.get("h1").classes()).not.toContain("max-md:hidden");
    expect(
      wrapper.get("button").element.parentElement!.classList,
    ).not.toContain("max-md:hidden");
  });

  it("moves the buttons below a title that would get too narrow, and wraps a long title", () => {
    const wrapper = mountHeader(
      { page: "music" },
      { slots: { actions: () => h("button", "Edit profile") } },
    );

    expect(wrapper.get("header").classes()).toContain("flex-wrap");
    expect(wrapper.get("h1").element.parentElement!.classList).toContain(
      "basis-40",
    );
    expect(wrapper.get("h1").classes()).toContain("break-words");
  });

  it("names what the page hands it, with its own icon in place of the page's", () => {
    const wrapper = mountHeader(
      { page: "profile", title: "Sam", description: "Administrator" },
      { slots: { icon: () => h("img", { alt: "Sam" }) } },
    );

    expect(wrapper.get("h1").text()).toBe("Sam");
    expect(wrapper.get("p").text()).toBe("Administrator");
    expect(wrapper.find("img").exists()).toBe(true);
    expect(wrapper.find('[data-testid="settings-page-icon"]').exists()).toBe(
      false,
    );
  });

  it("puts the buttons of the page before its menu", () => {
    const wrapper = mountHeader(
      { page: "players" },
      {
        menu: [{ label: "settings.hide_unavailable_players" }],
        slots: { actions: () => h("button", { id: "action" }, "Add") },
      },
    );

    const buttons = wrapper.findAll("button");
    expect(buttons.map((button) => button.attributes("id") ?? "")).toEqual([
      "action",
      "",
    ]);
    expect(buttons[1].attributes("data-testid")).toBe("settings-page-menu");
  });

  it("offers no menu while the page publishes nothing to show", () => {
    const wrapper = mountHeader(
      { page: "network" },
      { menu: [{ label: "settings.reset_to_defaults", hide: true }] },
    );

    expect(wrapper.find('[data-testid="settings-page-menu"]').exists()).toBe(
      false,
    );
  });

  it("offers in its menu what the page publishes", () => {
    const wrapper = mountHeader(
      { page: "players" },
      {
        menu: [
          { label: "settings.hide_unavailable_players", active: false },
          { label: "settings.remove_unavailable_players", hide: true },
        ],
      },
    );

    expect(wrapper.getComponent(OverflowMenuStub).props("items")).toEqual([
      { label: "settings.hide_unavailable_players", active: false },
    ]);
    expect(
      wrapper.find('[data-testid="settings-page-menu-active"]').exists(),
    ).toBe(false);
  });

  it("shows on its menu button that an option is on", () => {
    const wrapper = mountHeader(
      { page: "players" },
      { menu: [{ label: "settings.hide_unavailable_players", active: true }] },
    );

    expect(
      wrapper.find('[data-testid="settings-page-menu-active"]').exists(),
    ).toBe(true);
  });
});
