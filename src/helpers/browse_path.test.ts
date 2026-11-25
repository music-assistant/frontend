import { describe, expect, it } from "vitest";
import {
  browseLevelTitle,
  browsePathLevels,
  parentBrowsePath,
} from "./browse_path";

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
    expect(parentBrowsePath("discover://recs/")).toBe("discover://");
  });

  it("goes from a row whose id carries a scheme delimiter to its provider", () => {
    expect(parentBrowsePath("discover://spotify--abc/spotify://mix/1")).toBe(
      "discover://spotify--abc",
    );
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

  it.each([
    ["a scheme delimiter", "spotify://mix/daily 1"],
    ["repeated slashes", "mixes//for you"],
    ["a trailing slash", "mixes/for you/"],
  ])("keeps a row id with %s verbatim", (_case, rowId) => {
    const path = `discover://spotify--abc/${rowId}`;
    // the row level's path is the key its breadcrumb name is looked up by
    expect(summary(path).at(-1)).toEqual({
      kind: "row",
      path,
      segment: rowId,
    });
    expect(summary(path)).toHaveLength(3);
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

describe("browseLevelTitle", () => {
  const names = (folders: Record<string, string> = {}) => ({
    discover: "Discover",
    folderName: (path: string) => folders[path],
    providerName: (providerId: string) =>
      providerId === "fs--abc" ? "My music" : providerId,
  });
  const titles = (path: string, folders?: Record<string, string>) =>
    browsePathLevels(path).map((level) =>
      browseLevelTitle(level, names(folders)),
    );

  it("names a provider level by its provider", () => {
    expect(titles("fs--abc://Rock")).toEqual(["My music", "Rock"]);
  });

  it("keeps the provider name over the name of its listed folder", () => {
    expect(titles("fs--abc://", { "fs--abc://": "Old name" })).toEqual([
      "My music",
    ]);
  });

  it("names a folder that stands for no provider as the server listed it", () => {
    expect(
      titles("live_sources://", { "live_sources://": "Live sources" }),
    ).toEqual(["Live sources"]);
  });

  it("falls back to the path segment while the folder is not known", () => {
    expect(titles("live_sources://")).toEqual(["live_sources"]);
  });

  it("names the Discover levels", () => {
    expect(
      titles("discover://recs/row", { "discover://recs/row": "New rows" }),
    ).toEqual(["Discover", "recs", "New rows"]);
  });
});
