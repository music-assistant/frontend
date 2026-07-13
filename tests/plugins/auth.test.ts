import { createGuestQuizAffinity } from "@/helpers/guest_quiz_affinity";
import { AuthManager } from "@/plugins/auth";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const { localStorageMock, sessionStorageMock } = vi.hoisted(() => {
  const createStorage = () => {
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
  };
  const localStorageMock = createStorage();
  const sessionStorageMock = createStorage();
  vi.stubGlobal("localStorage", localStorageMock);
  vi.stubGlobal("sessionStorage", sessionStorageMock);
  return { localStorageMock, sessionStorageMock };
});

describe("AuthManager guest sessions", () => {
  beforeEach(() => {
    localStorageMock.clear();
    sessionStorageMock.clear();
  });

  afterAll(() => {
    vi.unstubAllGlobals();
  });

  it("migrates a legacy persistent guest token to the current tab", () => {
    const guestToken = createToken("guest-token-1", "party_guest");
    localStorage.setItem("ma_access_token", guestToken);

    const authManager = new AuthManager();

    expect(authManager.getToken()).toBe(guestToken);
    expect(authManager.isGuestAccessSession()).toBe(true);
    expect(localStorage.getItem("ma_access_token")).toBeNull();
    expect(sessionStorage.getItem("ma_guest_access_token")).toBe(guestToken);
  });

  it("keeps the regular token while guest access is active in the tab", () => {
    const regularToken = createToken("regular-token", "admin");
    const guestToken = createToken("guest-token", "music_quiz_guest");
    localStorage.setItem("ma_access_token", regularToken);
    const authManager = new AuthManager();

    authManager.setToken(guestToken);
    sessionStorage.setItem("ma_guest_remote_id", "guest-remote-id");
    sessionStorage.setItem(
      "ma_guest_server_address",
      "http://guest-server:8095",
    );

    expect(authManager.getToken()).toBe(guestToken);
    expect(localStorage.getItem("ma_access_token")).toBe(regularToken);
    expect(sessionStorage.getItem("ma_guest_access_token")).toBe(guestToken);

    authManager.clearGuestSession();

    expect(authManager.getToken()).toBe(regularToken);
    expect(authManager.isGuestAccessSession()).toBe(false);
    expect(sessionStorage.getItem("ma_guest_access_token")).toBeNull();
    expect(sessionStorage.getItem("ma_guest_remote_id")).toBeNull();
    expect(sessionStorage.getItem("ma_guest_server_address")).toBeNull();
  });

  it("preserves affinity only while the same guest token remains active", () => {
    const firstToken = createToken("guest-token-1", "party_guest");
    sessionStorage.setItem("ma_guest_access_token", firstToken);
    createGuestQuizAffinity("guest-token-1").record();
    const authManager = new AuthManager();

    authManager.setToken(firstToken);
    expect(localStorage.getItem("music_quiz_guest_affinity")).not.toBeNull();

    authManager.setToken(createToken("guest-token-2", "party_guest"));
    expect(localStorage.getItem("music_quiz_guest_affinity")).toBeNull();
  });

  it("clears persistent and guest credentials on full logout", () => {
    const authManager = new AuthManager();
    authManager.setToken(createToken("regular-token", "admin"));
    createGuestQuizAffinity("guest-token-1").record();

    authManager.clearAuth();

    expect(authManager.getToken()).toBeNull();
    expect(localStorage.getItem("ma_access_token")).toBeNull();
    expect(sessionStorage.getItem("ma_guest_access_token")).toBeNull();
    expect(localStorage.getItem("music_quiz_guest_affinity")).toBeNull();
  });
});

function createToken(jti: string, username: string): string {
  const payload = btoa(
    JSON.stringify({
      sub: "user-id",
      jti,
      username,
      role: username.endsWith("_guest") ? "guest" : "admin",
    }),
  )
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
  return `header.${payload}.signature`;
}
