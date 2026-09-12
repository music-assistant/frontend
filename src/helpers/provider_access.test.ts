import { HOMEASSISTANT_SYSTEM_USER } from "@/helpers/users";
import {
  ProviderSharing,
  ProviderType,
  UserRole,
} from "@/plugins/api/interfaces";
import { describe, expect, it } from "vitest";
import { providerConfig } from "../../tests/fixtures/providerConfig";
import { providerManifest } from "../../tests/fixtures/providerManifest";
import { user } from "../../tests/fixtures/user";
import {
  effectiveProviderAccess,
  getProviderSharingHintTranslationKey,
  getProviderSharingTranslationKey,
  hasConfigurableAccess,
  isOwnMusicSource,
  ownerCandidates,
  shareCandidates,
  userDisplayName,
} from "./provider_access";

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

describe("sharing translation keys", () => {
  it.each(Object.values(ProviderSharing))("names sharing %s", (sharing) => {
    expect(getProviderSharingTranslationKey(sharing)).toBe(
      `settings.source_access.options.${sharing}`,
    );
    expect(getProviderSharingHintTranslationKey(sharing)).toBe(
      `settings.source_access.hints.${sharing}`,
    );
  });
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
