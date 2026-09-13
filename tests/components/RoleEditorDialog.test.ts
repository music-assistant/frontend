import RoleEditorDialog from "@/components/users/RoleEditorDialog.vue";
import {
  customRoleScopes,
  GRANTABLE_SCOPES,
  GUEST_SCOPES,
} from "@/helpers/roles";
import type { MusicAssistantApi } from "@/plugins/api";
import { ApiCommandError } from "@/plugins/api/errors";
import { type Role, Scope, UserRole } from "@/plugins/api/interfaces";
import {
  enableAutoUnmount,
  flushPromises,
  mount,
  type VueWrapper,
} from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { role } from "../fixtures/role";

const { apiMock, storeMock, toastMock } = vi.hoisted(() => ({
  apiMock: {
    createRole: vi.fn<MusicAssistantApi["createRole"]>(),
    updateRole: vi.fn<MusicAssistantApi["updateRole"]>(),
  },
  storeMock: {
    isTouchscreen: false,
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
vi.mock("@/plugins/i18n", () => ({ $t: (key: string) => key }));
vi.mock("vue-i18n", async (importOriginal) => ({
  ...(await importOriginal<typeof import("vue-i18n")>()),
  useI18n: () => ({ t: (key: string) => key }),
}));
vi.mock("vue-sonner", () => ({ toast: toastMock }));

const userRole = role({
  role_id: UserRole.USER,
  name: "User",
  builtin: true,
  scopes: [
    ...GUEST_SCOPES,
    Scope.LIBRARY_WRITE,
    Scope.CONFIG_PROVIDERS_READ,
    Scope.CONFIG_PROVIDERS_OWN,
  ],
});
const guestRole = role({
  role_id: UserRole.GUEST,
  name: "Guest",
  builtin: true,
  scopes: [...GUEST_SCOPES],
});
const kids = role({
  role_id: "kids-id",
  name: "Kids",
  scopes: customRoleScopes([Scope.USERS_INVITE]),
});

// an open dialog keeps document-level focus trap listeners, so tear it down
// even when an assertion fails
enableAutoUnmount(afterEach);

beforeEach(() => {
  vi.clearAllMocks();
  storeMock.roles = [userRole, guestRole, kids];
  apiMock.createRole.mockResolvedValue(kids);
  apiMock.updateRole.mockResolvedValue(kids);
  document.body.innerHTML = "";
});

describe("RoleEditorDialog", () => {
  it("starts a new role from the permissions of a guest", async () => {
    await openEditor();

    expect(GRANTABLE_SCOPES.filter(isOn)).toEqual([]);
  });

  it("starts over from the permissions of the template picked", async () => {
    await openEditor();

    await click('[data-template="user"]');

    expect(GRANTABLE_SCOPES.filter(isOn)).toEqual([
      Scope.LIBRARY_WRITE,
      Scope.CONFIG_PROVIDERS_READ,
      Scope.CONFIG_PROVIDERS_OWN,
    ]);
  });

  it("turns on and locks the permission another one needs", async () => {
    await openEditor();

    await click(`[data-scope="${Scope.CONFIG_PROVIDERS_OWN}"]`);

    expect(isOn(Scope.CONFIG_PROVIDERS_READ)).toBe(true);
    expect(permissionSwitch(Scope.CONFIG_PROVIDERS_READ).disabled).toBe(true);

    await click(`[data-scope="${Scope.CONFIG_PROVIDERS_OWN}"]`);

    // it stays on, but can be turned off on its own again
    expect(isOn(Scope.CONFIG_PROVIDERS_READ)).toBe(true);
    expect(permissionSwitch(Scope.CONFIG_PROVIDERS_READ).disabled).toBe(false);
  });

  it("asks for a name before creating the role", async () => {
    const wrapper = await openEditor();

    await submit();

    expect(apiMock.createRole).not.toHaveBeenCalled();
    expect(
      document.querySelector("[data-slot='field-error']")?.textContent?.trim(),
    ).toBe("auth.field_required");
    expect(wrapper.emitted("update:open")).toBeUndefined();
  });

  it("creates the role with the permissions that were set", async () => {
    const wrapper = await openEditor();

    await typeName("  Kids  ");
    await click(`[data-scope="${Scope.USERS_INVITE}"]`);
    await submit();

    expect(apiMock.createRole).toHaveBeenCalledWith(
      "Kids",
      customRoleScopes([Scope.USERS_INVITE]),
    );
    expect(toastMock.success).toHaveBeenCalledWith("auth.role_created");
    expect(wrapper.emitted("saved")).toHaveLength(1);
    expect(wrapper.emitted("update:open")).toEqual([[false]]);
  });

  it("shows why the server refused the role and stays open", async () => {
    const reason = "A role with this name already exists.";
    apiMock.createRole.mockRejectedValue(
      new ApiCommandError(reason, 1, reason),
    );
    const wrapper = await openEditor();

    await typeName("Guest");
    await submit();

    expect(toastMock.error).toHaveBeenCalledWith(reason);
    expect(wrapper.emitted("update:open")).toBeUndefined();
  });

  it("offers no template for an existing role", async () => {
    await openEditor(kids);

    expect(document.querySelector("[data-template]")).toBeNull();
    expect(isOn(Scope.USERS_INVITE)).toBe(true);
  });

  it("sends only the name of an existing role when only that changed", async () => {
    await openEditor(kids);

    await typeName("Teens");
    await submit();

    expect(apiMock.updateRole).toHaveBeenCalledWith("kids-id", {
      name: "Teens",
    });
    expect(toastMock.success).toHaveBeenCalledWith("auth.role_updated");
  });

  it("sends the permissions of an existing role once they changed", async () => {
    await openEditor(kids);

    await click(`[data-scope="${Scope.USERS_INVITE}"]`);
    await submit();

    expect(apiMock.updateRole).toHaveBeenCalledWith("kids-id", {
      scopes: customRoleScopes([]),
    });
  });

  it("closes without a call when nothing changed", async () => {
    const wrapper = await openEditor(kids);

    await submit();

    expect(apiMock.updateRole).not.toHaveBeenCalled();
    expect(wrapper.emitted("update:open")).toEqual([[false]]);
  });
});

async function openEditor(editRole: Role | null = null): Promise<VueWrapper> {
  const wrapper = mount(RoleEditorDialog, {
    props: { open: false, role: editRole },
    attachTo: document.body,
    global: { mocks: { $t: (key: string) => key } },
  });
  await wrapper.setProps({ open: true });
  await flushPromises();
  return wrapper;
}

function permissionSwitch(scope: string) {
  const element = document.querySelector<HTMLButtonElement>(
    `[data-scope="${scope}"]`,
  );
  if (!element) throw new Error(`No switch for ${scope}`);
  return element;
}

function isOn(scope: string) {
  return permissionSwitch(scope).getAttribute("aria-checked") === "true";
}

async function click(selector: string) {
  const element = document.querySelector<HTMLElement>(selector);
  if (!element) throw new Error(`Nothing matches ${selector}`);
  element.click();
  await flushPromises();
}

async function typeName(value: string) {
  const input = document.querySelector<HTMLInputElement>(
    '[data-testid="role-name"]',
  );
  if (!input) throw new Error("No name field");
  input.value = value;
  input.dispatchEvent(new Event("input"));
  await flushPromises();
}

async function submit() {
  document
    .querySelector("#form-role-editor")
    ?.dispatchEvent(new Event("submit"));
  await flushPromises();
}
