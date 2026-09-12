import EditUserDialog from "@/components/users/EditUserDialog.vue";
import { HOMEASSISTANT_SYSTEM_USER } from "@/helpers/users";
import { type User, UserRole } from "@/plugins/api/interfaces";
import { mount, type VueWrapper } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import { user } from "../../fixtures/user";

const { apiMock, storeMock } = vi.hoisted(() => ({
  apiMock: { players: {}, updateUser: vi.fn() },
  storeMock: { currentUser: { user_id: "admin-1" } },
}));

vi.mock("@/plugins/api", () => ({
  api: apiMock,
  ApiCommandError: class extends Error {},
}));

vi.mock("@/plugins/store", () => ({ store: storeMock }));

vi.mock("vue-sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("vue-i18n", async (importOriginal) => ({
  ...(await importOriginal<typeof import("vue-i18n")>()),
  useI18n: () => ({ t: (key: string) => key }),
}));

const passthrough = { template: "<div><slot /></div>" };
// the real Select relies on reka-ui context its sub-components inject from,
// so all of it is stubbed together, forwarding just what the tests check
const selectStub = {
  name: "SelectStub",
  props: ["modelValue", "disabled"],
  emits: ["update:modelValue"],
  template: "<div><slot /></div>",
};

function mountDialog(editedUser: User): VueWrapper {
  return mount(EditUserDialog, {
    props: {
      modelValue: true,
      user: editedUser,
    },
    global: {
      mocks: { $t: (key: string) => key },
      stubs: {
        Dialog: passthrough,
        DialogContent: passthrough,
        DialogFooter: passthrough,
        DialogHeader: passthrough,
        DialogTitle: passthrough,
        Button: passthrough,
        MultiSelect: true,
        Select: selectStub,
        SelectTrigger: true,
        SelectContent: true,
        SelectItem: true,
        SelectValue: true,
      },
    },
  });
}

describe("EditUserDialog", () => {
  it("locks the system account's username and role, and hides its password fields", () => {
    const wrapper = mountDialog(
      user({ username: HOMEASSISTANT_SYSTEM_USER, role: UserRole.SERVICE }),
    );

    const usernameInput = wrapper.get<HTMLInputElement>(
      'input[name="username"]',
    );
    expect(usernameInput.attributes("disabled")).toBeDefined();
    expect(wrapper.text()).toContain("auth.system_user_hint");
    expect(wrapper.find('input[type="password"]').exists()).toBe(false);
    expect(
      wrapper.findComponent({ name: "SelectStub" }).props("disabled"),
    ).toBe(true);
  });

  it("leaves a regular user's username, role and password editable", () => {
    const wrapper = mountDialog(user({ username: "marcel" }));

    const usernameInput = wrapper.get<HTMLInputElement>(
      'input[name="username"]',
    );
    expect(usernameInput.attributes("disabled")).toBeUndefined();
    expect(wrapper.text()).not.toContain("auth.system_user_hint");
    expect(wrapper.find('input[type="password"]').exists()).toBe(true);
    expect(
      wrapper.findComponent({ name: "SelectStub" }).props("disabled"),
    ).toBe(false);
  });
});
