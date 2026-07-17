import {
  clearGuestQuizAffinity,
  createGuestQuizAffinity,
} from "@/helpers/guest_quiz_affinity";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("Music Quiz guest affinity", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", createStorage());
    vi.stubGlobal("sessionStorage", createStorage());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("persists and restores affinity for the same guest identity", () => {
    const affinity = createGuestQuizAffinity(createContext("guest-token-1"));
    expect(affinity.active).toBe(false);

    expect(affinity.record()).toBe(true);

    expect(affinity.active).toBe(true);
    expect(createGuestQuizAffinity(createContext("guest-token-1")).active).toBe(
      true,
    );
  });

  it("clears affinity when no guest identity is available", () => {
    createGuestQuizAffinity(createContext("guest-token-1")).record();

    const affinity = createGuestQuizAffinity(undefined);

    expect(affinity.active).toBe(false);
    expect(affinity.record()).toBe(false);
    expect(affinity.active).toBe(false);
    expect(sessionStorage.getItem("music_quiz_guest_affinity")).toBeNull();
  });

  it("keeps affinity in memory when storage is denied", () => {
    const storageError = new DOMException("Storage denied", "SecurityError");
    const storage = {
      getItem: vi.fn(() => {
        throw storageError;
      }),
      removeItem: vi.fn(() => {
        throw storageError;
      }),
      setItem: vi.fn(() => {
        throw storageError;
      }),
    };
    vi.stubGlobal("sessionStorage", storage);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const affinity = createGuestQuizAffinity(createContext("guest-token-1"));
    expect(affinity.record()).toBe(false);

    expect(affinity.active).toBe(true);
    expect(storage.getItem).toHaveBeenCalledOnce();
    expect(storage.setItem).toHaveBeenCalledOnce();
    expect(warn).toHaveBeenCalledWith(
      "Unable to read Music Quiz participant affinity.",
      storageError,
    );
    expect(warn).toHaveBeenCalledWith(
      "Unable to store Music Quiz participant affinity.",
      storageError,
    );
    expect(clearGuestQuizAffinity()).toBe(false);
  });

  it("does not share affinity with another tab", () => {
    const firstTab = createStorage();
    const secondTab = createStorage();
    vi.stubGlobal("sessionStorage", firstTab);
    createGuestQuizAffinity(createContext("regular-user")).record();

    vi.stubGlobal("sessionStorage", secondTab);
    expect(createGuestQuizAffinity(createContext("regular-user")).active).toBe(
      false,
    );

    vi.stubGlobal("sessionStorage", firstTab);
    expect(createGuestQuizAffinity(createContext("regular-user")).active).toBe(
      true,
    );
  });

  it("does not reuse affinity on another server", () => {
    createGuestQuizAffinity(createContext("regular-user")).record();

    expect(
      createGuestQuizAffinity({
        connectionIdentity: "local:http://other-server:8095",
        participantIdentity: "regular-user",
      }).active,
    ).toBe(false);
  });
});

function createContext(participantIdentity: string) {
  return {
    connectionIdentity: "local:http://music-assistant:8095" as const,
    participantIdentity,
  };
}

function createStorage() {
  const values = new Map<string, string>();
  return {
    clear: () => values.clear(),
    getItem: (key: string) => values.get(key) ?? null,
    removeItem: (key: string) => {
      values.delete(key);
    },
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
}
