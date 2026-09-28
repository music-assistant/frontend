import { useProviderAccess } from "@/composables/settings/providers/useProviderAccess";
import type { MusicAssistantApi } from "@/plugins/api";
import {
  type ProviderConfig,
  ProviderSharing,
  ProviderType,
  type User,
  UserRole,
} from "@/plugins/api/interfaces";
import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { defineComponent } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { providerConfig } from "../../../fixtures/providerConfig";
import { user, userSummary } from "../../../fixtures/user";

const { apiMock, i18nMock, storeMock, toastMock } = vi.hoisted(() => ({
  apiMock: {
    getAllUsers: vi.fn<MusicAssistantApi["getAllUsers"]>(),
    getShareCandidates: vi.fn<MusicAssistantApi["getShareCandidates"]>(),
    providerManifests: {} as Record<string, { builtin: boolean }>,
    supportsShareCandidates: true,
  },
  i18nMock: { $t: vi.fn((key: string) => key) },
  storeMock: { currentUser: undefined as User | undefined },
  toastMock: { error: vi.fn() },
}));

vi.mock("@/plugins/api", () => ({ api: apiMock, default: apiMock }));
vi.mock("@/plugins/store", () => ({ store: storeMock }));
vi.mock("@/plugins/i18n", () => i18nMock);
vi.mock("vue-sonner", () => ({ toast: toastMock }));

enableAutoUnmount(afterEach);

// onMounted needs a host component instance to run in
function withComposable<T>(setup: () => T): { result: T; unmount: () => void } {
  let result!: T;
  const wrapper = mount(
    defineComponent({
      setup() {
        result = setup();
        return () => null;
      },
    }),
  );
  return { result, unmount: () => wrapper.unmount() };
}

async function mountAccess(
  overrides: {
    canManageSource?: (item: ProviderConfig) => boolean;
    canOwnSources?: boolean;
    managesAllSources?: boolean;
  } = {},
) {
  const mounted = withComposable(() =>
    useProviderAccess({
      canManageSource: overrides.canManageSource ?? (() => true),
      canOwnSources: () => overrides.canOwnSources ?? true,
      managesAllSources: () => overrides.managesAllSources ?? true,
    }),
  );
  await flushPromises();
  return mounted;
}

beforeEach(() => {
  vi.clearAllMocks();
  apiMock.getAllUsers.mockResolvedValue([]);
  apiMock.getShareCandidates.mockResolvedValue([]);
  apiMock.providerManifests = { spotify: { builtin: false } };
  apiMock.supportsShareCandidates = true;
  storeMock.currentUser = undefined;
});

describe("onMounted", () => {
  it("lists the users for a role that manages all sources", async () => {
    await mountAccess({ managesAllSources: true });

    expect(apiMock.getAllUsers).toHaveBeenCalledOnce();
    expect(apiMock.getShareCandidates).not.toHaveBeenCalled();
  });

  it("lists the share candidates for a role that owns only its own sources", async () => {
    await mountAccess({ canOwnSources: true, managesAllSources: false });

    expect(apiMock.getShareCandidates).toHaveBeenCalledOnce();
    expect(apiMock.getAllUsers).not.toHaveBeenCalled();
  });

  it("asks nothing of the server for a role that may not own sources", async () => {
    await mountAccess({ canOwnSources: false, managesAllSources: false });

    expect(apiMock.getAllUsers).not.toHaveBeenCalled();
    expect(apiMock.getShareCandidates).not.toHaveBeenCalled();
  });

  it("reports a failing user lookup", async () => {
    apiMock.getAllUsers.mockRejectedValue(new Error("no users"));

    await mountAccess({ managesAllSources: true });

    expect(toastMock.error).toHaveBeenCalledWith("auth.users_load_failed");
  });

  it("reports a failing share-candidates lookup", async () => {
    apiMock.getShareCandidates.mockRejectedValue(new Error("refused"));

    await mountAccess({ canOwnSources: true, managesAllSources: false });

    expect(toastMock.error).toHaveBeenCalledWith("auth.users_load_failed");
  });
});

describe("accessShareCandidates", () => {
  it("derives the candidates from the user list for a role that manages all sources", async () => {
    apiMock.getAllUsers.mockResolvedValue([
      user({ enabled: true, role: UserRole.USER, user_id: "user-a" }),
      user({ enabled: true, role: UserRole.GUEST, user_id: "user-guest" }),
      user({ enabled: false, role: UserRole.USER, user_id: "user-off" }),
    ]);
    const { result } = await mountAccess({ managesAllSources: true });

    expect(
      result.accessShareCandidates.value?.map((candidate) => candidate.user_id),
    ).toEqual(["user-a"]);
  });

  it("uses the loaded share candidates for a role that owns only its own sources", async () => {
    apiMock.getShareCandidates.mockResolvedValue([
      userSummary({ user_id: "user-a" }),
      userSummary({ user_id: "user-b" }),
    ]);
    const { result } = await mountAccess({
      canOwnSources: true,
      managesAllSources: false,
    });

    expect(
      result.accessShareCandidates.value?.map((candidate) => candidate.user_id),
    ).toEqual(["user-a", "user-b"]);
  });
});

describe("canConfigureAccess", () => {
  it("is false when the caller may not manage the source", async () => {
    const { result } = await mountAccess({ canManageSource: () => false });
    const config = providerConfig({
      domain: "spotify",
      type: ProviderType.MUSIC,
    });

    expect(result.canConfigureAccess(config)).toBe(false);
  });

  it("is true for a music source with an access-capable manifest", async () => {
    const { result } = await mountAccess({ canManageSource: () => true });
    const config = providerConfig({
      domain: "spotify",
      type: ProviderType.MUSIC,
    });

    expect(result.canConfigureAccess(config)).toBe(true);
  });

  it("is false for a builtin provider", async () => {
    apiMock.providerManifests = { spotify: { builtin: true } };
    const { result } = await mountAccess({ canManageSource: () => true });
    const config = providerConfig({
      domain: "spotify",
      type: ProviderType.MUSIC,
    });

    expect(result.canConfigureAccess(config)).toBe(false);
  });

  it("is false for a source that is not a music source", async () => {
    const { result } = await mountAccess({ canManageSource: () => true });
    const config = providerConfig({
      domain: "spotify",
      type: ProviderType.PLAYER,
    });

    expect(result.canConfigureAccess(config)).toBe(false);
  });
});

describe("accessSummary", () => {
  it("summarizes a source without an access record as a household one open to everyone", async () => {
    const { result } = await mountAccess({ managesAllSources: true });
    const config = providerConfig({ access: null });

    expect(result.accessSummary(config)).toBe(
      "settings.source_access.household · settings.source_access.options.everyone",
    );
  });

  it("names the owner and how many others it is shared with", async () => {
    apiMock.getAllUsers.mockResolvedValue([
      user({ display_name: "Marcel", user_id: "user-marcel" }),
    ]);
    const { result } = await mountAccess({ managesAllSources: true });
    const config = providerConfig({
      access: {
        owner: "user-marcel",
        shared_users: ["user-sam"],
        sharing: ProviderSharing.SELECTED,
      },
    });

    expect(result.accessSummary(config)).toBe(
      "Marcel · settings.source_access.shared_with_count",
    );
  });

  it.each([
    ["private", ProviderSharing.PRIVATE],
    ["shared with nobody selected", ProviderSharing.SELECTED],
  ])(
    "says nobody can use an ownerless source that is %s",
    async (_label, sharing) => {
      const { result } = await mountAccess({ managesAllSources: true });
      const config = providerConfig({
        access: { owner: null, shared_users: [], sharing },
      });

      expect(result.accessSummary(config)).toBe(
        "settings.source_access.nobody",
      );
    },
  );

  it("summarizes a member's own source by the sharing alone, without the owner", async () => {
    storeMock.currentUser = user({ user_id: "user-me" });
    const { result } = await mountAccess({
      canOwnSources: true,
      managesAllSources: false,
    });
    const config = providerConfig({
      access: {
        owner: "user-me",
        shared_users: [],
        sharing: ProviderSharing.PRIVATE,
      },
    });

    expect(result.accessSummary(config)).toBe(
      "settings.source_access.options.private",
    );
  });

  it("shows an owner that is no longer a known user by its raw id", async () => {
    apiMock.getAllUsers.mockResolvedValue([]);
    const { result } = await mountAccess({ managesAllSources: true });
    const config = providerConfig({
      access: {
        owner: "user-gone",
        shared_users: [],
        sharing: ProviderSharing.PRIVATE,
      },
    });

    expect(result.accessSummary(config)).toBe(
      "user-gone · settings.source_access.options.not_shared",
    );
  });
});

describe("openAccessDialog", () => {
  it("opens the dialog for the given source", async () => {
    const { result } = await mountAccess();
    const config = providerConfig({ instance_id: "spotify--1" });

    result.openAccessDialog(config);

    // ref() wraps an object in a reactive proxy, so it no longer `===` the original
    expect(result.accessDialogConfig.value).toEqual(config);
    expect(result.showAccessDialog.value).toBe(true);
  });
});
