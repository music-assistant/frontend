import { HOMEASSISTANT_SYSTEM_USER } from "@/helpers/users";
import { Scope, UserRole } from "@/plugins/api/interfaces";
import UserManagement from "@/views/settings/UserManagement.vue";
import { flushPromises, mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BUILTIN_ROLE_SCOPES, scopeChecker } from "../fixtures/scopes";
import { user } from "../fixtures/user";

const { apiMock, hasScopeMock, routeMock, routerMock, storeMock } = vi.hoisted(
  () => ({
    apiMock: { getAllUsers: vi.fn(), supportsRoles: false },
    hasScopeMock: vi.fn<(scope: Scope) => boolean>(),
    routeMock: { query: {} as Record<string, string> },
    routerMock: { push: vi.fn(), replace: vi.fn() },
    storeMock: { currentUser: { user_id: "admin-1" } },
  }),
);

vi.mock("@/plugins/api", () => ({ api: apiMock }));

vi.mock("@/plugins/store", () => ({ store: storeMock }));

vi.mock("@/plugins/auth", () => ({ authManager: { hasScope: hasScopeMock } }));

vi.mock("@/composables/roles", () => ({
  loadRoles: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("vue-sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}));

vi.mock("vue-router", async (importOriginal) => ({
  ...(await importOriginal<typeof import("vue-router")>()),
  useRoute: () => routeMock,
  useRouter: () => routerMock,
}));

vi.mock("vue-i18n", async (importOriginal) => ({
  ...(await importOriginal<typeof import("vue-i18n")>()),
  useI18n: () => ({ t: (key: string) => key }),
}));

const passthrough = { template: "<div><slot /></div>" };

async function mountView() {
  apiMock.getAllUsers.mockResolvedValue([
    user({
      user_id: "ha",
      username: HOMEASSISTANT_SYSTEM_USER,
      role: UserRole.SERVICE,
      display_name: "Home Assistant Integration",
    }),
    user({ user_id: "marcel", username: "marcel", display_name: "Marcel" }),
  ]);
  const wrapper = mount(UserManagement, {
    global: {
      mocks: { $t: (key: string) => key },
      stubs: {
        // covered by their own tests; here they only add noise if mounted for real
        CreateUserDialog: true,
        RoleManagement: true,
        EditUserDialog: true,
        DisableUserDialog: true,
        DeleteUserDialog: true,
        ManageTokensDialog: true,
        RevokeTokenDialog: true,
        // the test DOM can't open the menu with a pointer, so its content
        // renders inline and the offered actions can be read from each card
        DropdownMenu: passthrough,
        DropdownMenuContent: passthrough,
        DropdownMenuItem: passthrough,
        DropdownMenuSeparator: true,
        DropdownMenuTrigger: passthrough,
      },
    },
  });
  await flushPromises();
  return wrapper;
}

describe("UserManagement", () => {
  beforeEach(() => {
    hasScopeMock.mockImplementation(scopeChecker(BUILTIN_ROLE_SCOPES.admin));
    apiMock.supportsRoles = false;
  });

  it("shows the System badge only on the Home Assistant account's card", async () => {
    const wrapper = await mountView();

    const cards = wrapper.findAll('[data-slot="card"]');
    expect(cards).toHaveLength(2);
    expect(cards[0].text()).toContain("auth.system_user");
    expect(cards[1].text()).not.toContain("auth.system_user");
  });

  it("offers no disable or delete action for the Home Assistant account", async () => {
    const wrapper = await mountView();

    const [systemCard, memberCard] = wrapper.findAll('[data-slot="card"]');
    expect(systemCard.text()).toContain("auth.edit_user");
    expect(systemCard.text()).toContain("auth.manage_tokens");
    expect(systemCard.text()).not.toContain("auth.disable_user");
    expect(systemCard.text()).not.toContain("auth.delete_user");
    expect(memberCard.text()).toContain("auth.disable_user");
    expect(memberCard.text()).toContain("auth.delete_user");
  });

  it("lists the users without a way to change them to a role that only reads them", async () => {
    hasScopeMock.mockImplementation(
      scopeChecker([...BUILTIN_ROLE_SCOPES.guest, Scope.USERS_READ]),
    );

    const wrapper = await mountView();

    expect(wrapper.findAll('[data-slot="card"]')).toHaveLength(2);
    expect(wrapper.text()).not.toContain("auth.create_user");
    expect(wrapper.text()).not.toContain("auth.edit_user");
    expect(wrapper.text()).not.toContain("auth.manage_tokens");
  });

  it("shows only the users on a server without roles", async () => {
    const wrapper = await mountView();

    expect(wrapper.findAll('[role="tab"]')).toHaveLength(0);
    expect(wrapper.findAll('[data-slot="card"]')).toHaveLength(2);
  });

  it("puts the roles in a tab next to the users on a server with roles", async () => {
    apiMock.supportsRoles = true;

    const wrapper = await mountView();

    expect(wrapper.findAll('[role="tab"]').map((tab) => tab.text())).toEqual([
      "auth.users",
      "auth.roles",
    ]);
  });
});
