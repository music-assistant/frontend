import type { ConnectionIdentity } from "@/helpers/connection_identity";

const STORAGE_KEY = "music_quiz_guest_affinity";
const STORAGE_VERSION = 2;

export interface GuestQuizAffinityContext {
  connectionIdentity: ConnectionIdentity;
  participantIdentity: string;
}

interface StoredGuestQuizAffinity extends GuestQuizAffinityContext {
  version: typeof STORAGE_VERSION;
}

export interface GuestQuizAffinity {
  readonly active: boolean;
  record(): boolean;
}

/**
 * Track Music Quiz affinity for one authenticated participant.
 */
export function createGuestQuizAffinity(
  context: GuestQuizAffinityContext | undefined,
): GuestQuizAffinity {
  if (!context) {
    clearGuestQuizAffinity();
    return {
      active: false,
      record: () => false,
    };
  }

  let active = readGuestQuizAffinity(context);
  let persisted = active;
  return {
    get active() {
      return active;
    },
    record() {
      if (active) return persisted;
      active = true;
      persisted = writeGuestQuizAffinity(context);
      return persisted;
    },
  };
}

/**
 * Remove stored Music Quiz participant affinity.
 */
export function clearGuestQuizAffinity(): boolean {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(STORAGE_KEY);
    return true;
  } catch (error) {
    console.warn("Unable to clear Music Quiz participant affinity.", error);
    return false;
  }
}

function readGuestQuizAffinity(context: GuestQuizAffinityContext): boolean {
  let rawValue: string | null;
  try {
    localStorage.removeItem(STORAGE_KEY);
    rawValue = sessionStorage.getItem(STORAGE_KEY);
  } catch (error) {
    console.warn("Unable to read Music Quiz participant affinity.", error);
    return false;
  }
  if (rawValue === null) return false;

  let storedValue: unknown;
  try {
    storedValue = JSON.parse(rawValue);
  } catch (error) {
    console.warn("Ignoring corrupt Music Quiz participant affinity.", error);
    clearGuestQuizAffinity();
    return false;
  }

  if (!isStoredGuestQuizAffinity(storedValue)) {
    console.warn("Ignoring invalid Music Quiz participant affinity.");
    clearGuestQuizAffinity();
    return false;
  }
  if (
    storedValue.connectionIdentity !== context.connectionIdentity ||
    storedValue.participantIdentity !== context.participantIdentity
  ) {
    clearGuestQuizAffinity();
    return false;
  }
  return true;
}

function writeGuestQuizAffinity(context: GuestQuizAffinityContext): boolean {
  const value: StoredGuestQuizAffinity = {
    version: STORAGE_VERSION,
    ...context,
  };
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(value));
    return true;
  } catch (error) {
    console.warn("Unable to store Music Quiz participant affinity.", error);
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
    "participantIdentity" in value &&
    typeof value.participantIdentity === "string" &&
    value.participantIdentity.length > 0 &&
    "connectionIdentity" in value &&
    typeof value.connectionIdentity === "string" &&
    (value.connectionIdentity.startsWith("local:") ||
      value.connectionIdentity.startsWith("remote:"))
  );
}
