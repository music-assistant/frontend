const STORAGE_KEY = "music_quiz_guest_affinity";
const STORAGE_VERSION = 1;

interface StoredGuestQuizAffinity {
  version: typeof STORAGE_VERSION;
  guestIdentity: string;
}

export interface GuestQuizAffinity {
  readonly active: boolean;
  record(): boolean;
}

/**
 * Track Music Quiz affinity for one authenticated guest identity.
 */
export function createGuestQuizAffinity(
  guestIdentity: string | undefined,
): GuestQuizAffinity {
  if (!guestIdentity) {
    clearGuestQuizAffinity();
    return {
      active: false,
      record: () => false,
    };
  }

  let active = readGuestQuizAffinity(guestIdentity);
  let persisted = active;
  return {
    get active() {
      return active;
    },
    record() {
      if (active) return persisted;
      active = true;
      persisted = writeGuestQuizAffinity(guestIdentity);
      return persisted;
    },
  };
}

/**
 * Remove any stored Music Quiz guest affinity.
 */
export function clearGuestQuizAffinity(): boolean {
  try {
    localStorage.removeItem(STORAGE_KEY);
    return true;
  } catch (error) {
    console.warn("Unable to clear Music Quiz guest affinity.", error);
    return false;
  }
}

function readGuestQuizAffinity(guestIdentity: string): boolean {
  let rawValue: string | null;
  try {
    rawValue = localStorage.getItem(STORAGE_KEY);
  } catch (error) {
    console.warn("Unable to read Music Quiz guest affinity.", error);
    return false;
  }
  if (rawValue === null) return false;

  let storedValue: unknown;
  try {
    storedValue = JSON.parse(rawValue);
  } catch (error) {
    console.warn("Ignoring corrupt Music Quiz guest affinity.", error);
    clearGuestQuizAffinity();
    return false;
  }

  if (!isStoredGuestQuizAffinity(storedValue)) {
    console.warn("Ignoring invalid Music Quiz guest affinity.");
    clearGuestQuizAffinity();
    return false;
  }
  if (storedValue.guestIdentity !== guestIdentity) {
    clearGuestQuizAffinity();
    return false;
  }
  return true;
}

function writeGuestQuizAffinity(guestIdentity: string): boolean {
  const value: StoredGuestQuizAffinity = {
    version: STORAGE_VERSION,
    guestIdentity,
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    return true;
  } catch (error) {
    console.warn("Unable to store Music Quiz guest affinity.", error);
    return false;
  }
}

function isStoredGuestQuizAffinity(
  value: unknown,
): value is StoredGuestQuizAffinity {
  return (
    typeof value === "object" &&
    value !== null &&
    "version" in value &&
    value.version === STORAGE_VERSION &&
    "guestIdentity" in value &&
    typeof value.guestIdentity === "string" &&
    value.guestIdentity.length > 0
  );
}
