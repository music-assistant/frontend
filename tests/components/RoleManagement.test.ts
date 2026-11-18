import RoleManagement from "@/components/users/RoleManagement.vue";
import type { MusicAssistantApi } from "@/plugins/api";
import { ApiCommandError } from "@/plugins/api/errors";
import { type Role, Scope, UserRole } from "@/plugins/api/interfaces";
import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { role } from "../fixtures/role";
import { BUILTIN_ROLE_SCOPES, scopeChecker } from "../fixtures/scopes";
import { user } from "../fixtures/user";

const {
  apiMock,
  DetailsStub,
  EditorStub,
  hasScopeMock,
  i18nMock,
  loadRolesMock,
  storeMock,
  toastMock,
} = vi.hoisted(() => ({
  apiMock: {
    deleteRole: vi.fn<MusicAssistantApi["deleteRole"]>(),
  },
  // rendered in place of the real dialogs, exposing what they were handed
  DetailsStub: {
    name: "RoleDetailsDialog",
    props: ["open", "role"],
    template: `<div data-testid="role-details" :data-open="String(open)" :data-role="role?.role_id ?? ''" />`,
  },
  EditorStub: {
    name: "RoleEditorDialog",
    props: ["open", "role"],
    template: `<div data-testid="role-editor" :data-open="String(open)" :data-role="role?.role_id ?? ''" />`,
  },
  hasScopeMock: vi.fn<(scope: Scope) => boolean>(),
  i18nMock: {
    t: vi.fn((key: string) => key),
  },
  loadRolesMock: vi.fn(),
  storeMock: {
    roles: [] as Role[],
  },
  toastMock: {
    error: vi.fn(),
    success: vi.fn(),
  },
}));

vi.mock("@/plugins/api", async () => {
  const { ApiCommandError } = await import("@/plugins/api/errors");
  return { api: apiMock, default: apiMock, ApiCommandError };
});
vi.mock("@/plugins/store", () => ({ store: storeMock }));
vi.mock("@/plugins/auth", () => ({ authManager: { hasScope: hasScopeMock } }));
vi.mock("@/plugins/i18n", () => ({ $t: (key: string) => key }));
vi.mock("@/composables/roles", () => ({ loadRoles: loadRolesMock }));
vi.mock("@/components/users/RoleEditorDialog.vue", () => ({
  default: EditorStub,
}));
vi.mock("@/components/users/RoleDetailsDialog.vue", () => ({
  default: DetailsStub,
}));
vi.mock("vue-i18n", async (importOriginal) => ({
  ...(await importOriginal<typeof import("vue-i18n")>()),
  useI18n: () => i18nMock,
}));
vi.mock("vue-sonner", () => ({ toast: toastMock }));

const builtinRoles = [
  role({
    role_id: UserRole.ADMIN,
    name: "Administrator",
    scopes: [Scope.ALL],
    builtin: true,
  }),
  role({ role_id: UserRole.USER, name: "User", builtin: true }),
  role({ role_id: UserRole.GUEST, name: "Guest", builtin: true }),
  role({ role_id: UserRole.SERVICE, name: "Service", builtin: true }),
];
const kids = role({ role_id: "kids-id", name: "Kids" });
const teens = role({ role_id: "teens-id", name: "Teens" });
// a custom role that may see the users, and with them the roles, but not change them
const USERS_READ_SCOPES = [...BUILTIN_ROLE_SCOPES.guest, Scope.USERS_READ];

// the second holder of the kids role is disabled, which keeps its role all the same
const users = [
  user({ user_id: "user-1", role: "kids-id" }),
  user({ user_id: "user-2", role: "kids-id", enabled: false }),
  user({ user_id: "user-3", role: UserRole.ADMIN }),
];

// an open dialog keeps document-level focus trap listeners, so tear it down
// even when an assertion fails
enableAutoUnmount(afterEach);

beforeEach(() => {
  vi.clearAllMocks();
  hasScopeMock.mockImplementation(scopeChecker(BUILTIN_ROLE_SCOPES.admin));
  storeMock.roles = [...builtinRoles, kids, teens];
  loadRolesMock.mockResolvedValue(undefined);
  apiMock.deleteRole.mockResolvedValue(undefined);
  document.body.innerHTML = "";
});

describe("RoleManagement", () => {
  it("reloads the roles when it opens", async () => {
    mountRoles();
    await flushPromises();

    expect(loadRolesMock).toHaveBeenCalledWith({ suppressGlobalError: true });
  });

  it("lists the builtin roles by their translated name", () => {
    const wrapper = mountRoles();

    expect(
      wrapper.findAll('[data-testid="builtin-role"]').map((row) => row.text()),
    ).toEqual([
      expect.stringContaining("auth.admin_role"),
      expect.stringContaining("auth.user_role"),
      expect.stringContaining("auth.guest_role"),
      expect.stringContaining("auth.service_role"),
    ]);
  });

  it("lists the custom roles with how many users hold them", () => {
    const wrapper = mountRoles();

    expect(
      wrapper.findAll('[data-testid="custom-role"]').map((row) => row.text()),
    ).toEqual([
      expect.stringContaining("Kids"),
      expect.stringContaining("Teens"),
    ]);
    expect(i18nMock.t).toHaveBeenCalledWith("auth.role_users", 2, {
      named: { count: 2 },
    });
    expect(i18nMock.t).toHaveBeenCalledWith("auth.role_users", 0, {
      named: { count: 0 },
    });
  });

  it("invites to create a role while there is none", () => {
    storeMock.roles = [...builtinRoles];

    const wrapper = mountRoles();

    expect(wrapper.find('[data-testid="no-custom-roles"]').exists()).toBe(true);
  });

  it("shows a builtin role read-only and opens a custom role in the editor", async () => {
    const wrapper = mountRoles();

    await wrapper.findAll('[data-testid="builtin-role"]')[0].trigger("click");
    expect(details(wrapper)).toEqual({ open: "true", role: UserRole.ADMIN });

    await wrapper.findAll('[data-testid="custom-role"]')[0].trigger("click");
    expect(editor(wrapper)).toEqual({ open: "true", role: "kids-id" });
  });

  it("opens the editor for a new role", async () => {
    const wrapper = mountRoles();

    await wrapper.get('[data-testid="create-role"]').trigger("click");

    expect(editor(wrapper)).toEqual({ open: "true", role: "" });
  });

  it("keeps a role that a user holds from being deleted", () => {
    const wrapper = mountRoles();

    const [kidsDelete, teensDelete] = wrapper.findAll(
      '[data-testid="delete-role"]',
    );
    expect(kidsDelete.attributes("disabled")).toBeDefined();
    expect(teensDelete.attributes("disabled")).toBeUndefined();
  });

  it("deletes a role once confirmed and reloads the roles", async () => {
    const wrapper = mountRoles();
    await flushPromises();

    await confirmDelete(wrapper);

    expect(apiMock.deleteRole).toHaveBeenCalledWith("teens-id");
    expect(toastMock.success).toHaveBeenCalledWith("auth.role_deleted");
    expect(loadRolesMock).toHaveBeenCalledTimes(2);
  });

  it("shows why the server refused to delete the role", async () => {
    const reason = "This role is still assigned to one or more users.";
    apiMock.deleteRole.mockRejectedValue(
      new ApiCommandError(reason, 1, reason),
    );
    const wrapper = mountRoles();

    await confirmDelete(wrapper);

    expect(toastMock.error).toHaveBeenCalledWith(reason);
  });

  it("shows the roles read-only to a role that can not manage the users", async () => {
    hasScopeMock.mockImplementation(scopeChecker(USERS_READ_SCOPES));
    const wrapper = mountRoles();

    expect(wrapper.find('[data-testid="create-role"]').exists()).toBe(false);
    expect(wrapper.find('[data-testid="delete-role"]').exists()).toBe(false);
    expect(wrapper.find('[aria-label^="auth.edit_role"]').exists()).toBe(false);

    await wrapper.findAll('[data-testid="custom-role"]')[0].trigger("click");
    expect(details(wrapper)).toEqual({ open: "true", role: "kids-id" });
    expect(editor(wrapper).open).toBe("false");
  });

  it("invites only a role that can manage the users to create a role", () => {
    hasScopeMock.mockImplementation(scopeChecker(USERS_READ_SCOPES));
    storeMock.roles = [...builtinRoles];

    const wrapper = mountRoles();

    const empty = wrapper.get('[data-testid="no-custom-roles"]');
    expect(empty.text()).toContain("auth.no_custom_roles");
    expect(empty.text()).not.toContain("auth.no_custom_roles_hint");
  });
});

function mountRoles() {
  return mount(RoleManagement, {
    props: { users },
    attachTo: document.body,
    global: { mocks: { $t: (key: string) => key } },
  });
}

function details(wrapper: ReturnType<typeof mountRoles>) {
  const stub = wrapper.get('[data-testid="role-details"]');
  return {
    open: stub.attributes("data-open"),
    role: stub.attributes("data-role"),
  };
}

function editor(wrapper: ReturnType<typeof mountRoles>) {
  const stub = wrapper.get('[data-testid="role-editor"]');
  return {
    open: stub.attributes("data-open"),
    role: stub.attributes("data-role"),
  };
}

// deletes the role that no user holds, through its confirmation
async function confirmDelete(wrapper: ReturnType<typeof mountRoles>) {
  await wrapper.findAll('[data-testid="delete-role"]')[1].trigger("click");
  await flushPromises();
  document
    .querySelector<HTMLElement>('[data-testid="confirm-delete-role"]')
    ?.click();
  await flushPromises();
}
