import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { authMock, deviceNameMock } = vi.hoisted(() => ({
  authMock: { setToken: vi.fn() },
  deviceNameMock: vi.fn(() => "Firefox on Linux"),
}));

vi.mock("@/plugins/auth", () => ({ authManager: authMock, default: authMock }));

vi.mock("@/plugins/api/helpers", () => ({ getDeviceName: deviceNameMock }));

type FirstRunModule = typeof import("@/composables/useFirstRunSetup");

/** A fresh module per test: whether this is a first run lives for a page load. */
async function loadModule(): Promise<FirstRunModule> {
  vi.resetModules();
  return await import("@/composables/useFirstRunSetup");
}

/** The module as the app boots on the given page, first-run setup entered. */
async function enterAt(href: string): Promise<FirstRunModule> {
  window.history.replaceState({}, "", href);
  const module = await loadModule();
  expect(module.enterFirstRunSetup()).toBe(true);
  return module;
}

function answer(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

/** Stub the server's setup endpoint, and hand back what it was sent. */
function stubSetupEndpoint(response: Response | Error) {
  const fetchMock = vi.fn(async () => {
    if (response instanceof Error) throw response;
    return response;
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const details = {
  username: "marcel",
  password: "correct horse battery",
  displayName: "Marcel",
};

let originalUrl: string;

beforeEach(() => {
  originalUrl = window.location.href;
  authMock.setToken.mockReset();
});

// the setup rewrites the address bar, so hand it back as it was found, along
// with the globals and spies a test put in place
afterEach(() => {
  window.history.replaceState({}, "", originalUrl);
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("entering the first-run setup", () => {
  it("is nothing on an ordinary visit", async () => {
    window.history.replaceState({}, "", "/");
    const module = await loadModule();

    expect(module.enterFirstRunSetup()).toBe(false);
    expect(module.useFirstRunSetup().firstRun.value).toBe(false);
    expect(module.useFirstRunSetup().awaitingAccount.value).toBe(false);
  });

  it("takes the setup page in and moves the browser onto the server's path", async () => {
    const module = await enterAt(
      "/setup?return_url=musicassistant%3A%2F%2Fauth",
    );

    expect(module.useFirstRunSetup().firstRun.value).toBe(true);
    expect(module.useFirstRunSetup().awaitingAccount.value).toBe(true);
    // the hand-back stays in the query, so a reload finds it again
    expect(window.location.pathname).toBe("/");
    expect(window.location.search).toBe(
      "?return_url=musicassistant%3A%2F%2Fauth",
    );
  });

  it("is over once the wizard that hosted it has finished", async () => {
    const module = await enterAt("/setup");

    module.leaveFirstRunSetup();

    expect(module.useFirstRunSetup().firstRun.value).toBe(false);
  });
});

describe("creating the account", () => {
  it("asks the server for the account and holds its token for the sign-in", async () => {
    const module = await enterAt("/setup");
    const fetchMock = stubSetupEndpoint(
      answer({ success: true, token: "admin-token", user: {} }),
    );

    const outcome = await module.useFirstRunSetup().createAccount(details);

    expect(outcome).toBe("signing_in");
    expect(fetchMock).toHaveBeenCalledWith(
      `${window.location.origin}/setup`,
      expect.objectContaining({ method: "POST" }),
    );
    const [, request] = fetchMock.mock.calls[0] as unknown as [
      string,
      { body: string },
    ];
    expect(JSON.parse(request.body)).toEqual({
      username: "marcel",
      password: "correct horse battery",
      display_name: "Marcel",
      // no client waiting, so the token is named after this browser
      device_name: "Firefox on Linux",
    });
    expect(authMock.setToken).toHaveBeenCalledWith("admin-token");
    expect(module.useFirstRunSetup().awaitingAccount.value).toBe(false);
  });

  it("asks the server behind a path prefix on that path", async () => {
    const module = await enterAt("/ma/setup");
    const fetchMock = stubSetupEndpoint(
      answer({ success: true, token: "admin-token", user: {} }),
    );

    await module.useFirstRunSetup().createAccount(details);

    expect(fetchMock).toHaveBeenCalledWith(
      `${window.location.origin}/ma/setup`,
      expect.anything(),
    );
  });

  it("leaves out a display name that was not given", async () => {
    const module = await enterAt("/setup");
    const fetchMock = stubSetupEndpoint(
      answer({ success: true, token: "admin-token", user: {} }),
    );

    await module
      .useFirstRunSetup()
      .createAccount({ ...details, displayName: "" });

    const [, request] = fetchMock.mock.calls[0] as unknown as [
      string,
      { body: string },
    ];
    expect(JSON.parse(request.body)).not.toHaveProperty("display_name");
  });

  it("passes the client's hand-back on, and follows the server to it", async () => {
    const module = await enterAt(
      "/setup?return_url=musicassistant%3A%2F%2Fauth&device_name=Companion",
    );
    const fetchMock = stubSetupEndpoint(
      answer({
        success: true,
        token: "admin-token",
        user: {},
        redirect_to: "musicassistant://auth?code=admin-token&onboard=true",
      }),
    );
    const assign = vi
      .spyOn(window.location, "assign")
      .mockImplementation(() => {});

    const outcome = await module.useFirstRunSetup().createAccount(details);

    expect(outcome).toBe("handed_back");
    const [, request] = fetchMock.mock.calls[0] as unknown as [
      string,
      { body: string },
    ];
    expect(JSON.parse(request.body)).toMatchObject({
      return_url: "musicassistant://auth",
      device_name: "Companion",
    });
    expect(assign).toHaveBeenCalledWith(
      "musicassistant://auth?code=admin-token&onboard=true",
    );
    // the token is the client's, not this page's
    expect(authMock.setToken).not.toHaveBeenCalled();
    expect(module.useFirstRunSetup().awaitingAccount.value).toBe(true);
  });

  it("signs in here rather than follow a hand-back the browser must not be sent to", async () => {
    const module = await enterAt("/setup");
    stubSetupEndpoint(
      answer({
        success: true,
        token: "admin-token",
        user: {},
        redirect_to: "javascript:alert(1)",
      }),
    );
    const assign = vi
      .spyOn(window.location, "assign")
      .mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});

    const outcome = await module.useFirstRunSetup().createAccount(details);

    expect(outcome).toBe("signing_in");
    expect(assign).not.toHaveBeenCalled();
    expect(authMock.setToken).toHaveBeenCalledWith("admin-token");
  });

  it("passes the server's reason on when it refuses", async () => {
    const module = await enterAt("/setup");
    stubSetupEndpoint(
      answer(
        { success: false, error: "Username must be at least 2 characters" },
        400,
      ),
    );

    await expect(
      module.useFirstRunSetup().createAccount(details),
    ).rejects.toMatchObject({
      name: "AccountSetupError",
      reason: "Username must be at least 2 characters",
    });
    expect(authMock.setToken).not.toHaveBeenCalled();
    expect(module.useFirstRunSetup().awaitingAccount.value).toBe(true);
  });

  it("says the admin already exists when the server answers with a conflict", async () => {
    const module = await enterAt("/setup");
    stubSetupEndpoint(
      answer({ success: false, error: "Setup already completed" }, 409),
    );

    await expect(
      module.useFirstRunSetup().createAccount(details),
    ).rejects.toMatchObject({
      name: "AccountSetupError",
      reason: "Setup already completed",
      accountExists: true,
    });
    expect(authMock.setToken).not.toHaveBeenCalled();
  });

  it("has no reason to give when the server could not be reached", async () => {
    const module = await enterAt("/setup");
    stubSetupEndpoint(new TypeError("Failed to fetch"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(
      module.useFirstRunSetup().createAccount(details),
    ).rejects.toMatchObject({ name: "AccountSetupError", reason: null });
  });

  it("has no reason to give when the answer is not the server's", async () => {
    const module = await enterAt("/setup");
    stubSetupEndpoint(
      new Response("<html>Bad gateway</html>", { status: 502 }),
    );

    await expect(
      module.useFirstRunSetup().createAccount(details),
    ).rejects.toMatchObject({ name: "AccountSetupError", reason: null });
  });
});
