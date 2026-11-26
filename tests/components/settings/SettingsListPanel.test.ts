import SettingsListPanel, {
  type SettingsPanelAction,
} from "@/components/settings/SettingsListPanel.vue";
import SettingsViewModeTabs from "@/components/settings/SettingsViewModeTabs.vue";
import { Plus } from "@lucide/vue";
import { enableAutoUnmount, mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import { markRaw } from "vue";

vi.mock("@/plugins/i18n", () => ({
  $t: (key: string, args?: unknown[]) =>
    args ? `${key}(${args.join(",")})` : key,
}));

enableAutoUnmount(afterEach);

describe("SettingsListPanel", () => {
  it("heads the list with its title and how many it holds", () => {
    const wrapper = mountPanel({ title: "Music sources", count: 9 });

    expect(wrapper.get("h2").text()).toContain("Music sources");
    expect(wrapper.get('[data-testid="panel-count"]').text()).toBe("9");
  });

  it("counts an empty list too", () => {
    const wrapper = mountPanel({ title: "Audio sources", count: 0 });

    expect(wrapper.get('[data-testid="panel-count"]').text()).toBe("0");
  });

  it("holds the search and the filters of the list in its header", () => {
    const wrapper = mountPanel(
      { title: "Players" },
      { filters: '<input data-testid="search" />', default: "<ul />" },
    );

    expect(wrapper.get("header").find('[data-testid="search"]').exists()).toBe(
      true,
    );
  });

  it("switches the view of the list from two pills, the one it is in pressed", async () => {
    const wrapper = mountPanel({ title: "Players", viewMode: "card" });

    const tabs = wrapper.get('[data-testid="view-mode-tabs"]');
    expect(tabs.attributes("role")).toBe("group");
    expect(tabs.attributes("aria-label")).toBe("view.view_as");
    const pills = tabs.findAll("button");
    expect(
      pills.map((pill) => [
        pill.attributes("aria-label"),
        pill.attributes("aria-pressed"),
      ]),
    ).toEqual([
      ["view.list", "false"],
      ["view.card", "true"],
    ]);

    await pills[1].trigger("click");
    expect(wrapper.emitted("toggle-view-mode")).toBeUndefined();
    await pills[0].trigger("click");
    expect(wrapper.emitted("toggle-view-mode")).toHaveLength(1);
  });

  it("ends the row of the search and filters with the switch of the view on a wide screen", () => {
    const wrapper = mountPanel(
      { title: "Music sources", viewMode: "list", actions: [action()] },
      { filters: '<input data-testid="search" />', default: "<ul />" },
    );

    const tabs = wrapper.getComponent(SettingsViewModeTabs);
    // by the title on a phone, under the buttons at the end of the filters wider
    expect(tabs.classes()).toEqual(
      expect.arrayContaining([
        "row-start-1",
        "md:row-start-2",
        "md:col-start-3",
      ]),
    );
    expect(
      wrapper.get('[data-testid="search"]').element.parentElement!.className,
    ).toContain("row-start-2");
  });

  it("puts the switch before the buttons of a list without filters", () => {
    const wrapper = mountPanel({
      title: "Player providers",
      viewMode: "list",
      actions: [action()],
    });

    const tabs = wrapper.getComponent(SettingsViewModeTabs);
    expect(tabs.classes()).toContain("row-start-1");
    expect(tabs.classes()).not.toContain("md:row-start-2");
  });

  it("has no switch for a list without views", () => {
    const wrapper = mountPanel({ title: "Players" });

    expect(wrapper.findComponent(SettingsViewModeTabs).exists()).toBe(false);
  });

  it("runs an action from its button, named by its label", async () => {
    const add = action();
    const wrapper = mountPanel({ title: "Music sources", actions: [add] });

    const button = wrapper.get('[data-testid="add-provider"]');
    expect(button.text()).toBe("Add a music source");
    await button.trigger("click");

    expect(add.onSelect).toHaveBeenCalledOnce();
  });

  it("moves the actions into a menu on a phone", () => {
    const wrapper = mountPanel({ title: "Music sources", actions: [action()] });

    expect(wrapper.get('[data-testid="add-provider"]').classes()).toContain(
      "max-md:hidden",
    );
    const menu = wrapper.get('[data-testid="panel-menu"]');
    expect(menu.classes()).toContain("md:hidden");
    expect(menu.attributes("aria-label")).toBe("more_options");
  });

  it("has no menu without actions", () => {
    const wrapper = mountPanel({ title: "Music sources" });

    expect(wrapper.find('[data-testid="panel-menu"]').exists()).toBe(false);
  });
});

function action(
  overrides: Partial<SettingsPanelAction> = {},
): SettingsPanelAction {
  return {
    key: "add-provider",
    label: "Add a music source",
    icon: markRaw(Plus),
    onSelect: vi.fn(),
    ...overrides,
  };
}

function mountPanel(
  props: InstanceType<typeof SettingsListPanel>["$props"],
  slots: Record<string, string> = { default: "<ul />" },
) {
  return mount(SettingsListPanel, { props, slots });
}
