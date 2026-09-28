import { ApiCommandError } from "@/plugins/api/errors";
import { ShareType, StorageKind } from "@/plugins/api/interfaces";
import { i18n } from "@/plugins/i18n";
import { describe, expect, it } from "vitest";
import { managedShare, storageLocation } from "../../tests/fixtures/storage";
import {
  emptyNetworkShareForm,
  findStoragePosition,
  formatStorageSize,
  isManagedShare,
  isRegisteredFolder,
  networkShareAddSettings,
  networkShareAddress,
  networkShareChanges,
  networkShareFormFromLocation,
  SHARE_TYPE_LABEL_KEYS,
  STORAGE_KIND_ICONS,
  STORAGE_KIND_LABEL_KEYS,
  storageErrorText,
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

  it("finds nothing for a path outside every location", () => {
    expect(findStoragePosition(locations, "/data/music")).toBeNull();
  });
});

describe("formatStorageSize", () => {
  it.each([
    [41.26, "41.3 GB"],
    [512, "512 GB"],
    [2048, "2 TB"],
    [0.5, "512 MB"],
  ])("formats %s gigabytes as %s", (gigabytes, expected) => {
    expect(formatStorageSize(gigabytes, "en")).toBe(expected);
  });

  // Lokalise locales use underscores, which Intl rejects as a language tag
  it("formats under an underscored locale", () => {
    expect(formatStorageSize(41.26, "en_GB")).toBe("41.3 GB");
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

describe("networkShareAddSettings", () => {
  it("sends the credentials and the version of an SMB share", () => {
    const form = {
      ...emptyNetworkShareForm(ShareType.CIFS),
      server: " nas.local ",
      share: " music ",
      username: " marcel ",
      password: " secret ",
      version: "3.0",
      readOnly: true,
    };

    expect(networkShareAddSettings(form)).toEqual({
      server: "nas.local",
      share: "music",
      username: "marcel",
      // a password is taken as typed
      password: " secret ",
      version: "3.0",
      read_only: true,
    });
  });

  it("leaves out what a guest share on the automatic version does not have", () => {
    const form = {
      ...emptyNetworkShareForm(ShareType.CIFS),
      server: "nas.local",
      share: "music",
    };

    expect(networkShareAddSettings(form)).toEqual({
      server: "nas.local",
      share: "music",
      read_only: false,
    });
  });

  it("sends no credentials for an NFS share", () => {
    const form = {
      ...emptyNetworkShareForm(ShareType.NFS),
      server: "nas.local",
      share: "/volume1/music",
      username: "left over from SMB",
      password: "secret",
    };

    expect(networkShareAddSettings(form)).toEqual({
      server: "nas.local",
      share: "/volume1/music",
      read_only: false,
    });
  });
});

describe("networkShareChanges", () => {
  it("changes nothing for an untouched form", () => {
    expect(
      networkShareChanges(share, networkShareFormFromLocation(share)),
    ).toEqual({});
  });

  it("sends only the settings that changed", () => {
    const form = {
      ...networkShareFormFromLocation(share),
      server: "192.168.1.10",
      readOnly: true,
    };

    expect(networkShareChanges(share, form)).toEqual({
      server: "192.168.1.10",
      read_only: true,
    });
  });

  it("sends a new password and keeps the stored one otherwise", () => {
    const form = { ...networkShareFormFromLocation(share), password: "new" };

    expect(networkShareChanges(share, form)).toEqual({ password: "new" });
  });

  it("clears the password along with the username", () => {
    const form = {
      ...networkShareFormFromLocation(share),
      username: " ",
      password: "ignored",
    };

    expect(networkShareChanges(share, form)).toEqual({
      username: null,
      password: null,
    });
  });

  it("sends null to go back to the automatic version", () => {
    const pinned = managedShare({ version: "2.0" });
    const form = { ...networkShareFormFromLocation(pinned), version: null };

    expect(networkShareChanges(pinned, form)).toEqual({ version: null });
  });

  it("never sends credentials for an NFS share", () => {
    const nfs = managedShare({
      share_type: ShareType.NFS,
      share: "/volume1/music",
      username: null,
    });
    const form = {
      ...networkShareFormFromLocation(nfs),
      username: "marcel",
      password: "secret",
    };

    expect(networkShareChanges(nfs, form)).toEqual({});
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
