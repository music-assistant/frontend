import SettingsLinkRows, {
  type SettingsRow,
} from "@/components/settings/SettingsLinkRows.vue";
import { ChevronRight, RefreshCw, Timer } from "@lucide/vue";
import { enableAutoUnmount, mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import { markRaw } from "vue";

const RouterLinkStub = {
  props: ["to"],
  template: '<a :href="JSON.stringify(to)"><slot /></a>',
};

enableAutoUnmount(afterEach);

describe("SettingsLinkRows", () => {
  it("renders nothing without rows", () => {
    expect(mountRows([]).html()).toBe("<!--v-if-->");
  });

  it("leads a navigation row to its route", () => {
    const wrapper = mountRows([
      row({ to: { name: "editcore", params: { domain: "tasks" } } }),
    ]);

    const link = wrapper.get('[data-testid="tasks-link-settings"]');
    expect(link.element.tagName).toBe("A");
    expect(JSON.parse(link.attributes("href")!)).toEqual({
      name: "editcore",
      params: { domain: "tasks" },
    });
    expect(link.text()).toContain("Task settings");
    expect(wrapper.get('[data-testid="tasks-description"]').text()).toBe(
      "How many tasks run at once",
    );
    expect(link.findComponent(ChevronRight).exists()).toBe(true);
  });

  it("runs the action of a row that acts on the spot", async () => {
    const action = vi.fn();
    const wrapper = mountRows([
      row({ action, actionIcon: markRaw(RefreshCw), state: "Sync" }),
    ]);

    const button = wrapper.get('[data-testid="tasks-link-settings"]');
    expect(button.element.tagName).toBe("BUTTON");
    await button.trigger("click");

    expect(action).toHaveBeenCalledOnce();
    expect(wrapper.get('[data-testid="tasks-state"]').text()).toBe("Sync");
  });

  it("disables a busy row", () => {
    const wrapper = mountRows([
      row({ action: vi.fn(), actionIcon: markRaw(RefreshCw), busy: true }),
    ]);

    expect(
      wrapper.get('[data-testid="tasks-link-settings"]').attributes("disabled"),
    ).toBeDefined();
  });

  it("shows a row without a navigation or action as plain text", () => {
    const wrapper = mountRows([row()]);

    expect(
      wrapper.get('[data-testid="tasks-link-settings"]').element.tagName,
    ).toBe("DIV");
  });

  it("shows the control a row holds at its end, in place of the chevron", async () => {
    const action = vi.fn();
    const wrapper = mountRows(
      [row({ to: { name: "editcore" }, action })],
      '<input v-if="row.key === \'settings\'" data-testid="control" />',
    );

    const held = wrapper.get('[data-testid="tasks-link-settings"]');
    // the control acts, so the row is no link or button itself
    expect(held.element.tagName).toBe("DIV");
    expect(held.attributes("href")).toBeUndefined();
    expect(held.classes()).not.toContain("hover:bg-accent/50");
    expect(held.find('[data-testid="control"]').exists()).toBe(true);
    expect(held.findComponent(ChevronRight).exists()).toBe(false);
    await held.trigger("click");
    expect(action).not.toHaveBeenCalled();
  });

  it("keeps the rows a control leaves out as they are", () => {
    const wrapper = mountRows(
      [
        row({ key: "picker" }),
        row({ key: "settings", to: { name: "editcore" } }),
      ],
      '<input v-if="row.key === \'picker\'" data-testid="control" />',
    );

    const link = wrapper.get('[data-testid="tasks-link-settings"]');
    expect(link.element.tagName).toBe("A");
    expect(link.find('[data-testid="control"]').exists()).toBe(false);
    expect(link.findComponent(ChevronRight).exists()).toBe(true);
    expect(
      wrapper
        .get('[data-testid="tasks-link-picker"]')
        .find('[data-testid="control"]')
        .exists(),
    ).toBe(true);
  });
});

function row(overrides: Partial<SettingsRow> = {}): SettingsRow {
  return {
    key: "settings",
    icon: markRaw(Timer),
    label: "Task settings",
    description: "How many tasks run at once",
    ...overrides,
  };
}

// the control slot, as a template that sees the row it renders for
function mountRows(rows: SettingsRow[], control?: string) {
  return mount(SettingsLinkRows, {
    props: { rows, testIdPrefix: "tasks" },
    slots: control
      ? { control: `<template #control="{ row }">${control}</template>` }
      : {},
    global: { stubs: { RouterLink: RouterLinkStub } },
  });
}
