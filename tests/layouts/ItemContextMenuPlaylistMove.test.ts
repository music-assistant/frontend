/**
 * Tests for the context menu actions that move playlist items to the
 * playlist's top or bottom. They are offered for items of a playlist the user
 * may edit, on a provider that can store a new order, and save the move
 * straight away.
 */
import { sendPlaylistEdit } from "@/composables/usePlaylistTrackReorder";
import { getContextMenuItems } from "@/layouts/default/ItemContextMenu.vue";
import {
  ProviderFeature,
  ProviderType,
  type Scope,
  type User,
} from "@/plugins/api/interfaces";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { playlist } from "../fixtures/playlist";
import { providerMapping } from "../fixtures/providerMapping";
import { BUILTIN_ROLE_SCOPES, scopeChecker } from "../fixtures/scopes";
import { track } from "../fixtures/track";
import { user } from "../fixtures/user";

const { apiMock, authMock, storeMock, mockEventbusEmit } = vi.hoisted(() => ({
  apiMock: {
    providers: {} as Record<string, unknown>,
    getProvider: vi.fn(),
    getLibraryItem: vi.fn(),
    movePlaylistTracks: vi.fn(),
    players: {},
    state: { value: "initialized" },
  },
  authMock: {
    hasScope: vi.fn<(scope: Scope) => boolean>(),
  },
  storeMock: {
    currentUser: undefined as User | undefined,
    enabledPlugins: new Set<string>(),
  },
  mockEventbusEmit: vi.fn(),
}));

vi.mock("@/plugins/api", () => ({
  default: apiMock,
  api: apiMock,
  ConnectionState: { INITIALIZED: "initialized" },
}));
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

const MOVE_LABELS = ["playlist_move_to_top", "playlist_move_to_bottom"];

const parent = playlist({
  item_id: "42",
  is_editable: true,
  provider_mappings: [
    providerMapping({
      provider_domain: "builtin",
      provider_instance: "builtin",
      in_library: true,
    }),
  ],
});

const setMoveSupport = (supported: boolean) => {
  apiMock.providers = {
    builtin: {
      type: ProviderType.MUSIC,
      domain: "builtin",
      instance_id: "builtin",
      supported_features: supported
        ? [
            ProviderFeature.PLAYLIST_TRACKS_EDIT,
            ProviderFeature.PLAYLIST_TRACKS_MOVE,
          ]
        : [ProviderFeature.PLAYLIST_TRACKS_EDIT],
      available: true,
    },
  };
};

const moveLabels = async (items = [track({ position: 2 })]) =>
  (await getContextMenuItems(items, parent))
    .map((item) => item.label)
    .filter((label) => MOVE_LABELS.includes(label));

beforeEach(() => {
  vi.clearAllMocks();
  apiMock.getLibraryItem.mockResolvedValue(null);
  authMock.hasScope.mockImplementation(scopeChecker(BUILTIN_ROLE_SCOPES.user));
  storeMock.currentUser = user({ user_id: "me" });
  setMoveSupport(true);
  apiMock.getProvider.mockImplementation((id: string) => apiMock.providers[id]);
});

describe("move playlist items context menu actions", () => {
  it("offers moving to the top and the bottom", async () => {
    expect(await moveLabels()).toEqual(MOVE_LABELS);
  });

  it("moves the selected positions to the top", async () => {
    const items = [track({ position: 5 }), track({ position: 2 })];
    const menu = await getContextMenuItems(items, parent);

    menu.find((item) => item.label === "playlist_move_to_top")?.action?.();

    expect(apiMock.movePlaylistTracks).toHaveBeenCalledWith("42", [5, 2], 1);
    expect(mockEventbusEmit).toHaveBeenCalledWith("clearSelection");
  });

  it("leaves the end of the playlist for the server to find", async () => {
    const items = [track({ position: 5 }), track({ position: 2 })];
    const menu = await getContextMenuItems(items, parent);

    menu.find((item) => item.label === "playlist_move_to_bottom")?.action?.();

    expect(apiMock.movePlaylistTracks).toHaveBeenCalledWith("42", [5, 2]);
    expect(mockEventbusEmit).toHaveBeenCalledWith("clearSelection");
  });

  it("is not offered on a provider that cannot reorder", async () => {
    setMoveSupport(false);

    expect(await moveLabels()).toEqual([]);
  });

  it("is not offered to a user who may not change the library", async () => {
    authMock.hasScope.mockImplementation(
      scopeChecker(BUILTIN_ROLE_SCOPES.guest),
    );

    expect(await moveLabels()).toEqual([]);
  });

  it("is not offered for items without a playlist position", async () => {
    expect(await moveLabels([track()])).toEqual([]);
  });

  it("does not offer the top to items already there", async () => {
    const items = [track({ position: 2 }), track({ position: 1 })];

    expect(await moveLabels(items)).toEqual(["playlist_move_to_bottom"]);
  });

  it("is not offered while another move of the playlist saves", async () => {
    let finishMove = () => {};
    const sent = sendPlaylistEdit(
      "42",
      () => new Promise<void>((resolve) => (finishMove = resolve)),
    );

    expect(await moveLabels()).toEqual([]);
    finishMove();
    await sent;
    expect(await moveLabels()).toEqual(MOVE_LABELS);
  });

  it("holds back removing tracks while another edit of the playlist saves", async () => {
    const removeOffered = async () =>
      (await getContextMenuItems([track({ position: 2 })], parent)).some(
        (item) => item.label === "remove_playlist",
      );
    expect(await removeOffered()).toBe(true);
    let finishMove = () => {};
    const sent = sendPlaylistEdit(
      "42",
      () => new Promise<void>((resolve) => (finishMove = resolve)),
    );

    expect(await removeOffered()).toBe(false);
    finishMove();
    await sent;
  });

  it("is not offered on a dynamic playlist", async () => {
    const dynamic = { ...parent, is_dynamic: true };
    const labels = (
      await getContextMenuItems([track({ position: 2 })], dynamic)
    )
      .map((item) => item.label)
      .filter((label) => MOVE_LABELS.includes(label));

    expect(labels).toEqual([]);
  });
});
