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

function mountRows(rows: SettingsRow[]) {
  return mount(SettingsLinkRows, {
    props: { rows, testIdPrefix: "tasks" },
    global: { stubs: { RouterLink: RouterLinkStub } },
  });
}
