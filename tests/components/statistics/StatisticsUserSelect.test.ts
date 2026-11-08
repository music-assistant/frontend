import StatisticsUserSelect from "@/components/statistics/StatisticsUserSelect.vue";
import type { StatisticsUsers, User } from "@/plugins/api/interfaces";
import { enableAutoUnmount, mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/plugins/store", () => ({
  store: { currentUser: { user_id: "self" } },
}));

enableAutoUnmount(afterEach);

const user = (user_id: string, display_name: string | null): User =>
  ({ user_id, username: user_id, display_name }) as User;

const USERS = [
  user("self", "Me Myself"),
  user("alice", "Alice"),
  user("homeassistant_system", null),
];

// the menu is rendered inline and open, so its items click like buttons
const passthrough = { template: "<div><slot /></div>" };
const CheckboxItemStub = {
  props: ["modelValue"],
  emits: ["update:modelValue", "select"],
  template: `<button role="menuitemcheckbox" :aria-checked="modelValue"
    @click="$emit('select', $event); $emit('update:modelValue', !modelValue)"><slot /></button>`,
};

const mountSelect = (modelValue: StatisticsUsers) =>
  mount(StatisticsUserSelect, {
    props: { modelValue, users: USERS },
    global: {
      stubs: {
        DropdownMenu: passthrough,
        DropdownMenuTrigger: passthrough,
        DropdownMenuContent: passthrough,
        DropdownMenuSeparator: { template: "<hr />" },
        DropdownMenuCheckboxItem: CheckboxItemStub,
      },
    },
  });

const item = (wrapper: ReturnType<typeof mountSelect>, name: string) =>
  wrapper
    .findAll('[role="menuitemcheckbox"]')
    .find((entry) => entry.text() === name)!;

describe("StatisticsUserSelect", () => {
  it.each([
    { selected: {}, summary: "Only me", checked: ["Me Myself"] },
    { selected: { users: ["alice"] }, summary: "Alice", checked: ["Alice"] },
    {
      selected: { users: ["self", "alice"] },
      summary: "2 users",
      checked: ["Me Myself", "Alice"],
    },
    {
      selected: { all_users: true },
      summary: "All users",
      checked: ["All users", "Me Myself", "Alice", "homeassistant_system"],
    },
  ])("summarises $selected as $summary", ({ selected, summary, checked }) => {
    const wrapper = mountSelect(selected);

    expect(wrapper.get("button:not([role])").text()).toBe(summary);
    expect(
      wrapper
        .findAll('[role="menuitemcheckbox"][aria-checked="true"]')
        .map((entry) => entry.text()),
    ).toEqual(checked);
  });

  it.each([
    { selected: {}, click: "Alice", emitted: { users: ["self", "alice"] } },
    { selected: { users: ["alice", "self"] }, click: "Alice", emitted: {} },
    {
      selected: { users: ["self", "alice"] },
      click: "Me Myself",
      emitted: { users: ["alice"] },
    },
    { selected: { users: ["alice"] }, click: "Alice", emitted: {} },
    { selected: {}, click: "All users", emitted: { all_users: true } },
    // ticking the last missing user is the same as all users
    {
      selected: { users: ["self", "alice"] },
      click: "homeassistant_system",
      emitted: { all_users: true },
    },
    { selected: { all_users: true }, click: "All users", emitted: {} },
    {
      selected: { all_users: true },
      click: "Alice",
      emitted: { users: ["self", "homeassistant_system"] },
    },
  ])(
    "clicking $click with $selected selects $emitted",
    async ({ selected, click, emitted }) => {
      const wrapper = mountSelect(selected);

      await item(wrapper, click).trigger("click");

      expect(wrapper.emitted("update:modelValue")).toEqual([[emitted]]);
    },
  );
});
