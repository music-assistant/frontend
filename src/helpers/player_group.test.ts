import {
  PlayerFeature,
  PlayerType,
  ProviderFeature,
  ProviderType,
} from "@/plugins/api/interfaces";
import { describe, expect, it } from "vitest";
import { player } from "../../tests/fixtures/player";
import { providerInstance } from "../../tests/fixtures/providerInstance";
import { providerManifest } from "../../tests/fixtures/providerManifest";
import {
  getGroupKinds,
  getGroupMemberCandidates,
  isPlayerGroupFilter,
} from "./player_group";

describe("isPlayerGroupFilter", () => {
  it("accepts all players and each kind of player", () => {
    for (const value of [
      "all",
      "players",
      "lights",
      "screens",
      "inputs",
      "controllers",
    ]) {
      expect(isPlayerGroupFilter(value)).toBe(true);
    }
  });

  it("rejects anything else", () => {
    for (const value of ["group", "", undefined, null, 1]) {
      expect(isPlayerGroupFilter(value)).toBe(false);
    }
  });
});

describe("getGroupKinds", () => {
  const CREATES_GROUPS = [
    ProviderFeature.CREATE_GROUP_PLAYER,
    ProviderFeature.REMOVE_GROUP_PLAYER,
  ];
  const providers = Object.fromEntries(
    [
      providerInstance({
        type: ProviderType.PLAYER,
        domain: "universal_group",
        instance_id: "universal_group",
        name: "Universal Group Player",
        supported_features: CREATES_GROUPS,
      }),
      // a provider that reports no name of its own goes by its manifest
      providerInstance({
        type: ProviderType.PLAYER,
        domain: "sync_group",
        instance_id: "sync_group",
        name: "",
        supported_features: CREATES_GROUPS,
      }),
      providerInstance({
        type: ProviderType.PLAYER,
        domain: "sonos",
        instance_id: "sonos--1",
        name: "Sonos",
      }),
      providerInstance({
        type: ProviderType.PLAYER,
        domain: "snapcast",
        instance_id: "snapcast--1",
        name: "Snapcast",
        supported_features: CREATES_GROUPS,
        available: false,
      }),
    ].map((provider) => [provider.instance_id, provider]),
  );
  const manifests = {
    sync_group: providerManifest({
      domain: "sync_group",
      name: "Sync Group Player",
      description: "Speakers play in sync.",
    }),
    universal_group: providerManifest({
      domain: "universal_group",
      name: "Universal Group Player",
      description: "Speakers play the same audio.",
    }),
  };

  it("lists the available providers that create groups, by their names", () => {
    expect(getGroupKinds(providers, manifests)).toEqual([
      {
        provider: "sync_group",
        domain: "sync_group",
        name: "Sync Group Player",
        description: "Speakers play in sync.",
      },
      {
        provider: "universal_group",
        domain: "universal_group",
        name: "Universal Group Player",
        description: "Speakers play the same audio.",
      },
    ]);
  });

  it("lists nothing when no provider creates groups", () => {
    expect(
      getGroupKinds({ "sonos--1": providers["sonos--1"] }, manifests),
    ).toEqual([]);
  });
});

describe("getGroupMemberCandidates", () => {
  // Kitchen, Living room and Bedroom sync with each other, Garage and Attic only with
  // each other, Office does not sync at all
  const players = Object.fromEntries(
    [
      player({
        player_id: "kitchen",
        name: "Kitchen",
        can_group_with: ["living_room", "bedroom"],
      }),
      player({
        player_id: "living_room",
        name: "Living room",
        can_group_with: ["kitchen", "bedroom"],
      }),
      // synced to Living room, so it lists no players of its own
      player({
        player_id: "bedroom",
        name: "Bedroom",
        synced_to: "living_room",
      }),
      player({
        player_id: "garage",
        name: "Garage",
        can_group_with: ["attic"],
      }),
      player({ player_id: "attic", name: "Attic", can_group_with: ["garage"] }),
      player({ player_id: "office", name: "Office", supported_features: [] }),
      player({
        player_id: "downstairs",
        name: "Downstairs",
        type: PlayerType.GROUP,
        can_group_with: ["kitchen"],
      }),
      player({
        player_id: "hallway",
        name: "Hallway",
        available: false,
        can_group_with: ["kitchen"],
      }),
      player({
        player_id: "line_in",
        name: "Line in",
        type: PlayerType.SOURCE,
        can_group_with: ["kitchen"],
      }),
      // the browser of someone else
      player({
        player_id: "browser",
        name: "Browser",
        private: true,
        hide_in_ui: true,
        can_group_with: ["kitchen"],
      }),
    ].map((item) => [item.player_id, item]),
  );
  const names = (items: { name: string }[]) => items.map((item) => item.name);

  it("offers every player that plays to a universal group", () => {
    expect(
      names(getGroupMemberCandidates(players, "universal_group", [])),
    ).toEqual([
      "Attic",
      "Bedroom",
      "Garage",
      "Kitchen",
      "Living room",
      "Office",
    ]);
  });

  it("offers only players that sync to any other group", () => {
    expect(names(getGroupMemberCandidates(players, "sync_group", []))).toEqual([
      "Attic",
      "Bedroom",
      "Garage",
      "Kitchen",
      "Living room",
    ]);
  });

  it("offers only players that sync with a picked member once one is picked", () => {
    expect(
      names(getGroupMemberCandidates(players, "sync_group", ["kitchen"])),
    ).toEqual(["Bedroom", "Kitchen", "Living room"]);
  });

  it("offers a player that syncs without the feature to set members to no group that syncs", () => {
    const office = {
      ...players.office,
      can_group_with: ["kitchen"],
      supported_features: [PlayerFeature.VOLUME_SET],
    };

    expect(
      names(getGroupMemberCandidates({ ...players, office }, "sync_group", [])),
    ).not.toContain("Office");
  });
});
