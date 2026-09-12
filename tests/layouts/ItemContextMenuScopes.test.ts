/**
 * The item context menu only offers the changes to the library that the role
 * of the user may make.
 */
import { getContextMenuItems } from "@/layouts/default/ItemContextMenu.vue";
import type {
  MediaItemType,
  MediaItemTypeOrItemMapping,
  Scope,
} from "@/plugins/api/interfaces";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { genre } from "../fixtures/genre";
import { playlist } from "../fixtures/playlist";
import { providerMapping } from "../fixtures/providerMapping";
import {
  BUILTIN_ROLE_SCOPES,
  OWN_SOURCES_ROLE_SCOPES,
  scopeChecker,
} from "../fixtures/scopes";
import { track } from "../fixtures/track";

const { apiMock, hasScope, storeMock } = vi.hoisted(() => ({
  apiMock: {
    providers: {
      "test_provider--1": { available: true, supported_features: [] },
    } as Record<string, unknown>,
    getProvider: vi.fn(),
    getLibraryItem: vi.fn(),
    players: {},
  },
  hasScope: vi.fn<(scope: Scope) => boolean>(),
  storeMock: {
    enabledPlugins: new Set<string>(),
  },
}));

vi.mock("@/plugins/api", () => ({ default: apiMock, api: apiMock }));
vi.mock("@/plugins/store", () => ({ store: storeMock }));
vi.mock("@/plugins/auth", () => ({ authManager: { hasScope } }));
vi.mock("@/plugins/eventbus", () => ({
  eventbus: { on: vi.fn(), off: vi.fn(), emit: vi.fn() },
}));
vi.mock("@/plugins/i18n", () => ({ $t: (key: string) => key }));

const LIBRARY_CHANGES = [
  "add_library",
  "remove_library",
  "favorites_add",
  "favorites_remove",
  "add_playlist",
  "remove_playlist",
  "mark_played",
  "mark_unplayed",
];

// a library track listed in a playlist the user may edit
const listedTrack = track({
  provider_mappings: [providerMapping({ in_library: true })],
});
const editablePlaylist = playlist({ item_id: "pl1", is_editable: true });

async function offeredLabels(
  items: MediaItemTypeOrItemMapping[],
  parentItem?: MediaItemType,
): Promise<string[]> {
  return (await getContextMenuItems(items, parentItem)).map(
    (item) => item.label,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("library changes in the item context menu", () => {
  it("are offered to a member", async () => {
    hasScope.mockImplementation(scopeChecker(BUILTIN_ROLE_SCOPES.user));

    expect(await offeredLabels([listedTrack], editablePlaylist)).toEqual(
      expect.arrayContaining([
        "remove_library",
        "favorites_add",
        "add_playlist",
        "remove_playlist",
      ]),
    );
  });

  it.each([
    { role: "a guest", scopes: BUILTIN_ROLE_SCOPES.guest },
    {
      role: "a role that manages only its own music sources",
      scopes: OWN_SOURCES_ROLE_SCOPES,
    },
  ])("are not offered to $role", async ({ scopes }) => {
    hasScope.mockImplementation(scopeChecker(scopes));

    const offered = await offeredLabels([listedTrack], editablePlaylist);

    expect(offered.filter((label) => LIBRARY_CHANGES.includes(label))).toEqual(
      [],
    );
  });
});

describe("genre management in the item context menu", () => {
  const genres = [genre({ item_id: "g1" }), genre({ item_id: "g2" })];

  it("is offered to an admin", async () => {
    hasScope.mockImplementation(scopeChecker(BUILTIN_ROLE_SCOPES.admin));

    expect(await offeredLabels(genres)).toEqual(
      expect.arrayContaining(["merge_into", "delete_genre"]),
    );
  });

  it("is not offered to a member", async () => {
    hasScope.mockImplementation(scopeChecker(BUILTIN_ROLE_SCOPES.user));

    const offered = await offeredLabels(genres);

    expect(offered).not.toContain("merge_into");
    expect(offered).not.toContain("delete_genre");
  });
});
