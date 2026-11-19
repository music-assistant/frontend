import { useStorageInfo } from "@/composables/useStorageInfo";
import type { MusicAssistantApi } from "@/plugins/api";
import type { Scope } from "@/plugins/api/interfaces";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { BUILTIN_ROLE_SCOPES, scopeChecker } from "../fixtures/scopes";
import { storageInfo } from "../fixtures/storage";

const { apiMock, hasScopeMock } = vi.hoisted(() => ({
  apiMock: { getStorageInfo: vi.fn<MusicAssistantApi["getStorageInfo"]>() },
  hasScopeMock: vi.fn<(scope: Scope) => boolean>(),
}));

vi.mock("@/plugins/api", () => ({ api: apiMock, default: apiMock }));
vi.mock("@/plugins/auth", () => ({ authManager: { hasScope: hasScopeMock } }));
vi.mock("@/plugins/i18n", () => ({ $t: (key: string) => key }));
vi.mock("vue-sonner", () => ({ toast: { error: vi.fn() } }));

beforeEach(() => {
  vi.clearAllMocks();
  hasScopeMock.mockImplementation(scopeChecker(BUILTIN_ROLE_SCOPES.admin));
});

describe("useStorageInfo", () => {
  it("lets an administrator add what the server can add", async () => {
    apiMock.getStorageInfo.mockResolvedValue(
      storageInfo({ can_add_local_folder: true }),
    );
    const storage = useStorageInfo();

    // nothing can be added before the server said what it supports
    expect(storage.canAddShare.value).toBe(false);
    expect(storage.canAddFolder.value).toBe(false);
    await storage.refresh();

    expect(storage.canManageStorage.value).toBe(true);
    expect(storage.canAddShare.value).toBe(true);
    expect(storage.canAddFolder.value).toBe(true);
  });

  it("adds no share where the server can mount no share type", async () => {
    apiMock.getStorageInfo.mockResolvedValue(
      storageInfo({ can_mount_shares: true, supported_share_types: [] }),
    );
    const storage = useStorageInfo();
    await storage.refresh();

    expect(storage.canAddShare.value).toBe(false);
    expect(storage.canAddFolder.value).toBe(false);
  });

  it("lets a user who does not manage the storage add nothing", async () => {
    hasScopeMock.mockImplementation(scopeChecker(BUILTIN_ROLE_SCOPES.user));
    apiMock.getStorageInfo.mockResolvedValue(
      storageInfo({ can_add_local_folder: true }),
    );
    const storage = useStorageInfo();
    await storage.refresh();

    expect(storage.canManageStorage.value).toBe(false);
    expect(storage.canAddShare.value).toBe(false);
    expect(storage.canAddFolder.value).toBe(false);
  });
});
