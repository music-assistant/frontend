import PlaylistAccessSummary from "@/components/PlaylistAccessSummary.vue";
import {
  type PlaylistAccess,
  ProviderSharing,
  type Scope,
  type User,
  type UserSummary,
} from "@/plugins/api/interfaces";
import { flushPromises, mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { playlist } from "../fixtures/playlist";
import { providerMapping } from "../fixtures/providerMapping";
import { BUILTIN_ROLE_SCOPES, scopeChecker } from "../fixtures/scopes";
import { user } from "../fixtures/user";

const { apiMock, authMock, storeMock } = vi.hoisted(() => ({
  apiMock: {
    getShareCandidates: vi.fn(),
  },
  authMock: {
    hasScope: vi.fn<(scope: Scope) => boolean>(),
  },
  storeMock: {
    currentUser: undefined as User | undefined,
  },
}));

vi.mock("@/plugins/api", () => ({ api: apiMock, default: apiMock }));
vi.mock("@/plugins/auth", () => ({ authManager: authMock }));
vi.mock("@/plugins/store", () => ({ store: storeMock }));
vi.mock("@/plugins/i18n", () => ({ $t: (key: string) => key }));

const members: UserSummary[] = [
  {
    user_id: "other",
    username: "other",
    display_name: "Other Member",
    avatar_url: null,
  },
];

const access = (overrides: Partial<PlaylistAccess> = {}): PlaylistAccess => ({
  owner: "me",
  sharing: ProviderSharing.PRIVATE,
  shared_users: [],
  collaborative: false,
  ...overrides,
});

const mountSummary = async (item: PlaylistAccess | null) => {
  const wrapper = mount(PlaylistAccessSummary, {
    props: {
      playlist: playlist({
        provider_mappings: [providerMapping({ provider_domain: "builtin" })],
        access: item,
      }),
    },
  });
  await flushPromises();
  return wrapper;
};

beforeEach(() => {
  vi.clearAllMocks();
  // a member, who does not manage the library
  authMock.hasScope.mockImplementation(scopeChecker(BUILTIN_ROLE_SCOPES.user));
  storeMock.currentUser = user({ user_id: "me" });
  apiMock.getShareCandidates.mockResolvedValue(members);
});

describe("PlaylistAccessSummary", () => {
  it("reads a playlist without a record as shared with everyone", async () => {
    const wrapper = await mountSummary(null);

    expect(wrapper.text()).toBe(
      "playlist_access.shared · settings.source_access.options.everyone",
    );
    expect(apiMock.getShareCandidates).not.toHaveBeenCalled();
  });

  it("calls the user's own playlist personal", async () => {
    const wrapper = await mountSummary(access());

    expect(wrapper.text()).toBe(
      "playlist_access.personal · settings.source_access.options.private",
    );
    expect(apiMock.getShareCandidates).not.toHaveBeenCalled();
  });

  it("names another owner to a library manager", async () => {
    authMock.hasScope.mockImplementation(
      scopeChecker(BUILTIN_ROLE_SCOPES.admin),
    );
    const wrapper = await mountSummary(
      access({
        owner: "other",
        sharing: ProviderSharing.SELECTED,
        shared_users: ["me"],
      }),
    );

    expect(wrapper.text()).toBe(
      "Other Member · settings.source_access.shared_with_count",
    );
  });

  it("calls another member's playlist shared and flags it collaborative", async () => {
    const wrapper = await mountSummary(
      access({
        owner: "other",
        sharing: ProviderSharing.MEMBERS,
        collaborative: true,
      }),
    );

    expect(wrapper.text()).toBe(
      "playlist_access.shared · settings.source_access.options.members · playlist_access.collaborative",
    );
    expect(apiMock.getShareCandidates).not.toHaveBeenCalled();
  });
});
