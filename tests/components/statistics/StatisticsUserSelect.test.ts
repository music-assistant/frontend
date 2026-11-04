import StatisticsUserSelect from "@/components/statistics/StatisticsUserSelect.vue";
import type { User } from "@/plugins/api/interfaces";
import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { getAllUsers, toastError } = vi.hoisted(() => ({
  getAllUsers: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/plugins/api", () => ({ default: { getAllUsers } }));
vi.mock("@/plugins/store", () => ({
  store: { currentUser: { user_id: "self" } },
}));
vi.mock("vue-sonner", () => ({ toast: { error: toastError } }));

enableAutoUnmount(afterEach);

const user = (user_id: string, display_name: string | null): User =>
  ({ user_id, username: user_id, display_name }) as User;

// in server order, which the menu does not keep
const USERS = [
  user("homeassistant_system", null),
  user("bob", "Bob"),
  user("self", "Me Myself"),
  user("alice", "Alice"),
];
const ALL = ["self", "alice", "bob", "homeassistant_system"];

// the menu is rendered inline and open, so its items click like buttons
const passthrough = { template: "<div><slot /></div>" };
const CheckboxItemStub = {
  props: ["modelValue"],
  emits: ["update:modelValue", "select"],
  template: `<button role="menuitemcheckbox" :aria-checked="modelValue"
    @click="$emit('select', $event); $emit('update:modelValue', !modelValue)"><slot /></button>`,
};

beforeEach(() => {
  vi.resetAllMocks();
  getAllUsers.mockResolvedValue(USERS);
});

async function mountSelect(modelValue: string[]) {
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
  it("lists all users, then the current user, then the others by name", async () => {
    const wrapper = await mountSelect([]);

    expect(
      wrapper.findAll('[role="menuitemcheckbox"]').map((entry) => entry.text()),
    ).toEqual([
      "All users",
      "Me Myself",
      "Alice",
      "Bob",
      "homeassistant_system",
    ]);
  });

  it("toasts when the users can not be loaded", async () => {
    getAllUsers.mockRejectedValue(new Error("offline"));
    const wrapper = await mountSelect([]);

    expect(toastError).toHaveBeenCalledExactlyOnceWith("Failed to load users");
    expect(wrapper.findAll('[role="menuitemcheckbox"]')).toHaveLength(1);
  });

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
      checked: [
        "All users",
        "Me Myself",
        "Alice",
        "Bob",
        "homeassistant_system",
      ],
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
