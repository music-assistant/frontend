import { describe, expect, it } from "vitest";
import type {
  Playlist,
  RotationDescribe,
  RotationStep,
} from "@/plugins/api/interfaces";
import {
  addableStepTypes,
  groupKind,
  groupLabelKey,
  isGrouped,
  listStates,
  moveStep,
  newStep,
  refLabelFallback,
  rotationIdOf,
  unitKind,
} from "./rotation";

const describeStub: RotationDescribe = {
  step_types: [],
  media_types: {
    artist: { fields: [], sort_keys: [] },
    album: { fields: [], sort_keys: [] },
    track: { fields: [], sort_keys: [] },
  },
  providers: [],
};

const dieDreiFragezeichen: RotationStep[] = [
  { type: "source", media_type: "album", from: "library" },
  {
    type: "filter",
    mode: "keep",
    match: "all",
    conditions: [{ field: "artist", op: "is", value: "Die drei ???" }],
  },
  { type: "sort", keys: [{ field: "random" }] },
  { type: "expand", to: "track", scope: "library" },
  {
    type: "filter",
    mode: "remove",
    match: "any",
    conditions: [
      { field: "title", op: "contains", value: "Inhaltsangabe" },
      { field: "title", op: "contains", value: "Titelmusik" },
    ],
  },
  { type: "sort", keys: [{ field: "track_number" }] },
];

describe("listStates", () => {
  it("returns the state after each step", () => {
    expect(listStates(dieDreiFragezeichen)).toEqual([
      { kind: "album", depth: 0 },
      { kind: "album", depth: 0 },
      { kind: "album", depth: 0 },
      { kind: "track", depth: 1 },
      { kind: "track", depth: 1 },
      { kind: "track", depth: 1 },
    ]);
  });

  it("resets the depth on flatten and the kind on a new source", () => {
    const steps: RotationStep[] = [
      { type: "source", media_type: "artist" },
      { type: "expand", to: "album" },
      { type: "expand", to: "track" },
      { type: "flatten" },
      { type: "source", media_type: "album" },
    ];
    expect(listStates(steps)).toEqual([
      { kind: "artist", depth: 0 },
      { kind: "album", depth: 1 },
      { kind: "track", depth: 2 },
      { kind: "track", depth: 0 },
      { kind: "album", depth: 0 },
    ]);
  });

  it("reports steps before a source as albums at depth 0", () => {
    expect(listStates([{ type: "flatten" }])).toEqual([
      { kind: "album", depth: 0 },
    ]);
  });
});

describe("isGrouped", () => {
  it("is true only for steps inside groups", () => {
    const result = dieDreiFragezeichen.map((_, i) =>
      isGrouped(i, dieDreiFragezeichen),
    );
    expect(result).toEqual([false, false, false, false, true, true]);
  });
});

describe("addableStepTypes", () => {
  it("offers only source for an empty list", () => {
    expect(addableStepTypes([])).toEqual(["source"]);
  });

  it("offers flatten but not expand or source after the example", () => {
    const types = addableStepTypes(dieDreiFragezeichen);
    expect(types).toContain("flatten");
    expect(types).not.toContain("expand");
    expect(types).not.toContain("source");
  });

  it("offers expand for albums but not flatten at depth 0", () => {
    const types = addableStepTypes([{ type: "source", media_type: "album" }]);
    expect(types).toContain("expand");
    expect(types).not.toContain("flatten");
  });
});

describe("newStep", () => {
  it("expands an artist to albums and anything else to tracks", () => {
    const artist = newStep(
      "expand",
      { kind: "artist", depth: 0 },
      describeStub,
    );
    const album = newStep("expand", { kind: "album", depth: 0 }, describeStub);
    expect(artist).toEqual({ type: "expand", to: "album", scope: "library" });
    expect(album).toEqual({ type: "expand", to: "track", scope: "library" });
  });

  it("gives the documented defaults", () => {
    const state = { kind: "album", depth: 0 } as const;
    expect(newStep("filter", state, describeStub)).toEqual({
      type: "filter",
      mode: "keep",
      match: "all",
      conditions: [],
    });
    expect(newStep("sort", state, describeStub)).toEqual({
      type: "sort",
      keys: [{ field: "random" }],
    });
    expect(newStep("limit", state, describeStub)).toEqual({
      type: "limit",
      count: 10,
    });
    expect(newStep("source", state, describeStub)).toEqual({
      type: "source",
      media_type: "album",
      from: "library",
    });
    expect(newStep("flatten", state, describeStub)).toEqual({
      type: "flatten",
    });
  });
});

describe("moveStep", () => {
  it("moves a step down and up", () => {
    const moved = moveStep(dieDreiFragezeichen, 1, 2);
    expect(moved[1]).toBe(dieDreiFragezeichen[2]);
    expect(moved[2]).toBe(dieDreiFragezeichen[1]);
    expect(dieDreiFragezeichen[1].type).toBe("filter");
  });

  it("refuses to move the source or to move anything to index 0", () => {
    expect(moveStep(dieDreiFragezeichen, 0, 1)).toEqual(dieDreiFragezeichen);
    expect(moveStep(dieDreiFragezeichen, 1, 0)).toEqual(dieDreiFragezeichen);
  });

  it("ignores out of range indexes", () => {
    expect(moveStep(dieDreiFragezeichen, 2, 99)).toEqual(dieDreiFragezeichen);
  });
});

describe("groupLabelKey", () => {
  it("names the kind of the items being grouped", () => {
    expect(groupLabelKey({ kind: "album", depth: 0 })).toBe(
      "rotation.inside_each_album",
    );
    expect(groupLabelKey({ kind: "artist", depth: 0 })).toBe(
      "rotation.inside_each_artist",
    );
  });
});

describe("refLabelFallback", () => {
  it("returns the last path part of a uri", () => {
    expect(refLabelFallback("library://album/42")).toBe("42");
    expect(refLabelFallback("spotify://artist/abc/")).toBe("abc");
    expect(refLabelFallback("plain")).toBe("plain");
  });
});

describe("rotationIdOf", () => {
  const playlistWith = (domain: string) =>
    ({
      item_id: "42",
      provider_mappings: [{ provider_domain: domain, item_id: "fuchsbande" }],
    }) as unknown as Playlist;

  it("returns the item id of the Rotation mapping", () => {
    expect(rotationIdOf(playlistWith("rotation_playlist"))).toBe("fuchsbande");
  });

  it("returns undefined for a playlist that is no Rotation", () => {
    expect(rotationIdOf(playlistWith("smart_playlist"))).toBeUndefined();
    expect(rotationIdOf(undefined)).toBeUndefined();
  });
});

describe("unitKind", () => {
  it("counts the outer items of grouped steps", () => {
    expect(unitKind(dieDreiFragezeichen)).toBe("album");
  });

  it("counts the inner items once the groups are mixed", () => {
    expect(
      unitKind([
        { type: "source", media_type: "artist", from: "library" },
        { type: "expand", to: "album", scope: "library" },
        { type: "expand", to: "track", scope: "library" },
        { type: "flatten" },
      ]),
    ).toBe("track");
  });

  it("counts the source kind without an expand", () => {
    expect(
      unitKind([{ type: "source", media_type: "track", from: "library" }]),
    ).toBe("track");
  });
});

describe("groupKind", () => {
  it("names the kind of the innermost groups", () => {
    expect(groupKind(dieDreiFragezeichen)).toBe("album");
    expect(
      groupKind([
        { type: "source", media_type: "artist", from: "library" },
        { type: "expand", to: "album", scope: "library" },
        { type: "expand", to: "track", scope: "library" },
      ]),
    ).toBe("album");
  });

  it("is null for a list without groups", () => {
    expect(groupKind(dieDreiFragezeichen.slice(0, 3))).toBeNull();
    expect(groupKind([...dieDreiFragezeichen, { type: "flatten" }])).toBeNull();
  });
});

describe("newStep sort inside album groups", () => {
  const withTrackKeys: RotationDescribe = {
    ...describeStub,
    media_types: {
      ...describeStub.media_types,
      track: {
        fields: [],
        sort_keys: ["random", "track_number", "disc_number"],
      },
    },
  };
  const tracks = { kind: "track" as const, depth: 1 };

  it("orders the tracks of an album by disc and track number", () => {
    expect(newStep("sort", tracks, withTrackKeys, "album")).toEqual({
      type: "sort",
      keys: [{ field: "disc_number" }, { field: "track_number" }],
    });
  });

  it("orders randomly elsewhere", () => {
    const random = { type: "sort", keys: [{ field: "random" }] };
    expect(newStep("sort", tracks, withTrackKeys, "artist")).toEqual(random);
    expect(newStep("sort", tracks, withTrackKeys, null)).toEqual(random);
    expect(newStep("sort", tracks, describeStub, "album")).toEqual(random);
  });
});
