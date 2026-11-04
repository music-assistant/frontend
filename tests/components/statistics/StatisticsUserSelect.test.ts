import StatisticsUserSelect from "@/components/statistics/StatisticsUserSelect.vue";
import type { User } from "@/plugins/api/interfaces";
import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";

const { getAllUsers } = vi.hoisted(() => ({ getAllUsers: vi.fn() }));

vi.mock("@/plugins/api", () => ({ default: { getAllUsers } }));
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
const ALL = USERS.map((u) => u.user_id);

// the menu is rendered inline and open, so its items click like buttons
const passthrough = { template: "<div><slot /></div>" };
const CheckboxItemStub = {
  props: ["modelValue"],
  emits: ["update:modelValue", "select"],
  template: `<button role="menuitemcheckbox" :aria-checked="modelValue"
    @click="$emit('select', $event); $emit('update:modelValue', !modelValue)"><slot /></button>`,
};

async function mountSelect(modelValue: string[]) {
  getAllUsers.mockResolvedValue(USERS);
  const wrapper = mount(StatisticsUserSelect, {
    props: { modelValue },
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
  await flushPromises();
  return wrapper;
}

const item = (wrapper: Awaited<ReturnType<typeof mountSelect>>, name: string) =>
  wrapper
    .findAll('[role="menuitemcheckbox"]')
    .find((entry) => entry.text() === name)!;

describe("StatisticsUserSelect", () => {
  it.each([
    { selected: [], summary: "Only me", checked: ["Me Myself"] },
    { selected: ["alice"], summary: "Alice", checked: ["Alice"] },
    {
      selected: ["self", "alice"],
      summary: "2 users",
      checked: ["Me Myself", "Alice"],
    },
    {
      selected: ALL,
      summary: "All users",
      checked: ["All users", "Me Myself", "Alice", "homeassistant_system"],
    },
  ])(
    "summarises $selected as $summary",
    async ({ selected, summary, checked }) => {
      const wrapper = await mountSelect(selected);

      expect(wrapper.get("button:not([role])").text()).toBe(summary);
      expect(
        wrapper
          .findAll('[role="menuitemcheckbox"][aria-checked="true"]')
          .map((entry) => entry.text()),
      ).toEqual(checked);
    },
  );

  it.each([
    { selected: [], click: "Alice", emitted: ["self", "alice"] },
    { selected: ["alice", "self"], click: "Alice", emitted: [] },
    { selected: ["self", "alice"], click: "Me Myself", emitted: ["alice"] },
    { selected: ["alice"], click: "Alice", emitted: [] },
    { selected: [], click: "All users", emitted: ALL },
    { selected: ALL, click: "All users", emitted: [] },
  ])(
    "clicking $click with $selected selects $emitted",
    async ({ selected, click, emitted }) => {
      const wrapper = await mountSelect(selected);

      await item(wrapper, click).trigger("click");

      expect(wrapper.emitted("update:modelValue")).toEqual([[emitted]]);
    },
  );
});
