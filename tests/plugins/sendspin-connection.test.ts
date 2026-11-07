/**
 * Sendspin proxy handshake.
 *
 * The proxy socket is handed to sendspin-js once the server answered the auth
 * message, which announces the web player with the token, or over Ingress with
 * the key of this browser.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { FakeWebSocket, mockStore } = vi.hoisted(() => {
  class FakeWebSocket {
    static instances: FakeWebSocket[] = [];
    binaryType = "";
    sent: unknown[] = [];
    onopen: (() => void) | null = null;
    onmessage: ((event: { data: string }) => void) | null = null;

    constructor(public url: string) {
      FakeWebSocket.instances.push(this);
    }

    send(data: string) {
      this.sent.push(JSON.parse(data));
    }

    close() {}
  }
  // the module keeps the WebSocket it finds when it loads
  vi.stubGlobal("WebSocket", FakeWebSocket);
  return { FakeWebSocket, mockStore: { isIngressSession: false } };
});

vi.mock("@/plugins/api", () => ({
  default: {
    baseUrl: "http://ha.local:8123/api/hassio_ingress/abc",
    isRemoteConnection: { value: false },
  },
}));

vi.mock("@/plugins/auth", () => ({
  authManager: { getToken: () => "test-token" },
}));

vi.mock("@/plugins/store", () => ({
  store: mockStore,
}));

import { getIngressClientKey } from "@/helpers/ingress";
import { createSendspinConnection } from "@/plugins/sendspin-connection";

const AUTH_OK = { data: '{"type": "auth_ok"}' };

describe("Sendspin proxy connection", () => {
  beforeEach(() => {
    FakeWebSocket.instances = [];
    localStorage.setItem("sendspin_webplayer_id", "web-1");
  });

  afterEach(() => {
    localStorage.clear();
  });

  it("announces the web player with the key of this browser over Ingress", async () => {
    mockStore.isIngressSession = true;
    const { connection, ws } = openProxyConnection();

    expect(ws.sent).toEqual([
      {
        type: "auth",
        client_id: "web-1",
        ingress_client_key: getIngressClientKey(),
      },
    ]);
    expect(await isSettled(connection)).toBe(false);

    ws.onmessage?.(AUTH_OK);

    expect(await isSettled(connection)).toBe(true);
  });

  it("announces the web player with the token outside Ingress", async () => {
    mockStore.isIngressSession = false;
    const { connection, ws } = openProxyConnection();

    expect(ws.sent).toEqual([
      { type: "auth", token: "test-token", client_id: "web-1" },
    ]);

    ws.onmessage?.(AUTH_OK);

    expect(await isSettled(connection)).toBe(true);
  });
});

/**
 * Start a Sendspin connection and open its proxy socket.
 */
function openProxyConnection() {
  const connection = createSendspinConnection();
  const ws = FakeWebSocket.instances.at(-1);
  if (!ws) throw new Error("no proxy socket was opened");
  ws.onopen?.();
  return { connection, ws };
}

/**
 * Return whether the promise settled once pending callbacks ran.
 */
async function isSettled(promise: Promise<unknown>): Promise<boolean> {
  let settled = false;
  void promise.then(() => (settled = true));
  await new Promise((resolve) => setTimeout(resolve));
  return settled;
}
