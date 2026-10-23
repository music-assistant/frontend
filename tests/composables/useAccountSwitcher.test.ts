import { beforeEach, describe, expect, it, vi } from "vitest";
import { Scope } from "@/plugins/api/interfaces";
import { user } from "../fixtures/user";

const mocks = vi.hoisted(() => ({
  hasScope: vi.fn(),
  getAllUsers: vi.fn(),
}));

vi.mock("@/plugins/auth", () => ({
  authManager: {
    hasScope: mocks.hasScope,
    getSavedAccounts: () => [],
  },
}));
vi.mock("@/plugins/api", () => ({
  api: { getAllUsers: mocks.getAllUsers },
}));
vi.mock("vue-i18n", () => ({
  useI18n: () => ({ t: (key: string) => key }),
}));

import { useAccountSwitcher } from "@/composables/useAccountSwitcher";

describe("account switcher permissions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getAllUsers.mockResolvedValue([user()]);
  });

  it("lists accounts for a role with users.manage", async () => {
    mocks.hasScope.mockImplementation((scope) => scope === Scope.USERS_MANAGE);
    const switcher = useAccountSwitcher();
    await switcher.loadAccounts();

    expect(mocks.getAllUsers).toHaveBeenCalledOnce();
    expect(switcher.availableAccounts.value).toEqual([
      { user: user(), account: undefined },
    ]);
  });

  it("does not request users when the role lacks users.manage", async () => {
    mocks.hasScope.mockReturnValue(false);
    const switcher = useAccountSwitcher();
    await switcher.loadAccounts();

    expect(mocks.getAllUsers).not.toHaveBeenCalled();
    expect(switcher.availableAccounts.value).toEqual([]);
  });
});
