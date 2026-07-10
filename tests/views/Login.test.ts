import Login from "@/views/Login.vue";
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  authenticateWithToken: vi.fn(),
  clearAuth: vi.fn(),
  connectRemote: vi.fn(),
  disconnectRemote: vi.fn(),
  getStoredRemoteId: vi.fn(),
  sendCommand: vi.fn(),
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
    setToken: vi.fn((token: string) => {
      localStorage.setItem("ma_access_token", token);
    }),
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
    },
  );

  it("keeps the join code while a standalone user selects a server", async () => {
    setLocation("?join=abcd1234");
    mockStandaloneFrontend();

    const wrapper = mountLogin();
    await flushPromises();

    expect(sessionStorage.getItem("ma_pending_join_code")).toBe("abcd1234");
    await wrapper.find("input").setValue("http://selected-server:8095");
    await wrapper.find("button").trigger("click");

    await vi.waitFor(() => {
      expect(wrapper.emitted("authenticated")).toHaveLength(1);
    });
    expect(wrapper.emitted("local-connect")).toEqual([
      ["http://selected-server:8095"],
    ]);
    expect(sessionStorage.getItem("ma_pending_join_code")).toBeNull();
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

  it("clears a stored admin token before exchanging a guest code", async () => {
    setLocation("?join=abcd1234");
    mockStandaloneFrontend();
    localStorage.setItem(
      "mass_server_address",
      "http://music-assistant.local:8095",
    );
    localStorage.setItem("ma_access_token", "admin-token");

    mountLogin();

    await vi.waitFor(() => {
      expect(mocks.sendCommand).toHaveBeenCalledWith(
        "auth/join_code/exchange",
        { code: "ABCD1234" },
      );
    });
    expect(mocks.clearAuth).toHaveBeenCalled();
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
    expect(localStorage.getItem("ma_access_token")).toBeNull();
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
    setLocation(`?remote_id=${remoteId}&join=abcd1234`);

    const wrapper = mountLogin();

    await vi.waitFor(() => {
      expect(wrapper.emitted("authenticated")).toHaveLength(1);
    });
    expect(mocks.connectRemote).toHaveBeenCalledWith(remoteId);
    expect(wrapper.emitted("connected")).toEqual([[{ id: "transport" }]]);
    expect(wrapper.emitted("local-connect")).toBeUndefined();
  });
});
