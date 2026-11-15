import RoleDetailsDialog from "@/components/users/RoleDetailsDialog.vue";
import { type Role, Scope, UserRole } from "@/plugins/api/interfaces";
import { mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BUILTIN_ROLE_SCOPES } from "../../fixtures/scopes";

const { storeMock } = vi.hoisted(() => ({
  storeMock: { roles: [] as Role[] },
}));

vi.mock("@/plugins/store", () => ({ store: storeMock }));

// builtin role names come translated through the app's i18n, keep them as their keys
vi.mock("@/plugins/i18n", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/plugins/i18n")>()),
  $t: (key: string) => key,
}));

const passthrough = { template: "<div><slot /></div>" };

const role = (overrides: Partial<Role>): Role => ({
  role_id: "role",
  name: "Role",
  scopes: [],
  builtin: true,
  ...overrides,
});

function mountDialog(shown: Role) {
  return mount(RoleDetailsDialog, {
    props: { open: true, role: shown },
    global: {
      mocks: { $t: (key: string) => key },
      stubs: {
        Dialog: passthrough,
        DialogContent: passthrough,
        DialogDescription: passthrough,
        DialogFooter: passthrough,
        DialogHeader: passthrough,
        DialogTitle: passthrough,
        Button: passthrough,
      },
    },
  });
}

describe("RoleDetailsDialog", () => {
  beforeEach(() => {
    storeMock.roles = [];
  });

  it("lists a builtin role's permissions, and what it may do beyond any custom role", () => {
    // a builtin role that may act as other users, which no custom role can
    const scopes = [
      ...BUILTIN_ROLE_SCOPES.guest,
      Scope.USERS_READ,
      Scope.USERS_IMPERSONATE,
    ];

    const wrapper = mountDialog(role({ role_id: UserRole.SERVICE, scopes }));

    expect(wrapper.text()).toContain("auth.builtin_role_hint");
    expect(wrapper.text()).toContain("auth.permissions.always");
    expect(wrapper.text()).toContain("auth.permissions.also");
    expect(wrapper.text()).toContain("auth.permissions.users_impersonate");
    // the permissions are shown, not offered for change
    const switches = wrapper.findAll("[data-scope]");
    expect(switches.length).toBeGreaterThan(0);
    expect(
      switches.every((toggle) => toggle.attributes("disabled") !== undefined),
    ).toBe(true);
  });

  it("shows no permission list for the admin role, which may do everything", () => {
    const wrapper = mountDialog(
      role({ role_id: UserRole.ADMIN, scopes: [Scope.ALL] }),
    );

    expect(wrapper.text()).toContain("auth.admin_role_permissions");
    expect(wrapper.text()).not.toContain("auth.permissions.always");
  });

  it("tells who may change a custom role it shows", () => {
    const household = role({
      role_id: "household_member",
      name: "Household member",
      scopes: [...BUILTIN_ROLE_SCOPES.guest],
      builtin: false,
    });
    storeMock.roles = [household];

    const wrapper = mountDialog(household);

    expect(wrapper.text()).toContain("Household member");
    expect(wrapper.text()).toContain("auth.custom_role_readonly_hint");
    expect(wrapper.text()).not.toContain("auth.permissions.also");
  });
});
