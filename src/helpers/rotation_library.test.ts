import type {
  Album,
  ItemMapping,
  ProviderMapping,
  RotationStep,
} from "@/plugins/api/interfaces";
import { describe, expect, it } from "vitest";
import {
  albumCoverage,
  libraryArtistId,
  pickedArtists,
} from "./rotation_library";

function mapping(domain: string, itemId: string): ProviderMapping {
  return {
    item_id: itemId,
    provider_domain: domain,
    provider_instance: `${domain}--abc`,
    available: true,
    in_library: null,
  } as ProviderMapping;
}

function album(
  mappings: ProviderMapping[],
  albumType: string = "album",
): Album {
  return {
    item_id: mappings[0]?.item_id ?? "1",
    provider: "x",
    name: "Album",
    album_type: albumType,
    provider_mappings: mappings,
  } as unknown as Album;
}

function keep(
  conditions: { field: string; op: string; value?: unknown }[],
  match: "all" | "any" = "all",
): RotationStep {
  return { type: "filter", mode: "keep", match, conditions };
}

describe("libraryArtistId", () => {
  it("reads the id of a library artist", () => {
    expect(libraryArtistId("library://artist/2526")).toBe("2526");
  });

  it("refuses other uris", () => {
    expect(libraryArtistId("library://album/2526")).toBeUndefined();
    expect(libraryArtistId("apple_music://artist/123")).toBeUndefined();
    expect(libraryArtistId("Fuchsbande")).toBeUndefined();
  });
});

describe("pickedArtists", () => {
  it("collects the artists picked with is and one of", () => {
    const step = keep([
      { field: "artist", op: "is", value: "library://artist/1" },
      {
        field: "artist",
        op: "one_of",
        value: ["library://artist/2", "library://artist/1"],
      },
    ]);
    expect(pickedArtists(step)).toEqual({ artistIds: ["1", "2"] });
  });

  it("ignores artists matched by name or left out", () => {
    expect(
      pickedArtists(keep([{ field: "artist", op: "contains", value: "Fu" }])),
    ).toBeUndefined();
    expect(
      pickedArtists({
        type: "filter",
        mode: "remove",
        match: "all",
        conditions: [
          { field: "artist", op: "is", value: "library://artist/1" },
        ],
      }),
    ).toBeUndefined();
  });

  it("ignores steps that are no filter", () => {
    expect(pickedArtists({ type: "limit", count: 3 })).toBeUndefined();
  });

  it("keeps the album types when all conditions must match", () => {
    const step = keep([
      { field: "artist", op: "is", value: "library://artist/1" },
      { field: "album_type", op: "one_of", value: ["album", "ep"] },
      { field: "album_type", op: "is", value: "album" },
    ]);
    expect(pickedArtists(step)).toEqual({
      artistIds: ["1"],
      albumTypes: ["album"],
    });
  });

  it("drops the album types when any condition may match", () => {
    const step = keep(
      [
        { field: "artist", op: "is", value: "library://artist/1" },
        { field: "album_type", op: "is", value: "album" },
      ],
      "any",
    );
    expect(pickedArtists(step)).toEqual({ artistIds: ["1"] });
  });
});

describe("albumCoverage", () => {
  const library = [
    album([mapping("apple_music", "a1"), mapping("filesystem", "f1")]),
    album([mapping("filesystem", "f2")]),
  ];

  it("counts the provider albums the library holds", () => {
    const provider = [
      album([mapping("apple_music", "a1")]),
      album([mapping("apple_music", "a2")]),
      album([mapping("apple_music", "a3")]),
    ];
    expect(albumCoverage(provider, library)).toEqual({
      inLibrary: 1,
      total: 3,
    });
  });

  it("matches the service, not the account", () => {
    const provider = [
      album([{ ...mapping("apple_music", "a1"), provider_instance: "other" }]),
    ];
    expect(albumCoverage(provider, library)).toEqual({
      inLibrary: 1,
      total: 1,
    });
  });

  it("does not match the same id on another service", () => {
    const provider = [album([mapping("tidal", "a1")])];
    expect(albumCoverage(provider, library)).toEqual({
      inLibrary: 0,
      total: 1,
    });
  });

  it("counts only the kept album types", () => {
    const provider = [
      album([mapping("apple_music", "a1")], "album"),
      album([mapping("apple_music", "a2")], "single"),
      album([mapping("apple_music", "a3")], "album"),
    ];
    expect(albumCoverage(provider, library, ["album"])).toEqual({
      inLibrary: 1,
      total: 2,
    });
  });

  it("skips slim mappings", () => {
    const slim = {
      item_id: "a9",
      provider: "apple_music--abc",
      name: "a9",
      media_type: "album",
    } as unknown as ItemMapping;
    expect(albumCoverage([slim], library)).toEqual({
      inLibrary: 0,
      total: 0,
    });
  });
});
