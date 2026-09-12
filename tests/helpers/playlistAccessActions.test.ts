/**
 * Tests for the context menu actions that depend on who may manage a playlist.
 *
 * Sharing is offered for a single Music Assistant playlist to its owner and to
 * a library manager, from a listing as well as from the details page; editing
 * and removing a personal playlist are offered to them only.
 */
import {
  getContextMenuItems,
  type ContextMenuItem,
} from "@/layouts/default/ItemContextMenu.vue";
import {
  type ItemMapping,
  MediaType,
  ProviderFeature,
  ProviderSharing,
  ProviderType,
  type User,
} from "@/plugins/api/interfaces";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { playlist } from "../fixtures/playlist";
import { providerMapping } from "../fixtures/providerMapping";
import { user } from "../fixtures/user";

const { apiMock, authMock, storeMock, mockEventbusEmit } = vi.hoisted(() => ({
  apiMock: {
    providers: {} as Record<string, unknown>,
    getProvider: vi.fn(),
    getLibraryItem: vi.fn(),
    players: {},
  },
  authMock: {
    hasScope: vi.fn<() => boolean>(),
  },
  storeMock: {
    currentUser: undefined as User | undefined,
    enabledPlugins: new Set<string>(),
  },
  mockEventbusEmit: vi.fn(),
}));

vi.mock("@/plugins/api", () => ({ default: apiMock, api: apiMock }));
vi.mock("@/plugins/auth", () => ({ authManager: authMock }));
vi.mock("@/plugins/store", () => ({ store: storeMock }));
vi.mock("@/plugins/eventbus", () => ({
  eventbus: {
    on: vi.fn(),
    off: vi.fn(),
    emit: mockEventbusEmit,
  },
}));
vi.mock("@/plugins/i18n", () => ({ $t: (key: string) => key }));

const maPlaylist = (owner: string) =>
  playlist({
    is_editable: true,
    provider_mappings: [
      providerMapping({ provider_domain: "builtin", in_library: true }),
    ],
    access: {
      owner,
      sharing: ProviderSharing.PRIVATE,
      shared_users: [],
      collaborative: false,
    },
  });

const shareAction = (items: ContextMenuItem[]): ContextMenuItem | undefined =>
  items.find((x) => x.label === "share_playlist");

beforeEach(() => {
  vi.clearAllMocks();
  authMock.hasScope.mockReturnValue(false);
  storeMock.currentUser = user({ user_id: "me" });
  apiMock.providers = {
    builtin: {
      type: ProviderType.MUSIC,
      domain: "builtin",
      instance_id: "builtin",
      supported_features: [],
      available: true,
    },
  };
  apiMock.getProvider.mockImplementation((id: string) => apiMock.providers[id]);
});

describe("share playlist context menu action", () => {
  it("is offered to the owner from a listing and opens the dialog", async () => {
    const item = maPlaylist("me");
    const items = await getContextMenuItems([item]);

    shareAction(items)?.action?.();

    expect(mockEventbusEmit).toHaveBeenCalledWith("playlistAccessDialog", {
      playlist: item,
    });
  });

  it("is offered to a library manager for another member's playlist", async () => {
    authMock.hasScope.mockReturnValue(true);
    const items = await getContextMenuItems([maPlaylist("other")]);

    expect(shareAction(items)).toBeDefined();
  });

  it("is not offered to another member", async () => {
    const items = await getContextMenuItems([maPlaylist("other")]);

    expect(shareAction(items)).toBeUndefined();
  });

  it("is not offered for a playlist of a music source", async () => {
    authMock.hasScope.mockReturnValue(true);
    const item = playlist({
      provider_mappings: [providerMapping({ provider_domain: "spotify" })],
    });
    const items = await getContextMenuItems([item]);

    expect(shareAction(items)).toBeUndefined();
  });

  it("leaves a playlist mapping without provider mappings alone", async () => {
    authMock.hasScope.mockReturnValue(true);
    const mapping = {
      item_id: "1",
      provider: "library",
      name: "Playlist",
      media_type: MediaType.PLAYLIST,
      uri: "library://playlist/1",
      available: true,
    } as unknown as ItemMapping;
    const items = await getContextMenuItems([mapping]);

    expect(shareAction(items)).toBeUndefined();
  });
});

describe("edit and remove for a personal playlist", () => {
  const labels = (items: ContextMenuItem[]) => items.map((x) => x.label);

  beforeEach(() => {
    apiMock.providers.builtin = {
      ...(apiMock.providers.builtin as object),
      supported_features: [ProviderFeature.LIBRARY_PLAYLISTS_EDIT],
    };
  });

  it("are offered to the owner on the details page", async () => {
    const item = maPlaylist("me");
    const labels_ = labels(await getContextMenuItems([item], item));

    expect(labels_).toContain("edit_playlist");
    expect(labels_).toContain("remove_library");
  });

  it("is not offered for a selection that includes another member's playlist", async () => {
    const labels_ = labels(
      await getContextMenuItems([maPlaylist("me"), maPlaylist("other")]),
    );

    expect(labels_).not.toContain("remove_library");
  });

  it("are not offered to another member it is shared with", async () => {
    const item = maPlaylist("other");
    const labels_ = labels(await getContextMenuItems([item], item));

    expect(labels_).not.toContain("edit_playlist");
    expect(labels_).not.toContain("remove_library");
  });
});
