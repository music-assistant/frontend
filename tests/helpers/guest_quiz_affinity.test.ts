import {
  clearGuestQuizAffinity,
  createGuestQuizAffinity,
} from "@/helpers/guest_quiz_affinity";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("Music Quiz guest affinity", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", createStorage());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("persists and restores affinity for the same guest identity", () => {
    const affinity = createGuestQuizAffinity("guest-token-1");
    expect(affinity.active).toBe(false);

    expect(affinity.record()).toBe(true);

    expect(affinity.active).toBe(true);
    expect(createGuestQuizAffinity("guest-token-1").active).toBe(true);
  });

  it("clears affinity when no guest identity is available", () => {
    createGuestQuizAffinity("guest-token-1").record();

    const affinity = createGuestQuizAffinity(undefined);

    expect(affinity.active).toBe(false);
    expect(affinity.record()).toBe(false);
    expect(affinity.active).toBe(false);
    expect(localStorage.getItem("music_quiz_guest_affinity")).toBeNull();
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
    vi.stubGlobal("localStorage", storage);
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const affinity = createGuestQuizAffinity("guest-token-1");
    expect(affinity.record()).toBe(false);

    expect(affinity.active).toBe(true);
    expect(storage.getItem).toHaveBeenCalledOnce();
    expect(storage.setItem).toHaveBeenCalledOnce();
    expect(warn).toHaveBeenCalledWith(
      "Unable to read Music Quiz guest affinity.",
      storageError,
    );
    expect(warn).toHaveBeenCalledWith(
      "Unable to store Music Quiz guest affinity.",
      storageError,
    );
    expect(clearGuestQuizAffinity()).toBe(false);
  });
});

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
