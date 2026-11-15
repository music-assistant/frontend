/**
 * A listing leaves the favorite key out of the rows the user has no state on,
 * which must not cost those rows their favorite actions.
 */
import { getContextMenuItems } from "@/layouts/default/ItemContextMenu.vue";
import {
  MediaType,
  type MediaItemTypeOrItemMapping,
  type Track,
} from "@/plugins/api/interfaces";
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

// a library row as a listing sends it: in the library, with no favorite key.
// The mapping carries the row's own id, so an api call names the row it acted on.
const listedTrack = (item_id: string) =>
  withoutFavorite(
    track({
      item_id,
      provider_mappings: [
        providerMapping({ item_id: `item-${item_id}`, in_library: true }),
      ],
    }),
  );

// the same row, with a state of its own
const listedTrackWithState = (item_id: string, favorite: boolean): Track => ({
  ...listedTrack(item_id),
  favorite,
});

/** The identity an add or dislike command gets for a library row. */
const commandUri = (item_id: string) =>
  `test_provider--1://track/item-${item_id}`;

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

  // a like is still a state to replace, so the dislike stays on offer
  it("offers the dislike on a selection that is all liked", async () => {
    const items = [
      listedTrackWithState("1", true),
      listedTrackWithState("2", true),
    ];

    const menu = await getContextMenuItems(items);
    expect(menu.map((entry) => entry.label)).not.toContain(
      "favorites_dislike_remove",
    );
    await menu.find((entry) => entry.label === "favorites_dislike")?.action?.();

    expect(apiMock.setFavorite).toHaveBeenCalledTimes(2);
    expect(items.map((item) => item.favorite)).toEqual([false, false]);
  });

  it("only clears the dislike on a selection that is all disliked", async () => {
    const items = [
      listedTrackWithState("1", false),
      listedTrackWithState("2", false),
    ];

    const menu = await getContextMenuItems(items);
    expect(menu.map((entry) => entry.label)).not.toContain("favorites_dislike");
    await menu
      .find((entry) => entry.label === "favorites_dislike_remove")
      ?.action?.();

    expect(apiMock.removeItemFromFavorites).toHaveBeenCalledTimes(2);
    expect(items.map((item) => item.favorite)).toEqual([null, null]);
  });

  // a mixed selection offers both, each acting only on the rows it applies to
  it("dislikes only the rows that are not disliked yet", async () => {
    const items = [
      listedTrackWithState("1", false),
      listedTrackWithState("2", true),
    ];

    const menu = await getContextMenuItems(items);
    await menu.find((entry) => entry.label === "favorites_dislike")?.action?.();

    expect(apiMock.setFavorite).toHaveBeenCalledTimes(1);
    expect(apiMock.setFavorite).toHaveBeenCalledWith(commandUri("2"), false);
    expect(items.map((item) => item.favorite)).toEqual([false, false]);
  });

  it("clears the dislike only on the rows that hold one", async () => {
    const items = [
      listedTrackWithState("1", false),
      listedTrackWithState("2", true),
    ];

    const menu = await getContextMenuItems(items);
    await menu
      .find((entry) => entry.label === "favorites_dislike_remove")
      ?.action?.();

    expect(apiMock.removeItemFromFavorites).toHaveBeenCalledTimes(1);
    expect(apiMock.removeItemFromFavorites).toHaveBeenCalledWith(
      MediaType.TRACK,
      "1",
    );
    expect(items.map((item) => item.favorite)).toEqual([null, true]);
  });

  // a dislike can have all its provider mappings out of the library (the
  // backend only keeps rows for relatives of saved items), which must not
  // read as no state
  it("offers 'remove dislike' for a disliked item outside the library", async () => {
    apiMock.getLibraryItem.mockResolvedValue(
      track({
        item_id: "1",
        favorite: false,
        provider_mappings: [providerMapping({ in_library: false })],
      }),
    );

    const labels = await offeredLabels([listedTrack("1")]);

    expect(labels).toContain("favorites_dislike_remove");
    expect(labels).not.toContain("favorites_dislike");
  });
});
