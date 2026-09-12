import { HOMEASSISTANT_SYSTEM_USER } from "@/helpers/users";
import {
  type ProviderAccess,
  ProviderSharing,
  ProviderType,
  UserRole,
} from "@/plugins/api/interfaces";
import { describe, expect, it } from "vitest";
import { providerConfig } from "../../tests/fixtures/providerConfig";
import { providerManifest } from "../../tests/fixtures/providerManifest";
import { user } from "../../tests/fixtures/user";
import {
  accessAllows,
  effectiveProviderAccess,
  getProviderSharingHintTranslationKey,
  getProviderSharingTranslationKey,
  hasConfigurableAccess,
  isOwnMusicSource,
  isSelfServiceProvider,
  ownerCandidates,
  servesNobody,
  shareCandidates,
  userDisplayName,
} from "./provider_access";

describe("accessAllows", () => {
  const member = user({ user_id: "member" });
  const guest = user({ user_id: "guest", role: UserRole.GUEST });
  const record = (overrides: Partial<ProviderAccess> = {}): ProviderAccess => ({
    owner: "owner",
    sharing: ProviderSharing.PRIVATE,
    shared_users: [],
    ...overrides,
  });

  it("allows everyone without a record", () => {
    expect(accessAllows(null, guest)).toBe(true);
  });

  it("allows the owner whatever the sharing is", () => {
    expect(accessAllows(record({ owner: "member" }), member)).toBe(true);
  });

  it("allows nobody else while private", () => {
    expect(accessAllows(record(), member)).toBe(false);
  });

  it("allows the selected members only", () => {
    const access = record({
      sharing: ProviderSharing.SELECTED,
      shared_users: ["member"],
    });

    expect(accessAllows(access, member)).toBe(true);
    expect(accessAllows(access, user({ user_id: "other" }))).toBe(false);
  });

  it("allows members but not guests while shared with the members", () => {
    const access = record({ sharing: ProviderSharing.MEMBERS });

    expect(accessAllows(access, member)).toBe(true);
    expect(accessAllows(access, guest)).toBe(false);
  });

  it("allows guests too while shared with everyone", () => {
    expect(
      accessAllows(record({ sharing: ProviderSharing.EVERYONE }), guest),
    ).toBe(true);
  });
});

describe("effectiveProviderAccess", () => {
  it("reads a missing record as a household source for everyone", () => {
    expect(effectiveProviderAccess(null)).toEqual({
      owner: null,
      sharing: ProviderSharing.EVERYONE,
      shared_users: [],
    });
  });

  it("returns the record as-is when there is one", () => {
    const access = {
      owner: "user-1",
      sharing: ProviderSharing.SELECTED,
      shared_users: ["user-2"],
    };

    expect(effectiveProviderAccess(access)).toBe(access);
  });
});

describe("hasConfigurableAccess", () => {
  it("is true for a music source that is not builtin", () => {
    expect(hasConfigurableAccess(providerConfig(), providerManifest())).toBe(
      true,
    );
  });

  it.each([
    ["a builtin music source", providerConfig(), { builtin: true }],
    [
      "a player provider",
      providerConfig({ type: ProviderType.PLAYER }),
      { type: ProviderType.PLAYER },
    ],
  ])("is false for %s", (_label, config, manifestOverrides) => {
    expect(
      hasConfigurableAccess(config, providerManifest(manifestOverrides)),
    ).toBe(false);
  });

  it("is false while the manifest is not loaded yet", () => {
    expect(hasConfigurableAccess(providerConfig(), undefined)).toBe(false);
  });
});

describe("isOwnMusicSource", () => {
  const owned = providerConfig({
    access: {
      owner: "user-1",
      sharing: ProviderSharing.PRIVATE,
      shared_users: [],
    },
  });

  it("is true for the owner", () => {
    expect(isOwnMusicSource(owned, "user-1")).toBe(true);
  });

  it("is false for another user", () => {
    expect(isOwnMusicSource(owned, "user-2")).toBe(false);
  });

  it("is false for a household source", () => {
    expect(isOwnMusicSource(providerConfig(), "user-1")).toBe(false);
  });

  it("is false when nobody is signed in", () => {
    expect(isOwnMusicSource(owned, undefined)).toBe(false);
  });
});

describe("servesNobody", () => {
  it.each([
    ["private", ProviderSharing.PRIVATE],
    ["shared with nobody selected", ProviderSharing.SELECTED],
  ])("is true for a source without an owner that is %s", (_label, sharing) => {
    expect(servesNobody({ owner: null, sharing, shared_users: [] })).toBe(true);
  });

  it.each([
    [
      "a source without an owner shared with a selected member",
      {
        owner: null,
        sharing: ProviderSharing.SELECTED,
        shared_users: ["user-2"],
      },
    ],
    [
      "a source without an owner shared with all members",
      { owner: null, sharing: ProviderSharing.MEMBERS, shared_users: [] },
    ],
    [
      "a source without an owner shared with everyone",
      { owner: null, sharing: ProviderSharing.EVERYONE, shared_users: [] },
    ],
    [
      "a private source with an owner",
      { owner: "user-1", sharing: ProviderSharing.PRIVATE, shared_users: [] },
    ],
    [
      "a source with an owner shared with nobody selected",
      { owner: "user-1", sharing: ProviderSharing.SELECTED, shared_users: [] },
    ],
  ])("is false for %s", (_label, access) => {
    expect(servesNobody(access)).toBe(false);
  });
});

describe("sharing translation keys", () => {
  it.each(Object.values(ProviderSharing))("names sharing %s", (sharing) => {
    expect(getProviderSharingTranslationKey(sharing, true)).toBe(
      `settings.source_access.options.${sharing}`,
    );
    expect(
      getProviderSharingHintTranslationKey({
        owner: "user-1",
        sharing,
        shared_users: [],
      }),
    ).toBe(`settings.source_access.hints.${sharing}`);
  });

  it("names private sharing as not shared for a viewer that does not own the source", () => {
    expect(
      getProviderSharingTranslationKey(ProviderSharing.PRIVATE, false),
    ).toBe("settings.source_access.options.not_shared");
  });

  it.each([
    ProviderSharing.SELECTED,
    ProviderSharing.MEMBERS,
    ProviderSharing.EVERYONE,
  ])(
    "still names sharing %s for a viewer that does not own the source",
    (sharing) => {
      expect(getProviderSharingTranslationKey(sharing, false)).toBe(
        `settings.source_access.options.${sharing}`,
      );
    },
  );

  it("explains that only the selected members can use a source without an owner", () => {
    expect(
      getProviderSharingHintTranslationKey({
        owner: null,
        sharing: ProviderSharing.SELECTED,
        shared_users: ["user-2"],
      }),
    ).toBe("settings.source_access.hints.selected_no_owner");
  });

  it.each([
    ["private", ProviderSharing.PRIVATE],
    ["shared with nobody selected", ProviderSharing.SELECTED],
  ])(
    "explains that nobody can use a source without an owner that is %s",
    (_label, sharing) => {
      expect(
        getProviderSharingHintTranslationKey({
          owner: null,
          sharing,
          shared_users: [],
        }),
      ).toBe("settings.source_access.hints.nobody");
    },
  );

  it.each([ProviderSharing.MEMBERS, ProviderSharing.EVERYONE])(
    "still explains sharing %s for a source without an owner",
    (sharing) => {
      expect(
        getProviderSharingHintTranslationKey({
          owner: null,
          sharing,
          shared_users: [],
        }),
      ).toBe(`settings.source_access.hints.${sharing}`);
    },
  );
});

describe("user candidates", () => {
  const owner = user({ user_id: "owner", username: "owner" });
  const member = user({ user_id: "member", username: "member" });
  const guest = user({
    user_id: "guest",
    username: "guest",
    role: UserRole.GUEST,
  });
  const systemAccount = user({
    user_id: "ha",
    username: HOMEASSISTANT_SYSTEM_USER,
    role: UserRole.SERVICE,
  });
  const disabled = user({
    user_id: "disabled",
    username: "disabled",
    enabled: false,
  });
  const users = [owner, member, guest, systemAccount, disabled];

  it("offers enabled members as owner, not guests or the Home Assistant account", () => {
    expect(ownerCandidates(users)).toEqual([owner, member]);
  });

  it("offers another service account as owner", () => {
    const service = user({
      user_id: "service",
      username: "service",
      role: UserRole.SERVICE,
    });
    expect(ownerCandidates([service])).toEqual([service]);
  });

  it("offers every enabled member to share with, not guests", () => {
    expect(shareCandidates(users)).toEqual([owner, member, systemAccount]);
  });
});

describe("userDisplayName", () => {
  it("prefers the display name over the username", () => {
    expect(userDisplayName(user({ display_name: "Marcel" }))).toBe("Marcel");
    expect(userDisplayName(user({ username: "marcel" }))).toBe("marcel");
  });
});

describe("isSelfServiceProvider", () => {
  it("is true for a provider that members may set up themselves", () => {
    expect(isSelfServiceProvider(providerManifest())).toBe(true);
  });

  it("is false for a provider that only an admin may set up", () => {
    expect(
      isSelfServiceProvider(providerManifest({ self_service: false })),
    ).toBe(false);
  });

  it("is true for a manifest without the flag, as an older server sends it", () => {
    expect(
      isSelfServiceProvider(
        providerManifest({ self_service: undefined as unknown as boolean }),
      ),
    ).toBe(true);
  });
});
