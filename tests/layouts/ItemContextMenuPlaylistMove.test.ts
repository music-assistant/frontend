/**
 * Tests for the context menu actions that move playlist items to the
 * playlist's top or bottom. They are offered for items of a playlist the user
 * may edit, on a provider that can store a new order, and save the move
 * straight away.
 */
import { sendPlaylistEdit } from "@/composables/usePlaylistTrackReorder";
import { getContextMenuItems } from "@/layouts/default/ItemContextMenu.vue";
import {
  EventType,
  ProviderFeature,
  ProviderType,
  TaskStatus,
  type BackgroundTask,
  type Scope,
  type User,
} from "@/plugins/api/interfaces";
import { flushPromises } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { playlist } from "../fixtures/playlist";
import { providerMapping } from "../fixtures/providerMapping";
import { BUILTIN_ROLE_SCOPES, scopeChecker } from "../fixtures/scopes";
import { track } from "../fixtures/track";
import { user } from "../fixtures/user";

const { apiMock, authMock, storeMock, mockEventbusEmit, toastMock } =
  vi.hoisted(() => ({
    apiMock: {
      providers: {} as Record<string, unknown>,
      getProvider: vi.fn(),
      getLibraryItem: vi.fn(),
      movePlaylistTracks: vi.fn(),
      removePlaylistTracks: vi.fn(),
      subscribe: vi.fn(),
      getTasks: vi.fn(),
      players: {},
      state: { value: "initialized" },
    },
    toastMock: { success: vi.fn(), error: vi.fn() },
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
vi.mock("vue-sonner", () => ({ toast: toastMock }));

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

// the playlist edits offered for a track, and whether each can be used now
const EDIT_LABELS = ["remove_playlist", ...MOVE_LABELS];
const editStates = async () =>
  Object.fromEntries(
    (await getContextMenuItems([track({ position: 2 })], parent))
      .filter((item) => EDIT_LABELS.includes(item.label))
      .map((item) => [item.label, item.disabled !== true]),
  );
const ALL_ENABLED = Object.fromEntries(EDIT_LABELS.map((l) => [l, true]));
const ALL_DISABLED = Object.fromEntries(EDIT_LABELS.map((l) => [l, false]));

beforeEach(() => {
  vi.clearAllMocks();
  apiMock.getLibraryItem.mockResolvedValue(null);
  authMock.hasScope.mockImplementation(scopeChecker(BUILTIN_ROLE_SCOPES.user));
  storeMock.currentUser = user({ user_id: "me" });
  apiMock.state.value = "initialized";
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
    await flushPromises();
    expect(toastMock.success).toHaveBeenCalledWith("playlist_moved_to_top");
  });

  it("reports nothing as moved when the move fails", async () => {
    apiMock.movePlaylistTracks.mockRejectedValueOnce(new Error("busy"));
    const menu = await getContextMenuItems([track({ position: 2 })], parent);

    menu.find((item) => item.label === "playlist_move_to_bottom")?.action?.();
    await flushPromises();

    expect(toastMock.success).not.toHaveBeenCalled();
  });

  it("leaves the end of the playlist for the server to find", async () => {
    const items = [track({ position: 5 }), track({ position: 2 })];
    const menu = await getContextMenuItems(items, parent);

    menu.find((item) => item.label === "playlist_move_to_bottom")?.action?.();

    expect(apiMock.movePlaylistTracks).toHaveBeenCalledWith("42", [5, 2]);
    expect(mockEventbusEmit).toHaveBeenCalledWith("clearSelection");
    await flushPromises();
    expect(toastMock.success).toHaveBeenCalledWith("playlist_moved_to_bottom");
  });

  it("holds the playlist's edits until a removal's task has ended", async () => {
    let report: (event: { data: BackgroundTask[] }) => void = () => {};
    apiMock.subscribe.mockImplementation((event, callback) => {
      if (event === EventType.TASKS_UPDATED) report = callback;
      return vi.fn();
    });
    const task = { id: "t1", status: TaskStatus.PENDING } as BackgroundTask;
    apiMock.removePlaylistTracks.mockResolvedValue(task);
    const menu = await getContextMenuItems([track({ position: 2 })], parent);

    menu.find((item) => item.label === "remove_playlist")?.action?.();
    await flushPromises();

    expect(apiMock.removePlaylistTracks).toHaveBeenCalledWith("42", [2]);
    // tracks taking the removed ones' places would stay selected
    expect(mockEventbusEmit).toHaveBeenCalledWith("clearSelection");
    expect(await editStates()).toEqual(ALL_DISABLED);
    report({ data: [{ ...task, status: TaskStatus.RUNNING }] });
    await flushPromises();
    expect(await editStates()).toEqual(ALL_DISABLED);
    report({ data: [{ ...task, status: TaskStatus.SUCCESS }] });
    await flushPromises();
    expect(await editStates()).toEqual(ALL_ENABLED);
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

  it("disables the playlist's edits while another edit of it saves", async () => {
    expect(await editStates()).toEqual(ALL_ENABLED);
    let finishMove = () => {};
    const sent = sendPlaylistEdit(
      "42",
      () => new Promise<void>((resolve) => (finishMove = resolve)),
    );

    expect(await editStates()).toEqual(ALL_DISABLED);
    finishMove();
    await sent;
    expect(await editStates()).toEqual(ALL_ENABLED);
  });

  it("offers no edits of the playlist while reconnecting", async () => {
    const items = [track({ position: 2 })];
    const menu = await getContextMenuItems(items, parent);
    apiMock.state.value = "reconnecting";

    // a menu opened before the connection dropped keeps the selection
    menu.find((item) => item.label === "playlist_move_to_top")?.action?.();
    expect(apiMock.movePlaylistTracks).not.toHaveBeenCalled();
    expect(mockEventbusEmit).not.toHaveBeenCalledWith("clearSelection");

    expect(await editStates()).toEqual(ALL_DISABLED);
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
