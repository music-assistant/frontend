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

  it("ends the row of the search and filters with the switch of the view", () => {
    const wrapper = mountPanel(
      { title: "Music sources", viewMode: "list", actions: [action()] },
      { filters: '<input data-testid="search" />', default: "<ul />" },
    );

    const row = wrapper.get('[data-testid="panel-filter-row"]');
    expect(row.find('[data-testid="search"]').exists()).toBe(true);
    expect(row.classes()).not.toContain("md:hidden");
    const tabs = wrapper.findAllComponents(SettingsViewModeTabs);
    expect(tabs).toHaveLength(1);
    expect(row.element.lastElementChild).toBe(tabs[0].element);
  });

  it("switches the view from the end of the row of the search and filters", async () => {
    const wrapper = mountPanel(
      { title: "Players", viewMode: "list" },
      { filters: '<input data-testid="search" />', default: "<ul />" },
    );

    await wrapper
      .get('[data-testid="panel-filter-row"] [data-view="card"]')
      .trigger("click");

    expect(wrapper.emitted("toggle-view-mode")).toHaveLength(1);
  });

  it("puts the switch before the buttons of a list without filters, and under them on a phone", () => {
    const wrapper = mountPanel({
      title: "Player providers",
      viewMode: "list",
      actions: [action()],
    });

    const [wide, phone] = wrapper.findAllComponents(SettingsViewModeTabs);
    const titleRow = wrapper.get('[data-testid="panel-title-row"]');
    expect(wide.element.parentElement).toBe(titleRow.element);
    expect(wide.classes()).toContain("max-md:hidden");
    expect(
      wide.element.nextElementSibling!.querySelector(
        '[data-testid="add-provider"]',
      ),
    ).not.toBeNull();
    const row = wrapper.get('[data-testid="panel-filter-row"]');
    expect(row.classes()).toContain("md:hidden");
    expect(phone.element.parentElement).toBe(row.element);
  });

  it("has no row under the title for a list without filters or views", () => {
    const wrapper = mountPanel({ title: "Players", actions: [action()] });

    expect(wrapper.find('[data-testid="panel-filter-row"]').exists()).toBe(
      false,
    );
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

  it("keeps the actions as buttons on a phone", () => {
    const wrapper = mountPanel({ title: "Music sources", actions: [action()] });

    expect(wrapper.get('[data-testid="add-provider"]').classes()).not.toContain(
      "max-md:hidden",
    );
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
