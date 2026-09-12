import EditUserDialog from "@/components/users/EditUserDialog.vue";
import { HOMEASSISTANT_SYSTEM_USER } from "@/helpers/users";
import { type User, UserRole } from "@/plugins/api/interfaces";
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import { user } from "../../fixtures/user";

const { apiMock, storeMock } = vi.hoisted(() => ({
  apiMock: { players: {}, updateUser: vi.fn() },
  storeMock: {
    currentUser: { user_id: "admin-1" },
    // the builtin roles, as the server lists them
    roles: ["admin", "user", "guest", "service"].map((role_id) => ({
      role_id,
      name: role_id,
      scopes: [],
      builtin: true,
    })),
  },
}));

vi.mock("@/plugins/api", () => ({
  api: apiMock,
  ApiCommandError: class extends Error {},
}));

vi.mock("@/plugins/store", () => ({ store: storeMock }));

// role names come translated through the app's i18n, keep them as their keys
vi.mock("@/plugins/i18n", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/plugins/i18n")>()),
  $t: (key: string) => key,
}));

vi.mock("vue-sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("vue-i18n", async (importOriginal) => ({
  ...(await importOriginal<typeof import("vue-i18n")>()),
  useI18n: () => ({ t: (key: string) => key }),
}));

const passthrough = { template: "<div><slot /></div>" };

const systemAccount = user({
  user_id: "ha",
  username: HOMEASSISTANT_SYSTEM_USER,
  role: UserRole.SERVICE,
  display_name: "Home Assistant Integration",
});

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
      },
    },
  });
}

describe("EditUserDialog", () => {
  it("locks the system account's username and role, and hides its password fields", async () => {
    const wrapper = mountDialog(systemAccount);
    // the select shows the chosen option's label once its items are registered
    await flushPromises();

    expect(
      wrapper.get('input[name="username"]').attributes("disabled"),
    ).toBeDefined();
    expect(wrapper.text()).toContain("auth.system_user_hint");
    expect(wrapper.find('input[type="password"]').exists()).toBe(false);
    const roleTrigger = wrapper.get("#role");
    expect(roleTrigger.attributes("disabled")).toBeDefined();
    expect(roleTrigger.text()).toContain("auth.service_role");
  });

  it("leaves a regular user's username, role and password editable", () => {
    const wrapper = mountDialog(user({ username: "marcel" }));

    expect(
      wrapper.get('input[name="username"]').attributes("disabled"),
    ).toBeUndefined();
    expect(wrapper.text()).not.toContain("auth.system_user_hint");
    expect(wrapper.find('input[type="password"]').exists()).toBe(true);
    expect(wrapper.get("#role").attributes("disabled")).toBeUndefined();
  });

  it("sends only the changed display name for the system account", async () => {
    const wrapper = mountDialog(systemAccount);

    await wrapper.get('input[name="displayName"]').setValue("Home Assistant");
    await wrapper.get("form").trigger("submit");
    await flushPromises();

    expect(apiMock.updateUser).toHaveBeenCalledWith(
      "ha",
      { displayName: "Home Assistant" },
      { suppressGlobalError: true },
    );
  });
});
