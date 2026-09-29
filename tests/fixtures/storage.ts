import type { ManagedShareLocation } from "@/helpers/storage";
import {
  MountBackend,
  ShareType,
  StorageKind,
  type StorageInfo,
  type StorageLocation,
  StorageUsage,
} from "@/plugins/api/interfaces";

/**
 * A complete storage location, for tests that only care about a few of its
 * fields but should still model a payload the server can send.
 */
export function storageLocation(
  overrides: Partial<StorageLocation> = {},
): StorageLocation {
  return {
    path: "/media",
    name: "Media folder",
    usage: StorageUsage.MEDIA,
    kind: StorageKind.BUILTIN_MEDIA,
    available: true,
    read_only: false,
    managed: false,
    backend: null,
    fstype: "ext4",
    mountpoint: "/media",
    share_name: null,
    share_type: null,
    server: null,
    share: null,
    username: null,
    version: null,
    free_space_gb: null,
    total_space_gb: null,
    used_space_gb: null,
    error: null,
    used_by: [],
    read_by: [],
    ...overrides,
  };
}

/** A network share Music Assistant mounted through the Home Assistant Supervisor. */
export function managedShare(
  overrides: Partial<ManagedShareLocation> = {},
): ManagedShareLocation {
  return {
    ...storageLocation(),
    path: "/media/nas_music",
    name: "NAS music",
    kind: StorageKind.NETWORK_SHARE,
    managed: true,
    backend: MountBackend.SUPERVISOR,
    fstype: "cifs",
    mountpoint: "/media/nas_music",
    share_name: "nas_music",
    share_type: ShareType.CIFS,
    server: "nas.local",
    share: "music",
    username: "marcel",
    ...overrides,
  };
}

/**
 * The storage info of a Home Assistant install, which mounts SMB and NFS shares
 * through the Supervisor, for tests that only care about a few of its fields.
 */
export function storageInfo(overrides: Partial<StorageInfo> = {}): StorageInfo {
  return {
    locations: [storageLocation()],
    can_mount_shares: true,
    mount_backend: MountBackend.SUPERVISOR,
    supported_share_types: [ShareType.CIFS, ShareType.NFS],
    supported_share_versions: {
      [ShareType.CIFS]: ["1.0", "2.0"],
      [ShareType.NFS]: [],
    },
    can_add_local_folder: false,
    ...overrides,
  };
}
