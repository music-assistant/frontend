import { effectScope, nextTick, ref } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useProviderAccess } from "./useProviderAccess";

const { getAllUsers, getShareCandidates, error } = vi.hoisted(() => ({
  getAllUsers: vi.fn(),
  getShareCandidates: vi.fn(),
  error: vi.fn(),
}));
vi.mock("@/plugins/api", () => ({ api: { getAllUsers, getShareCandidates } }));
vi.mock("@/plugins/store", () => ({ store: { currentUser: null } }));
vi.mock("@/plugins/i18n", () => ({ $t: (key: string) => key }));
vi.mock("vue-sonner", () => ({ toast: { error } }));

const config = { instance_id: "example" } as Parameters<
  ReturnType<typeof useProviderAccess>["openAccessDialog"]
>[0];

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("useProviderAccess", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("retries a failed admin user lookup on reopening, not on every reactive update", async () => {
    const first = deferred<never>();
    const second = deferred<never>();
    getAllUsers
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise);
    const needsUsers = ref(false);
    const scope = effectScope();
    const access = scope.run(() =>
      useProviderAccess({
        managesAllSources: true,
        canOwnSources: true,
        needsUsers,
      }),
    )!;
    try {
      needsUsers.value = true;
      await nextTick();
      expect(getAllUsers).toHaveBeenCalledTimes(1);
      access.openAccessDialog(config);
      expect(getAllUsers).toHaveBeenCalledTimes(1);
      first.reject(new Error("temporary outage"));
      await first.promise.catch(() => {});
      await nextTick();
      expect(error).toHaveBeenCalledTimes(1);
      expect(getAllUsers).toHaveBeenCalledTimes(1);
      access.showAccessDialog.value = false;
      access.openAccessDialog(config);
      expect(getAllUsers).toHaveBeenCalledTimes(2);
      access.openAccessDialog(config);
      expect(getAllUsers).toHaveBeenCalledTimes(2);
      second.resolve([] as never);
      await second.promise;
      await nextTick();
      access.showAccessDialog.value = false;
      access.openAccessDialog(config);
      expect(getAllUsers).toHaveBeenCalledTimes(2);
    } finally {
      scope.stop();
    }
  });

  it("retries failed share candidates for a member on reopening", async () => {
    getShareCandidates.mockRejectedValueOnce(new Error("temporary outage"));
    getShareCandidates.mockResolvedValueOnce([]);
    const scope = effectScope();
    const access = scope.run(() =>
      useProviderAccess({ managesAllSources: false, canOwnSources: true }),
    )!;
    try {
      await nextTick();
      await nextTick();
      expect(getShareCandidates).toHaveBeenCalledTimes(1);
      access.openAccessDialog(config);
      await nextTick();
      expect(getShareCandidates).toHaveBeenCalledTimes(2);
      expect(getAllUsers).not.toHaveBeenCalled();
    } finally {
      scope.stop();
    }
  });
});
