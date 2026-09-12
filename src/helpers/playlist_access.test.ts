import {
  type PlaylistAccess,
  ProviderSharing,
  UserRole,
} from "@/plugins/api/interfaces";
import { describe, expect, it } from "vitest";
import { playlist } from "../../tests/fixtures/playlist";
import { providerMapping } from "../../tests/fixtures/providerMapping";
import { user } from "../../tests/fixtures/user";
import {
  canEditPlaylistItems,
  canManagePlaylist,
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
