import { Scope, UserRole } from "@/plugins/api/interfaces";
import { describe, expect, it, vi } from "vitest";
import { role } from "../../tests/fixtures/role";
import {
  assignableRoles,
  customRoleScopes,
  extraPermissions,
  GRANTABLE_SCOPES,
  GUEST_SCOPES,
  isImpliedScope,
  neededByLabelKey,
  roleDisplayName,
  roleScopesById,
  roleTemplateScopes,
  sameScopes,
  toggleScope,
} from "./roles";

vi.mock("@/plugins/i18n", () => ({
  $t: (key: string) => `translated:${key}`,
}));

const admin = role({
  role_id: UserRole.ADMIN,
  name: "Administrator",
  scopes: [Scope.ALL],
  builtin: true,
});
const member = role({
  role_id: UserRole.USER,
  name: "User",
  scopes: [...GUEST_SCOPES, Scope.LIBRARY_WRITE],
  builtin: true,
});
const guest = role({
  role_id: UserRole.GUEST,
  name: "Guest",
  scopes: [...GUEST_SCOPES],
  builtin: true,
});
const service = role({
  role_id: UserRole.SERVICE,
  name: "Service",
  scopes: [...GUEST_SCOPES, Scope.USERS_IMPERSONATE],
  builtin: true,
});
const kids = role({ role_id: "kids-id", name: "Kids" });

describe("roleDisplayName", () => {
  it.each([
    [UserRole.ADMIN, "translated:auth.admin_role"],
    [UserRole.USER, "translated:auth.user_role"],
    [UserRole.GUEST, "translated:auth.guest_role"],
    [UserRole.SERVICE, "translated:auth.service_role"],
  ])("translates the builtin role %s by its id", (roleId, name) => {
    // the server names a builtin role in English, which the app translates
    expect(roleDisplayName(roleId, [admin, member, guest, service])).toBe(name);
  });

  it("shows a custom role by the name it was given", () => {
    expect(roleDisplayName("kids-id", [admin, kids])).toBe("Kids");
  });

  it("falls back to the id of a role that is not listed", () => {
    expect(roleDisplayName("unknown-id", [admin, kids])).toBe("unknown-id");
  });
});

describe("assignableRoles", () => {
  const roles = [admin, member, guest, service, kids];

  it("offers every role but the service role, in the listed order", () => {
    expect(assignableRoles(roles)).toEqual([admin, member, guest, kids]);
  });

  it("keeps the service role for the user that holds it", () => {
    expect(assignableRoles(roles, UserRole.SERVICE)).toEqual(roles);
  });
});

describe("roleScopesById", () => {
  it("keys the scopes of each role by its id", () => {
    expect(roleScopesById([admin, kids])).toEqual({
      [UserRole.ADMIN]: [Scope.ALL],
      "kids-id": [],
    });
  });
});

describe("GRANTABLE_SCOPES", () => {
  it("offers exactly the scopes a custom role can be granted", () => {
    expect([...GRANTABLE_SCOPES].sort()).toEqual(
      [
        Scope.LIBRARY_WRITE,
        Scope.CONFIG_PLAYERS_WRITE,
        Scope.CONFIG_PROVIDERS_READ,
        Scope.CONFIG_PROVIDERS_OWN,
        Scope.CONFIG_CORE_READ,
        Scope.USERS_READ,
        Scope.USERS_INVITE,
        Scope.SYSTEM_READ,
      ].sort(),
    );
  });

  it.each([
    Scope.ALL,
    Scope.USERS_MANAGE,
    Scope.USERS_IMPERSONATE,
    Scope.LIBRARY_MANAGE,
    Scope.CONFIG_PROVIDERS_WRITE,
    Scope.CONFIG_CORE_WRITE,
    Scope.SYSTEM_MANAGE,
  ])("leaves %s to the admin role", (scope) => {
    expect(GRANTABLE_SCOPES).not.toContain(scope);
  });

  it("offers none of the guest scopes, which a custom role always holds", () => {
    expect(
      GRANTABLE_SCOPES.filter((scope) => GUEST_SCOPES.includes(scope)),
    ).toEqual([]);
  });
});

describe("customRoleScopes", () => {
  it("always holds the guest scopes", () => {
    expect(customRoleScopes([])).toEqual([...GUEST_SCOPES].sort());
  });

  it.each([
    [Scope.CONFIG_PLAYERS_WRITE, Scope.CONFIG_PLAYERS_READ],
    [Scope.CONFIG_PROVIDERS_OWN, Scope.CONFIG_PROVIDERS_READ],
  ])("holds the scope %s needs", (granted, implied) => {
    expect(customRoleScopes([granted])).toContain(implied);
  });

  it("keeps a scope this app does not know", () => {
    // a newer server may grant a scope the app has no toggle for
    expect(customRoleScopes(["future.scope"])).toContain("future.scope");
  });

  it("lists every scope once, sorted", () => {
    const scopes = customRoleScopes([
      Scope.USERS_READ,
      Scope.LIBRARY_READ,
      Scope.USERS_READ,
    ]);

    expect(scopes).toEqual([...new Set(scopes)].sort());
  });
});

describe("toggleScope", () => {
  const guestScopes = customRoleScopes([]);

  it("turns a scope on along with the scope it needs", () => {
    const scopes = toggleScope(guestScopes, Scope.CONFIG_PROVIDERS_OWN, true);

    expect(scopes).toEqual(
      customRoleScopes([
        Scope.CONFIG_PROVIDERS_OWN,
        Scope.CONFIG_PROVIDERS_READ,
      ]),
    );
  });

  it("turns a scope off", () => {
    const scopes = toggleScope(guestScopes, Scope.USERS_READ, true);

    expect(toggleScope(scopes, Scope.USERS_READ, false)).toEqual(guestScopes);
  });

  it("keeps a scope on while another scope needs it", () => {
    const scopes = toggleScope(guestScopes, Scope.CONFIG_PROVIDERS_OWN, true);

    expect(isImpliedScope(scopes, Scope.CONFIG_PROVIDERS_READ)).toBe(true);
    expect(toggleScope(scopes, Scope.CONFIG_PROVIDERS_READ, false)).toEqual(
      scopes,
    );
  });

  it("leaves the needed scope on, and free, when the scope needing it goes", () => {
    const scopes = toggleScope(
      toggleScope(guestScopes, Scope.CONFIG_PROVIDERS_OWN, true),
      Scope.CONFIG_PROVIDERS_OWN,
      false,
    );

    expect(scopes).toEqual(customRoleScopes([Scope.CONFIG_PROVIDERS_READ]));
    expect(isImpliedScope(scopes, Scope.CONFIG_PROVIDERS_READ)).toBe(false);
  });

  it("never turns a guest scope off", () => {
    expect(toggleScope(guestScopes, Scope.LIBRARY_READ, false)).toEqual(
      guestScopes,
    );
  });
});

describe("isImpliedScope", () => {
  it("is false for a scope no other scope of the role needs", () => {
    expect(
      isImpliedScope(
        customRoleScopes([Scope.LIBRARY_WRITE]),
        Scope.LIBRARY_WRITE,
      ),
    ).toBe(false);
  });
});

describe("roleTemplateScopes", () => {
  it("starts from the scopes of the role that a custom role can hold", () => {
    expect(roleTemplateScopes(service)).toEqual(customRoleScopes([]));
    expect(roleTemplateScopes(member)).toEqual(
      customRoleScopes([Scope.LIBRARY_WRITE]),
    );
  });

  it("starts a copy of the guest role from the guest scopes", () => {
    expect(roleTemplateScopes(guest)).toEqual([...GUEST_SCOPES].sort());
  });
});

describe("sameScopes", () => {
  it("is true for the same scopes in another order", () => {
    expect(
      sameScopes(
        [Scope.LIBRARY_READ, Scope.USERS_READ],
        [Scope.USERS_READ, Scope.LIBRARY_READ],
      ),
    ).toBe(true);
  });

  it.each([
    [[Scope.LIBRARY_READ], [Scope.USERS_READ]],
    [[Scope.LIBRARY_READ], [Scope.LIBRARY_READ, Scope.USERS_READ]],
  ])("is false for different scopes", (a, b) => {
    expect(sameScopes(a, b)).toBe(false);
  });
});

describe("extraPermissions", () => {
  it("lists what a builtin role holds beyond what a custom role can get", () => {
    expect(
      extraPermissions([
        ...GUEST_SCOPES,
        Scope.CONFIG_PLAYERS_WRITE,
        Scope.USERS_READ,
        Scope.USERS_IMPERSONATE,
      ]),
    ).toEqual([
      {
        scope: Scope.USERS_IMPERSONATE,
        labelKey: "auth.permissions.users_impersonate",
      },
    ]);
  });

  it("lists nothing for a custom role", () => {
    expect(extraPermissions(customRoleScopes([Scope.USERS_READ]))).toEqual([]);
  });
});

describe("neededByLabelKey", () => {
  it("names the permission that keeps a scope on", () => {
    const scopes = customRoleScopes([Scope.CONFIG_PROVIDERS_OWN]);

    expect(neededByLabelKey(scopes, Scope.CONFIG_PROVIDERS_READ)).toBe(
      "auth.permissions.config_providers_own",
    );
    expect(
      neededByLabelKey(scopes, Scope.CONFIG_PROVIDERS_OWN),
    ).toBeUndefined();
  });
});
