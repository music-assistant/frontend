import SettingsListPanel, {
  type SettingsPanelAction,
} from "@/components/settings/SettingsListPanel.vue";
import SettingsViewModeToggle from "@/components/settings/SettingsViewModeToggle.vue";
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

  it("switches the view of the list, showing the view it is in", async () => {
    const wrapper = mountPanel({ title: "Players", viewMode: "card" });

    const toggle = wrapper.getComponent(SettingsViewModeToggle);
    expect(toggle.props("mode")).toBe("card");
    expect(toggle.attributes("aria-label")).toBe(
      "tooltip.view_mode_switch(view.card,view.list)",
    );
    await toggle.trigger("click");

    expect(wrapper.emitted("toggle-view-mode")).toHaveLength(1);
  });

  it("has no switch for a list without views", () => {
    const wrapper = mountPanel({ title: "Players" });

    expect(wrapper.findComponent(SettingsViewModeToggle).exists()).toBe(false);
  });

  it("runs an action from its button, named in full for assistive technology", async () => {
    const add = action();
    const wrapper = mountPanel({ title: "Music sources", actions: [add] });

    const button = wrapper.get('[data-testid="add-provider"]');
    expect(button.text()).toBe("Add");
    expect(button.attributes("aria-label")).toBe("Add a music source");
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

  it("shows the label of an action without a short one on its button", () => {
    const wrapper = mountPanel({
      title: "Players",
      actions: [
        action({
          key: "add-group",
          label: "Add group player",
          shortLabel: undefined,
        }),
      ],
    });

    const button = wrapper.get('[data-testid="add-group"]');
    expect(button.text()).toBe("Add group player");
    expect(button.attributes("aria-label")).toBeUndefined();
  });
});

function action(
  overrides: Partial<SettingsPanelAction> = {},
): SettingsPanelAction {
  return {
    key: "add-provider",
    label: "Add a music source",
    shortLabel: "Add",
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
