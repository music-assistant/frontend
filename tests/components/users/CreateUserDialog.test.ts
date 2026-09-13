import CreateUserDialog from "@/components/users/CreateUserDialog.vue";
import { flushPromises, mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";

const { apiMock, storeMock } = vi.hoisted(() => ({
  apiMock: { players: {}, createUser: vi.fn() },
  storeMock: {
    currentUser: { user_id: "admin-1" },
    // the roles as the server lists them: the builtin ones and a custom one
    roles: [
      ...["admin", "user", "guest", "service"].map((role_id) => ({
        role_id,
        name: role_id,
        scopes: [],
        builtin: true,
      })),
      {
        role_id: "household_member",
        name: "Household member",
        scopes: [],
        builtin: false,
      },
    ],
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

describe("CreateUserDialog", () => {
  it("offers the roles the server lists, a custom one by its name", async () => {
    const wrapper = mount(CreateUserDialog, {
      props: { modelValue: true },
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
          // the options only render in an open menu, which the test DOM can't open
          SelectContent: passthrough,
          SelectItem: {
            props: ["value"],
            template: '<div :data-value="value"><slot /></div>',
          },
        },
      },
    });
    await flushPromises();

    const options = wrapper
      .findAll("[data-value]")
      .map((option) => [option.attributes("data-value"), option.text()]);
    expect(options).toContainEqual(["household_member", "Household member"]);
    // the service role is for integrations, so a new user isn't offered it
    expect(options.map(([value]) => value)).toEqual([
      "admin",
      "user",
      "guest",
      "household_member",
    ]);
  });
});
