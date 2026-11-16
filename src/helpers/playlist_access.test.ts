import {
  MediaType,
  type PlaylistAccess,
  ProviderSharing,
  UserRole,
} from "@/plugins/api/interfaces";
import { describe, expect, it } from "vitest";
import { playlist } from "../../tests/fixtures/playlist";
import { providerMapping } from "../../tests/fixtures/providerMapping";
import { track } from "../../tests/fixtures/track";
import { user } from "../../tests/fixtures/user";
import {
  canAddToPlaylist,
  canEditPlaylistItems,
  canManagePlaylist,
  canReorderPlaylistItems,
  canSharePlaylist,
  getPlaylistSharingHintTranslationKey,
  isMusicAssistantPlaylist,
} from "./playlist_access";

const owner = user({ user_id: "owner" });
const member = user({ user_id: "member" });
const guest = user({ user_id: "guest", role: UserRole.GUEST });

const access = (overrides: Partial<PlaylistAccess> = {}): PlaylistAccess => ({
  owner: "owner",
  sharing: ProviderSharing.PRIVATE,
  shared_users: [],
  collaborative: false,
  ...overrides,
});

const maPlaylist = (overrides = {}) =>
  playlist({
    is_editable: true,
    provider_mappings: [providerMapping({ provider_domain: "builtin" })],
    ...overrides,
  });

const spotifyPlaylist = (overrides = {}) =>
  playlist({
    is_editable: true,
    provider_mappings: [providerMapping({ provider_domain: "spotify" })],
    ...overrides,
  });

describe("getPlaylistSharingHintTranslationKey", () => {
  it.each(Object.values(ProviderSharing))(
    "explains sharing %s for a playlist with an owner",
    (sharing) => {
      expect(getPlaylistSharingHintTranslationKey(access({ sharing }))).toBe(
        `playlist_access.hints.${sharing}`,
      );
    },
  );

  it("explains that only the selected members can see a playlist without an owner", () => {
    expect(
      getPlaylistSharingHintTranslationKey(
        access({
          owner: null,
          sharing: ProviderSharing.SELECTED,
          shared_users: ["member"],
        }),
      ),
    ).toBe("playlist_access.hints.selected_no_owner");
  });

  it("explains that nobody can see a playlist without an owner shared with nobody selected", () => {
    expect(
      getPlaylistSharingHintTranslationKey(
        access({
          owner: null,
          sharing: ProviderSharing.SELECTED,
          shared_users: [],
        }),
      ),
    ).toBe("playlist_access.hints.nobody");
  });

  it.each([ProviderSharing.MEMBERS, ProviderSharing.EVERYONE])(
    "still explains sharing %s for a playlist without an owner",
    (sharing) => {
      expect(
        getPlaylistSharingHintTranslationKey(access({ owner: null, sharing })),
      ).toBe(`playlist_access.hints.${sharing}`);
    },
  );
});

describe("isMusicAssistantPlaylist", () => {
  it("is true for a playlist of the builtin provider", () => {
    expect(isMusicAssistantPlaylist(maPlaylist())).toBe(true);
  });

  it("is false for a playlist of a music source", () => {
    expect(isMusicAssistantPlaylist(spotifyPlaylist())).toBe(false);
  });
});

describe("canSharePlaylist", () => {
  it("lets a library manager share any Music Assistant playlist", () => {
    expect(canSharePlaylist(maPlaylist(), member, true)).toBe(true);
  });

  it("lets the owner share its own playlist", () => {
    const item = maPlaylist({ access: access() });

    expect(canSharePlaylist(item, owner, false)).toBe(true);
  });

  it("does not let another member share it", () => {
    const item = maPlaylist({ access: access() });

    expect(canSharePlaylist(item, member, false)).toBe(false);
  });

  it("does not share a playlist of a music source", () => {
    expect(canSharePlaylist(spotifyPlaylist(), member, true)).toBe(false);
  });
});

describe("canManagePlaylist", () => {
  it("lets everyone manage a playlist without a record", () => {
    expect(canManagePlaylist(maPlaylist(), guest, false)).toBe(true);
  });

  it("lets the owner and a library manager manage a personal playlist", () => {
    const item = maPlaylist({ access: access() });

    expect(canManagePlaylist(item, owner, false)).toBe(true);
    expect(canManagePlaylist(item, member, true)).toBe(true);
  });

  it("does not let another member, or nobody, manage it", () => {
    const item = maPlaylist({
      access: access({ sharing: ProviderSharing.MEMBERS, collaborative: true }),
    });

    expect(canManagePlaylist(item, member, false)).toBe(false);
    expect(canManagePlaylist(item, undefined, false)).toBe(false);
  });
});

describe("canEditPlaylistItems", () => {
  it("lets everyone edit a playlist without a record", () => {
    expect(canEditPlaylistItems(maPlaylist(), guest, false)).toBe(true);
  });

  it("never edits a playlist that is not editable", () => {
    expect(
      canEditPlaylistItems(maPlaylist({ is_editable: false }), owner, true),
    ).toBe(false);
  });

  it("denies a playlist with a record without a signed-in user", () => {
    expect(
      canEditPlaylistItems(maPlaylist({ access: access() }), undefined, false),
    ).toBe(false);
  });

  it("lets the owner edit its own playlist", () => {
    expect(
      canEditPlaylistItems(maPlaylist({ access: access() }), owner, false),
    ).toBe(true);
  });

  it("lets a library manager edit it", () => {
    expect(
      canEditPlaylistItems(maPlaylist({ access: access() }), member, true),
    ).toBe(true);
  });

  it("lets a member it is shared with edit it while collaborative", () => {
    const item = maPlaylist({
      access: access({
        sharing: ProviderSharing.SELECTED,
        shared_users: ["member"],
        collaborative: true,
      }),
    });

    expect(canEditPlaylistItems(item, member, false)).toBe(true);
    expect(canEditPlaylistItems(item, user({ user_id: "other" }), false)).toBe(
      false,
    );
  });

  it("does not let a member it is shared with edit it otherwise", () => {
    const item = maPlaylist({
      access: access({
        sharing: ProviderSharing.SELECTED,
        shared_users: ["member"],
      }),
    });

    expect(canEditPlaylistItems(item, member, false)).toBe(false);
  });
});

describe("canReorderPlaylistItems", () => {
  const movable = (instance: string) => instance === "tidal--1";
  const tidalPlaylist = (overrides = {}) =>
    playlist({
      is_editable: true,
      provider_mappings: [
        providerMapping({
          provider_domain: "tidal",
          provider_instance: "tidal--1",
        }),
      ],
      ...overrides,
    });

  it("lets an editor reorder a playlist on a provider that can move", () => {
    expect(
      canReorderPlaylistItems(tidalPlaylist(), owner, false, movable),
    ).toBe(true);
  });

  it("does not reorder on a provider that cannot move", () => {
    expect(
      canReorderPlaylistItems(spotifyPlaylist(), owner, false, movable),
    ).toBe(false);
  });

  it("does not reorder when any available mapping cannot move", () => {
    const item = tidalPlaylist({
      provider_mappings: [
        providerMapping({ provider_instance: "tidal--1" }),
        providerMapping({ provider_instance: "spotify--1" }),
      ],
    });

    expect(canReorderPlaylistItems(item, owner, false, movable)).toBe(false);
  });

  it("ignores an unavailable mapping", () => {
    const item = tidalPlaylist({
      provider_mappings: [
        providerMapping({ provider_instance: "tidal--1" }),
        providerMapping({ provider_instance: "spotify--1", available: false }),
      ],
    });

    expect(canReorderPlaylistItems(item, owner, false, movable)).toBe(true);
  });

  it("does not reorder a playlist the user may not edit", () => {
    expect(
      canReorderPlaylistItems(
        tidalPlaylist({ is_editable: false }),
        owner,
        true,
        movable,
      ),
    ).toBe(false);
  });

  it("does not reorder a dynamic playlist", () => {
    expect(
      canReorderPlaylistItems(
        tidalPlaylist({ is_dynamic: true }),
        owner,
        false,
        movable,
      ),
    ).toBe(false);
  });

  it("does not reorder a playlist outside the library", () => {
    expect(
      canReorderPlaylistItems(
        tidalPlaylist({ provider: "tidal--1" }),
        owner,
        false,
        movable,
      ),
    ).toBe(false);
  });
});

describe("canAddToPlaylist", () => {
  it.each([
    MediaType.TRACK,
    MediaType.ALBUM,
    MediaType.RADIO,
    MediaType.PODCAST_EPISODE,
    MediaType.AUDIOBOOK,
  ])("takes a %s", (media_type) => {
    expect(canAddToPlaylist(track({ media_type }))).toBe(true);
  });

  it.each([MediaType.ARTIST, MediaType.PLAYLIST, MediaType.GENRE])(
    "does not take a %s",
    (media_type) => {
      expect(canAddToPlaylist(track({ media_type }))).toBe(false);
    },
  );
});
