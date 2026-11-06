import { describe, expect, it } from "vitest";
import { browsePathLevels, parentBrowsePath } from "./browse_path";

describe("parentBrowsePath", () => {
  it("goes up one folder", () => {
    expect(parentBrowsePath("fs--abc://Rock/Classic")).toBe("fs--abc://Rock");
  });

  it("goes from a top-level folder to the provider's root", () => {
    expect(parentBrowsePath("fs--abc://Rock")).toBe("fs--abc://");
  });

  it("goes from a provider's root to the browse root", () => {
    expect(parentBrowsePath("fs--abc://")).toBe("root");
  });
});

describe("parentBrowsePath for Discover", () => {
  it("goes from a row to its provider, keeping the row id whole", () => {
    expect(parentBrowsePath("discover://recs/recently_added_tracks")).toBe(
      "discover://recs",
    );
    expect(parentBrowsePath("discover://ytmusic--abc/mixes/for you")).toBe(
      "discover://ytmusic--abc",
    );
  });

  it("goes from a provider level to the scheme", () => {
    expect(parentBrowsePath("discover://recs")).toBe("discover://");
  });
});

describe("browsePathLevels", () => {
  const summary = (path: string) =>
    browsePathLevels(path).map(({ kind, path: levelPath, segment }) => ({
      kind,
      path: levelPath,
      segment,
    }));

  it("lists a level per folder of a provider path", () => {
    expect(summary("deezer--abc://albums/albums_1")).toEqual([
      { kind: "provider", path: "deezer--abc://", segment: "deezer--abc" },
      { kind: "folder", path: "deezer--abc://albums", segment: "albums" },
      {
        kind: "folder",
        path: "deezer--abc://albums/albums_1",
        segment: "albums_1",
      },
    ]);
  });

  it("lists the provider on its own when it has no folders", () => {
    expect(summary("recommendations://")).toEqual([
      {
        kind: "provider",
        path: "recommendations://",
        segment: "recommendations",
      },
    ]);
  });

  it("lists the scheme alone at the Discover root", () => {
    expect(summary("discover://")).toEqual([
      { kind: "scheme", path: "discover://", segment: "discover" },
    ]);
  });

  it("lists the row providers under the scheme", () => {
    expect(summary("discover://recommendations")).toEqual([
      { kind: "scheme", path: "discover://", segment: "discover" },
      {
        kind: "provider",
        path: "discover://recommendations",
        segment: "recommendations",
      },
    ]);
  });

  it("lists a row as one level", () => {
    expect(summary("discover://recommendations/recently_added_tracks")).toEqual(
      [
        { kind: "scheme", path: "discover://", segment: "discover" },
        {
          kind: "provider",
          path: "discover://recommendations",
          segment: "recommendations",
        },
        {
          kind: "row",
          path: "discover://recommendations/recently_added_tracks",
          segment: "recently_added_tracks",
        },
      ],
    );
  });

  it("keeps the slashes of a row id", () => {
    expect(summary("discover://ytmusic--abc/mixes/for you")).toEqual([
      { kind: "scheme", path: "discover://", segment: "discover" },
      {
        kind: "provider",
        path: "discover://ytmusic--abc",
        segment: "ytmusic--abc",
      },
      {
        kind: "row",
        path: "discover://ytmusic--abc/mixes/for you",
        segment: "mixes/for you",
      },
    ]);
  });

  it("lists the folders of a path that names no provider", () => {
    expect(summary("foo/bar")).toEqual([
      { kind: "folder", path: "foo", segment: "foo" },
      { kind: "folder", path: "foo/bar", segment: "bar" },
    ]);
  });

  it("has no levels for an empty path", () => {
    expect(browsePathLevels("")).toEqual([]);
  });
});
