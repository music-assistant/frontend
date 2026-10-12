import {
  getExternalLoginReturnPath,
  listenForExternalLogin,
  type PendingExternalLogin,
  savePendingExternalLogin,
  takeExternalLoginReturn,
} from "@/helpers/external_login";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const STATE = "w.0123456789abcdefghijABCDEFGHIJ";
const KEY = `ma.external_login.${STATE}`;
const NOW = Date.now();

function pending(
  overrides: Partial<PendingExternalLogin> = {},
): PendingExternalLogin {
  return {
    verifier: "v".repeat(43),
    remoteId: "ABCDEFGH1234512345ABCDEFGH",
    returnPath: "/stable/",
    createdAt: NOW,
    ...overrides,
  };
}

function setLocation(path: string) {
  window.history.replaceState({}, "", `http://localhost:3000${path}`);
}

beforeEach(() => {
  sessionStorage.clear();
  localStorage.clear();
  setLocation("/");
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("savePendingExternalLogin", () => {
  it("keeps the sign-in in this tab with a localStorage mirror", () => {
    savePendingExternalLogin(STATE, pending());

    expect(JSON.parse(sessionStorage.getItem(KEY)!)).toEqual(pending());
    expect(localStorage.getItem(KEY)).toBe(sessionStorage.getItem(KEY));
  });

  it("drops expired sign-ins", () => {
    const expired = "ma.external_login.w.expired";
    localStorage.setItem(
      expired,
      JSON.stringify(pending({ createdAt: Date.now() - 11 * 60 * 1000 })),
    );

    savePendingExternalLogin(STATE, pending());

    expect(localStorage.getItem(expired)).toBeNull();
  });
});

describe("getExternalLoginReturnPath", () => {
  it("returns the same-origin path without callback parameters", () => {
    setLocation("/stable/?remote=1&code=x&state=y#/settings");

    expect(getExternalLoginReturnPath()).toBe("/stable/?remote=1#/settings");
  });
});

describe("takeExternalLoginReturn", () => {
  it("returns the code with its pending sign-in, once", () => {
    savePendingExternalLogin(STATE, pending());
    setLocation(`/stable/?remote=1&code=the-code&state=${STATE}#/home`);

    expect(takeExternalLoginReturn()).toEqual({
      state: STATE,
      pending: pending(),
      code: "the-code",
    });
    expect(window.location.href).toBe(
      "http://localhost:3000/stable/?remote=1#/home",
    );
    expect(sessionStorage.getItem(KEY)).toBeNull();
    expect(localStorage.getItem(KEY)).toBeNull();

    setLocation(`/stable/?code=the-code&state=${STATE}`);
    expect(takeExternalLoginReturn()).toBeNull();
  });

  it("returns the error description of a refused sign-in", () => {
    savePendingExternalLogin(STATE, pending());
    setLocation(
      `/?error=access_denied&error_description=Not+allowed&state=${STATE}`,
    );

    expect(takeExternalLoginReturn()).toMatchObject({ error: "Not allowed" });
    expect(window.location.search).toBe("");
  });

  it("uses the localStorage mirror for a sign-in from another tab", () => {
    localStorage.setItem(KEY, JSON.stringify(pending()));
    setLocation(`/?code=the-code&state=${STATE}`);

    expect(takeExternalLoginReturn()).toMatchObject({ code: "the-code" });
  });

  it("drops a state this browser didn't start, and strips its code", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    setLocation(`/?code=attacker-code&state=${STATE}`);

    expect(takeExternalLoginReturn()).toBeNull();
    expect(window.location.search).toBe("");
  });

  it("drops an expired sign-in", () => {
    vi.spyOn(console, "warn").mockImplementation(() => {});
    savePendingExternalLogin(
      STATE,
      pending({ createdAt: Date.now() - 11 * 60 * 1000 }),
    );
    setLocation(`/?code=the-code&state=${STATE}`);

    expect(takeExternalLoginReturn()).toBeNull();
  });

  it("leaves a URL without state alone", () => {
    setLocation("/?code=legacy-token");

    expect(takeExternalLoginReturn()).toBeNull();
    expect(window.location.search).toBe("?code=legacy-token");
  });
});

describe("listenForExternalLogin", () => {
  async function postFromCallbackPage(message: object) {
    const page = new BroadcastChannel("ma-external-login");
    const replies: unknown[] = [];
    page.onmessage = (event) => replies.push(event.data);
    page.postMessage(message);
    // BroadcastChannel delivers asynchronously, in both directions
    await new Promise((resolve) => setTimeout(resolve, 50));
    page.close();
    return replies;
  }

  it("takes and acknowledges a sign-in this tab started", async () => {
    savePendingExternalLogin(STATE, pending());
    const onResult = vi.fn();
    const stop = listenForExternalLogin(onResult);

    const replies = await postFromCallbackPage({
      type: "ma-external-login",
      state: STATE,
      code: "the-code",
    });
    stop();

    expect(replies).toEqual([{ type: "ack", state: STATE }]);
    expect(onResult).toHaveBeenCalledWith({
      state: STATE,
      pending: pending(),
      code: "the-code",
    });
    expect(localStorage.getItem(KEY)).toBeNull();
  });

  it("ignores a sign-in that only the localStorage mirror knows", async () => {
    localStorage.setItem(KEY, JSON.stringify(pending()));
    const onResult = vi.fn();
    const stop = listenForExternalLogin(onResult);

    const replies = await postFromCallbackPage({
      type: "ma-external-login",
      state: STATE,
      code: "the-code",
    });
    stop();

    expect(replies).toEqual([]);
    expect(onResult).not.toHaveBeenCalled();
    expect(localStorage.getItem(KEY)).not.toBeNull();
  });
});
