/**
 * A listing leaves the favorite key out of the rows the user has no state on,
 * which must not cost those rows their favorite actions.
 */
import { getContextMenuItems } from "@/layouts/default/ItemContextMenu.vue";
import type { MediaItemTypeOrItemMapping } from "@/plugins/api/interfaces";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { withoutFavorite } from "../fixtures/mediaItem";
import { providerMapping } from "../fixtures/providerMapping";
import { track } from "../fixtures/track";

const { apiMock, storeMock } = vi.hoisted(() => ({
  apiMock: {
    providers: {
      "test_provider--1": { available: true, supported_features: [] },
    } as Record<string, unknown>,
    getProvider: vi.fn(),
    getLibraryItem: vi.fn(),
    addItemToFavorites: vi.fn(),
    removeItemFromFavorites: vi.fn(),
    setFavorite: vi.fn(),
    // the connected server knows dislikes
    supportsPersonalFavorites: true,
    players: {},
  },
  storeMock: {
    activePlayer: undefined,
    activePlayerId: undefined,
    enabledPlugins: new Set<string>(),
  },
}));

vi.mock("@/plugins/api", () => ({ default: apiMock, api: apiMock }));
vi.mock("@/plugins/store", () => ({ store: storeMock }));
// signed in as a member
vi.mock("@/plugins/auth", async () => {
  const { BUILTIN_ROLE_SCOPES, scopeChecker } =
    await import("../fixtures/scopes");
  return {
    authManager: { hasScope: vi.fn(scopeChecker(BUILTIN_ROLE_SCOPES.user)) },
  };
});
vi.mock("@/plugins/eventbus", () => ({
  eventbus: { on: vi.fn(), off: vi.fn(), emit: vi.fn() },
}));
vi.mock("@/plugins/i18n", () => ({ $t: (key: string) => key }));

// a library row as a listing sends it: in the library, with no favorite key
const listedTrack = (item_id: string) =>
  withoutFavorite(
    track({
      item_id,
      provider_mappings: [providerMapping({ in_library: true })],
    }),
  );

async function offeredLabels(
  items: MediaItemTypeOrItemMapping[],
): Promise<string[]> {
  return (await getContextMenuItems(items)).map((item) => item.label);
}

beforeEach(() => {
  vi.clearAllMocks();
  // the menu resolves the library counterpart before building its items
  apiMock.getLibraryItem.mockResolvedValue(null);
});

describe("favorites in the item context menu", () => {
  it("offers both actions on a selection of rows without the key", async () => {
    expect(await offeredLabels([listedTrack("1"), listedTrack("2")])).toEqual(
      expect.arrayContaining(["favorites_add", "favorites_dislike"]),
    );
  });

  it("offers both actions on a row whose library copy is gone", async () => {
    expect(await offeredLabels([listedTrack("1")])).toEqual(
      expect.arrayContaining(["favorites_add", "favorites_dislike"]),
    );
  });

  it("shows the like on the rows it acted on", async () => {
    const items = [listedTrack("1"), listedTrack("2")];

    const menu = await getContextMenuItems(items);
    await menu.find((item) => item.label === "favorites_add")?.action?.();

    expect(apiMock.addItemToFavorites).toHaveBeenCalledTimes(2);
    expect(items.map((item) => item.favorite)).toEqual([true, true]);
  });

  it("shows the dislike on the rows it acted on", async () => {
    const items = [listedTrack("1"), listedTrack("2")];

    const menu = await getContextMenuItems(items);
    await menu.find((item) => item.label === "favorites_dislike")?.action?.();

    expect(apiMock.setFavorite).toHaveBeenCalledTimes(2);
    expect(items.map((item) => item.favorite)).toEqual([false, false]);
  });
});
