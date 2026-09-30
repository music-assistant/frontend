import { ApiCommandError } from "@/plugins/api/errors";
import { ShareType, StorageKind, StorageUsage } from "@/plugins/api/interfaces";
import { i18n } from "@/plugins/i18n";
import { describe, expect, it } from "vitest";
import { managedShare, storageLocation } from "../../tests/fixtures/storage";
import {
  canHoldNewSource,
  emptyNetworkShareForm,
  findStoragePosition,
  formatNames,
  formatStorageSize,
  isManagedShare,
  isNamedByKind,
  isInsideStoragePath,
  isRegisteredFolder,
  networkShareAddress,
  networkShareFormChanged,
  networkShareFormFromLocation,
  networkShareSettings,
  normalizeStoragePath,
  pathParts,
  sameStoragePath,
  SHARE_TYPE_LABEL_KEYS,
  STORAGE_KIND_ICONS,
  STORAGE_KIND_LABEL_KEYS,
  storageErrorText,
  storageLocationName,
  usedByShownOn,
} from "./storage";

const share = managedShare();

describe("joinStoragePath and findStoragePosition", () => {
  const media = storageLocation({ path: "/media" });
  const nas = managedShare({ path: "/media/nas_music" });
  const locations = [media, nas];

  it("places a location's own path at its root", () => {
    expect(findStoragePosition(locations, "/media")).toEqual({
      location: media,
      segments: [],
    });
  });

  it("splits a nested path into the location and its subfolders", () => {
    expect(findStoragePosition(locations, "/media/Albums/Rock/")).toEqual({
      location: media,
      segments: ["Albums", "Rock"],
    });
  });

  it("picks the innermost of two nested locations", () => {
    expect(findStoragePosition(locations, "/media/nas_music/Jazz")).toEqual({
      location: nas,
      segments: ["Jazz"],
    });
  });

  it("does not take a sibling sharing the name prefix for a subfolder", () => {
    const music = storageLocation({ path: "/mnt/music" });

    expect(findStoragePosition([music], "/mnt/musicbox")).toBeNull();
  });

  it("places a stored path with extra slashes in its location", () => {
    expect(findStoragePosition(locations, "/media//Albums/")).toEqual({
      location: media,
      segments: ["Albums"],
    });
    const rootWithSlash = storageLocation({ path: "/mnt/music/" });
    expect(findStoragePosition([rootWithSlash], "/mnt/music")).toEqual({
      location: rootWithSlash,
      segments: [],
    });
  });

  it("finds nothing for a path outside every location", () => {
    expect(findStoragePosition(locations, "/data/music")).toBeNull();
  });
});

describe("normalizeStoragePath and sameStoragePath", () => {
  it.each([
    ["/media/music", "/media/music"],
    ["/media/music/", "/media/music"],
    ["/media//music", "/media/music"],
    ["//media/music//", "/media/music"],
    ["/", "/"],
    ["//", "/"],
    ["", ""],
  ])("compares %j as %j", (path, normalized) => {
    expect(normalizeStoragePath(path)).toBe(normalized);
  });

  it("takes a path with a trailing slash for the same folder", () => {
    expect(sameStoragePath("/media/music/", "/media/music")).toBe(true);
    expect(sameStoragePath("/media/music", "/media/musicbox")).toBe(false);
  });

  it("matches nothing without a path", () => {
    expect(sameStoragePath(null, "/media")).toBe(false);
    expect(sameStoragePath("", "")).toBe(false);
  });
});

describe("isInsideStoragePath", () => {
  it.each([
    ["/media/music", "/media", true],
    ["/media/music/Albums", "/media", true],
    ["/media/music/", "/media//", true],
    ["/media", "/", true],
    ["/media", "/media", false],
    ["/media/", "/media", false],
    ["/", "/", false],
    ["/media/musicbox", "/media/music", false],
    ["/data", "/media", false],
    ["/media", "/media/music", false],
  ])("takes %j inside %j: %s", (path, folder, inside) => {
    expect(isInsideStoragePath(path, folder)).toBe(inside);
  });
});

describe("usedByShownOn", () => {
  it("names a source on the share it reads, not also on the media folder above", () => {
    const mediaFolder = storageLocation({
      path: "/media",
      used_by: ["Filesystem (remote share)"],
    });
    const nas = managedShare({
      path: "/media/nas_music",
      used_by: ["Filesystem (remote share)"],
    });
    const locations = [mediaFolder, nas];

    expect(usedByShownOn(mediaFolder, locations)).toEqual([]);
    expect(usedByShownOn(nas, locations)).toEqual([
      "Filesystem (remote share)",
    ]);
  });

  it("keeps a source whose folder lies in no location inside this one", () => {
    const mediaFolder = storageLocation({
      path: "/media",
      used_by: ["Local files", "Filesystem (remote share)"],
    });
    const nas = managedShare({
      path: "/media/nas_music/",
      used_by: ["Filesystem (remote share)"],
    });
    // a sibling that only shares the start of its name lies not inside the share
    const nasBox = storageLocation({
      path: "/media/nas_musicbox",
      used_by: [],
    });

    expect(usedByShownOn(mediaFolder, [mediaFolder, nas, nasBox])).toEqual([
      "Local files",
    ]);
  });

  it("names every source on the innermost location only", () => {
    const outer = storageLocation({
      path: "/media",
      used_by: ["Deep", "Middle"],
    });
    const middle = storageLocation({
      path: "/media/a",
      used_by: ["Deep", "Middle"],
    });
    const inner = storageLocation({ path: "/media/a/b", used_by: ["Deep"] });
    const locations = [outer, middle, inner];

    expect(usedByShownOn(outer, locations)).toEqual([]);
    expect(usedByShownOn(middle, locations)).toEqual(["Middle"]);
    expect(usedByShownOn(inner, locations)).toEqual(["Deep"]);
  });

  // two sources on two music folders easily get the same name
  it("names each of two sources of the same name on its own location", () => {
    const mediaFolder = storageLocation({
      path: "/media",
      used_by: ["Local files [music]", "Local files [music]"],
    });
    const nas = managedShare({
      path: "/media/nas",
      used_by: ["Local files [music]"],
    });
    const locations = [mediaFolder, nas];

    expect(usedByShownOn(mediaFolder, locations)).toEqual([
      "Local files [music]",
    ]);
    expect(usedByShownOn(nas, locations)).toEqual(["Local files [music]"]);
  });

  // the middle location also lists the source of the inner one
  it("names a source of the same name once on each of three nested locations", () => {
    const name = "Local files [music]";
    const outer = storageLocation({
      path: "/media",
      used_by: [name, name, name],
    });
    const middle = storageLocation({ path: "/media/a", used_by: [name, name] });
    const inner = storageLocation({ path: "/media/a/b", used_by: [name] });
    const locations = [outer, middle, inner];

    expect(usedByShownOn(outer, locations)).toEqual([name]);
    expect(usedByShownOn(middle, locations)).toEqual([name]);
    expect(usedByShownOn(inner, locations)).toEqual([name]);
  });
});

describe("pathParts", () => {
  it.each([
    ["/media/music/Albums", ["/media/", "music/", "Albums"]],
    ["/media", ["/media"]],
    ["/media/music/", ["/media/", "music/"]],
    ["/", ["/"]],
    ["music/Albums", ["music/", "Albums"]],
    ["", []],
  ])("cuts %s after each slash", (path, parts) => {
    expect(pathParts(path)).toEqual(parts);
  });

  it("keeps a name with spaces in one piece", () => {
    expect(pathParts("/media/OK Computer (1997)")).toEqual([
      "/media/",
      "OK Computer (1997)",
    ]);
  });
});

describe("formatStorageSize", () => {
  it.each([
    [41.26, "41.3 GB"],
    [512, "512 GB"],
    [2048, "2 TB"],
    [0.5, "512 MB"],
    [0.0012, "1.2 MB"],
    [0.0001, "0.1 MB"],
    [0, "0 MB"],
  ])("formats %s gigabytes as %s", (gigabytes, expected) => {
    expect(formatStorageSize(gigabytes, "en")).toBe(expected);
  });

  it("never reads a size above zero as zero", () => {
    expect(formatStorageSize(0.00001, "en")).toBe("0.01 MB");
  });

  // Lokalise locales use underscores, which Intl rejects as a language tag
  it("formats under an underscored locale", () => {
    expect(formatStorageSize(41.26, "en_GB")).toBe("41.3 GB");
  });
});

describe("formatNames", () => {
  it("lists names the way the language writes them", () => {
    expect(formatNames(["Local files"], "en")).toBe("Local files");
    expect(formatNames(["Music", "Audiobooks", "Podcasts"], "en_GB")).toBe(
      "Music, Audiobooks and Podcasts",
    );
  });
});

describe("storage labels and icons", () => {
  it.each(Object.values(StorageKind))(
    "labels and draws the %s kind",
    (kind) => {
      expect(i18n.global.te(STORAGE_KIND_LABEL_KEYS[kind], "en")).toBe(true);
      expect(STORAGE_KIND_ICONS[kind]).toBeDefined();
    },
  );

  it.each(Object.values(ShareType))("names the %s share type", (shareType) => {
    expect(i18n.global.te(SHARE_TYPE_LABEL_KEYS[shareType], "en")).toBe(true);
  });
});

describe("storageLocationName", () => {
  it("names the Home Assistant media folder after its kind", () => {
    const media = storageLocation({ name: "media" });

    expect(storageLocationName(media)).toBe(
      i18n.global.t("settings.storage.kind.builtin_media"),
    );
    expect(isNamedByKind(media)).toBe(true);
  });

  it.each([
    [StorageUsage.DATA, "settings.storage.usage.data"],
    [StorageUsage.CACHE, "settings.storage.usage.cache"],
  ])("names the server's %s storage", (usage, key) => {
    const location = storageLocation({
      usage,
      kind: StorageKind.LOCAL_DISK,
      name: "data",
    });

    expect(storageLocationName(location)).toBe(i18n.global.t(key));
    expect(isNamedByKind(location)).toBe(false);
  });

  it("keeps the name the server gave any other location", () => {
    expect(storageLocationName(managedShare({ name: "NAS music" }))).toBe(
      "NAS music",
    );
    expect(
      storageLocationName(
        storageLocation({ kind: StorageKind.REMOVABLE, name: "SANDISK" }),
      ),
    ).toBe("SANDISK");
  });
});

describe("canHoldNewSource", () => {
  it("takes an available music location that no source reads", () => {
    expect(canHoldNewSource(managedShare())).toBe(true);
  });

  it.each([
    ["a source reads from inside it", { used_by: ["Local files"] }],
    [
      "a source reads it through a folder around it",
      { read_by: ["Local files"] },
    ],
    ["it is not available", { available: false }],
    ["it is storage of the server itself", { usage: StorageUsage.DATA }],
  ])("refuses a location when %s", (_reason, overrides) => {
    expect(canHoldNewSource(managedShare(overrides))).toBe(false);
  });
});

describe("managed locations", () => {
  it("tells a managed network share apart from a discovered one", () => {
    expect(isManagedShare(share)).toBe(true);
    const discovered = storageLocation({ kind: StorageKind.NETWORK_SHARE });

    expect(isManagedShare(discovered)).toBe(false);
  });

  it("tells a registered folder apart from a discovered disk", () => {
    const folder = storageLocation({ kind: StorageKind.MANUAL, managed: true });

    expect(isRegisteredFolder(folder)).toBe(true);
    expect(
      isRegisteredFolder(storageLocation({ kind: StorageKind.LOCAL_DISK })),
    ).toBe(false);
    expect(isManagedShare(folder)).toBe(false);
  });
});

describe("networkShareAddress", () => {
  it("writes an SMB share as a UNC path", () => {
    expect(networkShareAddress(ShareType.CIFS, "nas.local", "music")).toBe(
      "//nas.local/music",
    );
  });

  it("writes an NFS share as server and export", () => {
    expect(
      networkShareAddress(ShareType.NFS, "nas.local", "/volume1/music"),
    ).toBe("nas.local:/volume1/music");
  });
});

describe("networkShareSettings", () => {
  it("sends every setting of an SMB share, credentials included", () => {
    const form = {
      ...emptyNetworkShareForm(ShareType.CIFS),
      server: " nas.local ",
      share: " music ",
      username: " marcel ",
      password: " secret ",
      version: "3.0",
      readOnly: true,
    };

    expect(networkShareSettings(form)).toEqual({
      server: "nas.local",
      share: "music",
      username: "marcel",
      // a password is taken as typed
      password: " secret ",
      version: "3.0",
      read_only: true,
    });
  });

  it("sends a guest on the automatic version as nulls", () => {
    const form = {
      ...emptyNetworkShareForm(ShareType.CIFS),
      server: "nas.local",
      share: "music",
    };

    expect(networkShareSettings(form)).toEqual({
      server: "nas.local",
      share: "music",
      username: null,
      version: null,
      read_only: false,
    });
  });

  it("keeps the stored password while none is typed", () => {
    const form = networkShareFormFromLocation(share);

    expect(networkShareSettings(form)).not.toHaveProperty("password");
  });

  it("sends no password for a guest", () => {
    const form = {
      ...networkShareFormFromLocation(share),
      username: " ",
      password: "left over",
    };

    expect(networkShareSettings(form)).toMatchObject({ username: null });
    expect(networkShareSettings(form)).not.toHaveProperty("password");
  });

  it("sends no credentials for an NFS share", () => {
    const form = {
      ...emptyNetworkShareForm(ShareType.NFS),
      server: "nas.local",
      share: "/volume1/music",
      username: "left over from SMB",
      password: "secret",
    };

    expect(networkShareSettings(form)).toEqual({
      server: "nas.local",
      share: "/volume1/music",
      username: null,
      version: null,
      read_only: false,
    });
  });
});

describe("networkShareFormFromLocation", () => {
  it("keeps a stored version the server can honour", () => {
    const pinned = managedShare({ version: "2.0" });

    expect(networkShareFormFromLocation(pinned, ["1.0", "2.0"]).version).toBe(
      "2.0",
    );
  });

  it("reads a stored version the server can not honour as automatic", () => {
    const pinned = managedShare({ version: "3.0" });

    expect(networkShareFormFromLocation(pinned, ["1.0", "2.0"]).version).toBe(
      null,
    );
    expect(networkShareFormFromLocation(pinned, []).version).toBe(null);
  });
});

describe("networkShareFormChanged", () => {
  it("sees no change in an untouched form", () => {
    expect(
      networkShareFormChanged(share, networkShareFormFromLocation(share)),
    ).toBe(false);
  });

  it.each([
    ["the server", { server: "192.168.1.10" }],
    ["the read-only switch", { readOnly: true }],
    ["the version", { version: "2.0" }],
    ["a typed password", { password: "new" }],
    ["a cleared username", { username: "" }],
  ])("sees a change in %s", (_label, change) => {
    const form = { ...networkShareFormFromLocation(share), ...change };

    expect(networkShareFormChanged(share, form)).toBe(true);
  });

  it("sees a change in a stored version the form reads as automatic", () => {
    const pinned = managedShare({ version: "3.0" });

    expect(
      networkShareFormChanged(pinned, networkShareFormFromLocation(pinned, [])),
    ).toBe(true);
  });
});

describe("storageErrorText", () => {
  it("shows the reason the server gave", () => {
    const error = new ApiCommandError("Login failed", 1, "Login failed");

    expect(storageErrorText(error, "fallback")).toBe("Login failed");
  });

  it("falls back when the server gave no reason", () => {
    expect(storageErrorText(new ApiCommandError("1", 1), "fallback")).toBe(
      "fallback",
    );
    expect(storageErrorText(new Error("boom"), "fallback")).toBe("fallback");
  });
});
