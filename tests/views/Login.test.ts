import Login from "@/views/Login.vue";
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authenticateWithToken: vi.fn(),
  clearAuth: vi.fn(),
  clearGuestSession: vi.fn(),
  connectRemote: vi.fn(),
  disconnectRemote: vi.fn(),
  getToken: vi.fn(),
  getStoredRemoteId: vi.fn(),
  leaveGuestSession: vi.fn(),
  sendCommand: vi.fn(),
  setToken: vi.fn(),
}));

vi.mock("@/plugins/api", () => ({
  ConnectionState: {
    AUTHENTICATED: "authenticated",
    AUTHENTICATING: "authenticating",
    AUTH_REQUIRED: "auth_required",
    DISCONNECTED: "disconnected",
    FAILED: "failed",
    RECONNECTING: "reconnecting",
  },
  api: {
    authenticateWithToken: mocks.authenticateWithToken,
    disconnect: vi.fn(),
    sendCommand: mocks.sendCommand,
    serverInfo: { value: { server_id: "server-id" } },
    state: { value: "disconnected" },
  },
}));

vi.mock("@/plugins/auth", () => ({
  authManager: {
    clearAuth: mocks.clearAuth,
    clearGuestSession: mocks.clearGuestSession,
    getToken: mocks.getToken,
    isGuestAccessSession: () =>
      sessionStorage.getItem("ma_guest_access_token") !== null,
    leaveGuestSession: mocks.leaveGuestSession,
    setToken: mocks.setToken,
  },
}));

vi.mock("@/plugins/remote", () => ({
  remoteConnectionManager: {
    connectRemote: mocks.connectRemote,
    disconnect: mocks.disconnectRemote,
    getStoredRemoteId: mocks.getStoredRemoteId,
  },
}));

vi.mock("vue-i18n", () => ({
  useI18n: () => ({
    t: (_key: string, fallback: string) => fallback,
  }),
}));

vi.mock("vue-qrcode-reader", () => ({
  QrcodeStream: { template: "<div />" },
}));

class WebSocketMock {
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onopen: (() => void) | null = null;

  constructor() {
    queueMicrotask(() => this.onopen?.());
  }

  close() {
    this.onclose?.();
  }
}

class StorageMock implements Storage {
  private readonly values = new Map<string, string>();

  get length() {
    return this.values.size;
  }

  clear() {
    this.values.clear();
  }

  getItem(key: string) {
    return this.values.get(key) ?? null;
  }

  key(index: number) {
    return [...this.values.keys()][index] ?? null;
  }

  removeItem(key: string) {
    this.values.delete(key);
  }

  setItem(key: string, value: string) {
    this.values.set(key, value);
  }
}

const layoutStub = { template: "<div><slot /></div>" };
const buttonStub = {
  emits: ["click"],
  template: '<button type="button" @click="$emit(\'click\')"><slot /></button>',
};
const textFieldStub = {
  props: ["modelValue"],
  emits: ["update:modelValue"],
  template:
    '<input :value="modelValue" @input="$emit(\'update:modelValue\', $event.target.value)" />',
};

function mountLogin(): VueWrapper {
  return mount(Login, {
    global: {
      mocks: {
        $t: (_key: string, fallback: string) => fallback,
      },
      stubs: {
        VAlert: layoutStub,
        VApp: layoutStub,
        VBtn: buttonStub,
        VCard: layoutStub,
        VCardText: layoutStub,
        VCardTitle: layoutStub,
        VChip: layoutStub,
        VCol: layoutStub,
        VContainer: layoutStub,
        VDialog: layoutStub,
        VIcon: layoutStub,
        VMain: layoutStub,
        VProgressCircular: true,
        VRow: layoutStub,
        VTextField: textFieldStub,
      },
    },
  });
}

function setLocation(query: string) {
  window.history.replaceState({}, "", `http://localhost:3000/${query}`);
}

function mockStandaloneFrontend() {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: false,
    }),
  );
}

function mockHostedFrontend() {
  vi.stubGlobal(
    "fetch",
    vi.fn().mockResolvedValue({
      ok: true,
      json: vi.fn().mockResolvedValue({ server_id: "server-id" }),
    }),
  );
}

function mockSuccessfulGuest(username = "party_guest") {
  mocks.sendCommand.mockImplementation((command: string) => {
    if (command === "auth/join_code/exchange") {
      return Promise.resolve({
        success: true,
        access_token: "guest-token",
        user: { user_id: "guest-id", username, role: "guest" },
      });
    }
    return Promise.resolve([]);
  });
  mocks.authenticateWithToken.mockResolvedValue({
    user: { user_id: "guest-id", username, role: "guest" },
  });
}

beforeEach(() => {
  vi.stubGlobal("localStorage", new StorageMock());
  vi.stubGlobal("sessionStorage", new StorageMock());
  setLocation("");
  vi.clearAllMocks();
  vi.stubGlobal("WebSocket", WebSocketMock);
  mocks.clearAuth.mockImplementation(() => {
    localStorage.removeItem("ma_access_token");
    sessionStorage.removeItem("ma_guest_access_token");
  });
  mocks.clearGuestSession.mockImplementation(() => {
    for (const key of [
      "ma_guest_access_token",
      "ma_guest_remote_id",
      "ma_guest_server_address",
      "ma_pending_join_code",
      "ma_pending_join_type",
    ]) {
      sessionStorage.removeItem(key);
    }
  });
  mocks.leaveGuestSession.mockImplementation(() => {
    mocks.clearGuestSession();
  });
  mocks.getToken.mockImplementation(
    () =>
      sessionStorage.getItem("ma_guest_access_token") ||
      localStorage.getItem("ma_access_token"),
  );
  mocks.setToken.mockImplementation((token: string) => {
    sessionStorage.setItem("ma_guest_access_token", token);
  });
  mocks.getStoredRemoteId.mockReturnValue(null);
  mocks.connectRemote.mockResolvedValue({ id: "transport" });
  mockSuccessfulGuest();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("guest join login", () => {
  it.each(["party_guest", "music_quiz_guest"])(
    "joins a stored local server as %s from a standalone frontend",
    async (username) => {
      setLocation("?join=abcd1234");
      mockStandaloneFrontend();
      mockSuccessfulGuest(username);
      localStorage.setItem(
        "mass_server_address",
        "http://music-assistant.local:8095",
      );

      const wrapper = mountLogin();

      await vi.waitFor(() => {
        expect(wrapper.emitted("authenticated")).toEqual([
          [
            {
              token: "guest-token",
              user: { user_id: "guest-id", username, role: "guest" },
            },
          ],
        ]);
      });
      expect(wrapper.emitted("local-connect")).toEqual([
        ["http://music-assistant.local:8095"],
      ]);
      expect(mocks.sendCommand).toHaveBeenCalledWith(
        "auth/join_code/exchange",
        { code: "ABCD1234" },
      );
      expect(sessionStorage.getItem("ma_pending_join_code")).toBeNull();
      expect(sessionStorage.getItem("ma_guest_server_address")).toBe(
        "http://music-assistant.local:8095",
      );
      expect(localStorage.getItem("mass_server_address")).toBe(
        "http://music-assistant.local:8095",
      );
    },
  );

  it("keeps the join code while a standalone user selects a server", async () => {
    const regularRemoteId = "ZYXWVUTS9876598765ZYXWVUTS";
    setLocation("?join=abcd1234");
    mockStandaloneFrontend();
    localStorage.setItem("ma_access_token", "admin-token");
    mocks.getStoredRemoteId.mockReturnValue(regularRemoteId);

    const wrapper = mountLogin();
    await flushPromises();

    expect(sessionStorage.getItem("ma_pending_join_code")).toBe("abcd1234");
    expect(mocks.connectRemote).not.toHaveBeenCalled();
    localStorage.setItem("mass_server_address", "http://regular-server:8095");
    await wrapper.find("input").setValue("http://selected-server:8095");
    await wrapper.find("button").trigger("click");

    await vi.waitFor(() => {
      expect(wrapper.emitted("authenticated")).toHaveLength(1);
    });
    expect(wrapper.emitted("local-connect")).toEqual([
      ["http://selected-server:8095"],
    ]);
    expect(sessionStorage.getItem("ma_pending_join_code")).toBeNull();
    expect(sessionStorage.getItem("ma_guest_server_address")).toBe(
      "http://selected-server:8095",
    );
    expect(localStorage.getItem("mass_server_address")).toBe(
      "http://regular-server:8095",
    );
    expect(localStorage.getItem("ma_access_token")).toBe("admin-token");
  });

  it("recovers a pending local join after a service-worker reload", async () => {
    mockStandaloneFrontend();
    sessionStorage.setItem("ma_pending_join_code", "abcd1234");
    sessionStorage.setItem("ma_pending_join_type", "local");
    localStorage.setItem(
      "mass_server_address",
      "http://music-assistant.local:8095",
    );

    const wrapper = mountLogin();

    await vi.waitFor(() => {
      expect(wrapper.emitted("authenticated")).toHaveLength(1);
    });
    expect(mocks.sendCommand).toHaveBeenCalledWith("auth/join_code/exchange", {
      code: "ABCD1234",
    });
    expect(sessionStorage.getItem("ma_pending_join_code")).toBeNull();
  });

  it("preserves a stored admin token while exchanging a guest code", async () => {
    setLocation("?join=abcd1234");
    mockStandaloneFrontend();
    localStorage.setItem(
      "mass_server_address",
      "http://music-assistant.local:8095",
    );
    localStorage.setItem("ma_access_token", "admin-token");

    mountLogin();

    await vi.waitFor(() =>
      expect(sessionStorage.getItem("ma_guest_access_token")).toBe(
        "guest-token",
      ),
    );
    expect(mocks.clearAuth).not.toHaveBeenCalled();
    expect(localStorage.getItem("ma_access_token")).toBe("admin-token");
    expect(mocks.authenticateWithToken).not.toHaveBeenCalledWith("admin-token");
  });

  it("shows an error and clears pending auth after a failed exchange", async () => {
    setLocation("?join=expired1");
    mockStandaloneFrontend();
    localStorage.setItem(
      "mass_server_address",
      "http://music-assistant.local:8095",
    );
    localStorage.setItem("ma_access_token", "admin-token");
    mocks.sendCommand.mockResolvedValue({
      success: false,
      error: "expired",
    });

    const wrapper = mountLogin();

    await vi.waitFor(() => {
      expect(wrapper.text()).toContain(
        "Failed to join party. The code may have expired.",
      );
    });
    expect(sessionStorage.getItem("ma_pending_join_code")).toBeNull();
    expect(sessionStorage.getItem("ma_pending_join_type")).toBeNull();
    expect(sessionStorage.getItem("ma_guest_server_address")).toBeNull();
    expect(localStorage.getItem("ma_access_token")).toBe("admin-token");
    expect(sessionStorage.getItem("ma_guest_access_token")).toBeNull();
    expect(wrapper.emitted("authenticated")).toBeUndefined();
  });

  it("preserves same-origin hosted guest joining", async () => {
    setLocation("?join=abcd1234");
    mockHostedFrontend();

    const wrapper = mountLogin();

    await vi.waitFor(() => {
      expect(wrapper.emitted("authenticated")).toHaveLength(1);
    });
    expect(wrapper.emitted("local-connect")).toEqual([
      ["http://localhost:3000"],
    ]);
  });

  it("preserves remote ID guest joining", async () => {
    const remoteId = "ABCDEFGH1234512345ABCDEFGH";
    const regularRemoteId = "ZYXWVUTS9876598765ZYXWVUTS";
    setLocation(`?remote_id=${remoteId}&join=abcd1234`);
    localStorage.setItem("mass_remote_id", regularRemoteId);

    const wrapper = mountLogin();

    await vi.waitFor(() => {
      expect(wrapper.emitted("authenticated")).toHaveLength(1);
    });
    expect(mocks.connectRemote).toHaveBeenCalledWith(remoteId, {
      remember: false,
    });
    expect(sessionStorage.getItem("ma_guest_remote_id")).toBe(remoteId);
    expect(localStorage.getItem("mass_remote_id")).toBe(regularRemoteId);
    expect(wrapper.emitted("connected")).toEqual([[{ id: "transport" }]]);
    expect(wrapper.emitted("local-connect")).toBeUndefined();
  });

  it("restores regular connection data when a stored guest token expires", async () => {
    const guestRemoteId = "ABCDEFGH1234512345ABCDEFGH";
    const regularRemoteId = "ZYXWVUTS9876598765ZYXWVUTS";
    setLocation("?remote=1");
    sessionStorage.setItem("ma_guest_access_token", "expired-guest-token");
    sessionStorage.setItem("ma_guest_remote_id", guestRemoteId);
    localStorage.setItem("ma_access_token", "admin-token");
    localStorage.setItem("mass_remote_id", regularRemoteId);
    mocks.authenticateWithToken.mockRejectedValueOnce(new Error("expired"));

    mountLogin();

    await vi.waitFor(() => {
      expect(mocks.leaveGuestSession).toHaveBeenCalledOnce();
    });
    expect(mocks.connectRemote).toHaveBeenCalledWith(guestRemoteId, {
      remember: false,
    });
    expect(mocks.authenticateWithToken).toHaveBeenCalledOnce();
    expect(mocks.authenticateWithToken).toHaveBeenCalledWith(
      "expired-guest-token",
    );
    expect(mocks.clearAuth).not.toHaveBeenCalled();
    expect(localStorage.getItem("ma_access_token")).toBe("admin-token");
    expect(localStorage.getItem("mass_remote_id")).toBe(regularRemoteId);
  });
});
