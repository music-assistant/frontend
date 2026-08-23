/**
 * Tests for the "Migrate playlist" context menu action.
 *
 * The action is only offered on the playlist details page (item === parentItem)
 * for static library playlists, on servers that support the migrate command,
 * and only when at least one eligible destination provider exists.
 */
import {
  getContextMenuItems,
  type ContextMenuItem,
} from "@/layouts/default/ItemContextMenu.vue";
import { ProviderFeature, ProviderType } from "@/plugins/api/interfaces";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { playlist } from "../fixtures/playlist";

const { apiMock, storeMock, mockEventbusEmit } = vi.hoisted(() => ({
  apiMock: {
    providers: {} as Record<string, unknown>,
    getProvider: vi.fn(),
    getLibraryItem: vi.fn(),
    players: {},
    supportsPlaylistMigration: true,
  },
  storeMock: {
    enabledPlugins: new Set<string>(),
  },
  mockEventbusEmit: vi.fn(),
}));

vi.mock("@/plugins/api", () => ({ default: apiMock, api: apiMock }));
vi.mock("@/plugins/store", () => ({ store: storeMock }));
vi.mock("@/plugins/eventbus", () => ({
  eventbus: {
    on: vi.fn(),
    off: vi.fn(),
    emit: mockEventbusEmit,
  },
}));
vi.mock("@/plugins/i18n", () => ({ $t: (key: string) => key }));

const builtinProvider = () => ({
  type: ProviderType.MUSIC,
  domain: "builtin",
  name: "Music Assistant",
  instance_id: "builtin",
  supported_features: [
    ProviderFeature.PLAYLIST_CREATE,
    ProviderFeature.PLAYLIST_TRACKS_EDIT,
  ],
  available: true,
  is_streaming_provider: false,
});

const migrateAction = (items: ContextMenuItem[]): ContextMenuItem | undefined =>
  items.find((x) => x.label === "migrate_playlist.action");

beforeEach(() => {
  vi.clearAllMocks();
  apiMock.providers = { builtin: builtinProvider() };
  apiMock.getProvider.mockImplementation((id: string) => apiMock.providers[id]);
  apiMock.supportsPlaylistMigration = true;
  storeMock.enabledPlugins = new Set();
});

describe("migrate playlist context menu action", () => {
  it("is offered for a static library playlist with an eligible destination", async () => {
    const item = playlist();
    const items = await getContextMenuItems([item], item);
    expect(migrateAction(items)).toBeDefined();
  });

  it("is not offered for a dynamic (smart) playlist", async () => {
    const item = playlist({ is_dynamic: true });
    const items = await getContextMenuItems([item], item);
    expect(migrateAction(items)).toBeUndefined();
  });

  it("is not offered for a non-library playlist", async () => {
    const item = playlist({ provider: "spotify" });
    const items = await getContextMenuItems([item], item);
    expect(migrateAction(items)).toBeUndefined();
  });

  it("is not offered from a menu that isn't the playlist's own details page", async () => {
    const parent = playlist();
    const otherItem = { ...playlist(), item_id: "other" };
    const items = await getContextMenuItems([otherItem], parent);
    expect(migrateAction(items)).toBeUndefined();
  });

  it("is not offered when the server doesn't support playlist migration", async () => {
    apiMock.supportsPlaylistMigration = false;
    const item = playlist();
    const items = await getContextMenuItems([item], item);
    expect(migrateAction(items)).toBeUndefined();
  });

  it("is not offered when there is no eligible destination provider", async () => {
    apiMock.providers = {};
    const item = playlist();
    const items = await getContextMenuItems([item], item);
    expect(migrateAction(items)).toBeUndefined();
  });

  it("emits the migrate playlist dialog event with the playlist when triggered", async () => {
    const item = playlist();
    const items = await getContextMenuItems([item], item);
    const action = migrateAction(items);

    await action?.action?.();

    expect(mockEventbusEmit).toHaveBeenCalledWith("migratePlaylistDialog", {
      playlist: item,
    });
  });
});
