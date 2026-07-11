import { createGuestQuizAffinity } from "@/helpers/guest_quiz_affinity";
import { AuthManager } from "@/plugins/auth";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { storage } = vi.hoisted(() => {
  const values = new Map<string, string>();
  const storage = {
    clear: () => values.clear(),
    getItem: (key: string) => values.get(key) ?? null,
    removeItem: (key: string) => {
      values.delete(key);
    },
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
  };
  vi.stubGlobal("localStorage", storage);
  return { storage };
});

describe("AuthManager guest affinity", () => {
  beforeEach(() => {
    storage.clear();
  });

  it("preserves affinity only while the same guest token remains active", () => {
    const firstToken = createToken("guest-token-1", "party_guest");
    localStorage.setItem("ma_access_token", firstToken);
    createGuestQuizAffinity("guest-token-1").record();
    const authManager = new AuthManager();

    authManager.setToken(firstToken);
    expect(localStorage.getItem("music_quiz_guest_affinity")).not.toBeNull();

    authManager.setToken(createToken("guest-token-2", "party_guest"));
    expect(localStorage.getItem("music_quiz_guest_affinity")).toBeNull();
  });

  it("clears affinity for non-guest sessions and logout", () => {
    createGuestQuizAffinity("guest-token-1").record();
    const authManager = new AuthManager();
    expect(localStorage.getItem("music_quiz_guest_affinity")).toBeNull();

    authManager.setToken(createToken("guest-token-1", "music_quiz_guest"));
    createGuestQuizAffinity("guest-token-1").record();
    authManager.clearAuth();

    expect(localStorage.getItem("music_quiz_guest_affinity")).toBeNull();
  });
});

function createToken(jti: string, username: string): string {
  const payload = btoa(
    JSON.stringify({
      sub: "shared-guest-user",
      jti,
      username,
      role: "guest",
    }),
  )
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return `header.${payload}.signature`;
}
