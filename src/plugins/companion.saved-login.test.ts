import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  forgetDesktopSavedLogin,
  getDesktopSavedLoginStatus,
  hasDesktopSavedLogin,
  restoreDesktopSavedLogin,
  saveDesktopLogin,
} from "./companion";

const invoke = vi.fn();

beforeEach(() => {
  invoke.mockReset();
  const topDocument = {
    __TAURI__: { core: { invoke } },
    __COMPANION_SAVED_LOGIN_VERSION__: 1,
    __COMPANION_SAVED_LOGIN_NONCE__: "native-nonce",
  };
  vi.stubGlobal("window", { ...topDocument, top: null });
  Object.defineProperty(window, "top", { value: window, configurable: true });
});

afterEach(() => vi.unstubAllGlobals());

describe("desktop saved login bridge", () => {
  it("never probes browser or older native builds", async () => {
    window.__COMPANION_SAVED_LOGIN_VERSION__ = undefined;
    expect(hasDesktopSavedLogin()).toBe(false);
    expect(await getDesktopSavedLoginStatus()).toBeNull();
    expect(await restoreDesktopSavedLogin("context")).toBeNull();
    expect(
      await saveDesktopLogin({
        username: "u",
        password: "p",
        context: "context",
      }),
    ).toBeNull();
    expect(await forgetDesktopSavedLogin("context")).toBeNull();
    expect(invoke).not.toHaveBeenCalled();
    window.__COMPANION_SAVED_LOGIN_VERSION__ = 1;
    window.__TAURI__ = undefined;
    expect(await getDesktopSavedLoginStatus()).toBeNull();
    expect(invoke).not.toHaveBeenCalled();
    window.__TAURI__ = { core: { invoke } };
    window.__COMPANION_SAVED_LOGIN_NONCE__ = undefined;
    expect(hasDesktopSavedLogin()).toBe(false);
    expect(await getDesktopSavedLoginStatus()).toBeNull();
    window.__COMPANION_SAVED_LOGIN_NONCE__ = "native-nonce";
    Object.defineProperty(window, "top", { value: {}, configurable: true });
    expect(hasDesktopSavedLogin()).toBe(false);
    expect(await getDesktopSavedLoginStatus()).toBeNull();
    expect(invoke).not.toHaveBeenCalled();
  });

  it("uses native-authoritative context without sending a server URL", async () => {
    const status = {
      supported: true,
      available: true,
      saved: true,
      context: "verified",
    };
    invoke
      .mockResolvedValueOnce(status)
      .mockResolvedValueOnce({
        username: "alice",
        password: "secret",
        context: "verified",
      })
      .mockResolvedValueOnce(status)
      .mockResolvedValueOnce({ ...status, saved: false });
    expect(await getDesktopSavedLoginStatus()).toEqual(status);
    expect(await restoreDesktopSavedLogin("verified")).toMatchObject({
      username: "alice",
    });
    await saveDesktopLogin({
      username: "alice",
      password: "secret",
      context: "verified",
    });
    await forgetDesktopSavedLogin("verified");
    expect(invoke.mock.calls).toEqual([
      ["companion_login_status", { nonce: "native-nonce" }],
      [
        "companion_restore_login",
        { context: "verified", nonce: "native-nonce" },
      ],
      [
        "companion_save_login",
        {
          username: "alice",
          password: "secret",
          context: "verified",
          nonce: "native-nonce",
        },
      ],
      [
        "companion_forget_login",
        { context: "verified", nonce: "native-nonce" },
      ],
    ]);
  });
});
