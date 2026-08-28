/**
 * VisualizerRelayClient color handling: color payloads accumulate into a
 * merged palette that survives a reconnect, and is only dropped when the
 * player changes.
 */
import { VisualizerRelayClient } from "@/plugins/visualizer-relay";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/plugins/api", () => ({
  default: {
    baseUrl: "http://ma.local:8095",
    providers: {},
    isRemoteConnection: { value: false },
  },
}));

vi.mock("@/plugins/auth", () => ({
  authManager: { getToken: () => "test-token" },
}));

vi.mock("@/plugins/store", () => ({
  store: { isIngressSession: true },
}));

vi.mock("@/composables/visualizer/useVisualizerEngine", () => ({
  isVisualizerSupported: () => true,
}));

class FakeWebSocket {
  static OPEN = 1;
  static instances: FakeWebSocket[] = [];
  binaryType = "";
  readyState = 0;
  onopen: (() => void) | null = null;
  onmessage: ((event: { data: unknown }) => void) | null = null;
  onclose: ((event: { code?: number }) => void) | null = null;

  constructor(public url: string) {
    FakeWebSocket.instances.push(this);
  }

  send() {}
  close() {}
}

function connectClient(onColor: (palette: unknown) => void) {
  const client = new VisualizerRelayClient({ onColor }, "kitchen");
  client.connect();
  const ws = FakeWebSocket.instances.at(-1);
  if (!ws) throw new Error("relay opened no socket");
  const receive = (message: object) =>
    ws.onmessage?.({ data: JSON.stringify(message) });
  return { client, receive };
}

describe("VisualizerRelayClient color handling", () => {
  let client: VisualizerRelayClient | null = null;

  beforeEach(() => {
    vi.stubGlobal("WebSocket", FakeWebSocket);
    FakeWebSocket.instances = [];
  });

  afterEach(() => {
    client?.close();
    client = null;
    vi.unstubAllGlobals();
  });

  it("accumulates color payloads into a merged palette", () => {
    const onColor = vi.fn();
    let receive: (message: object) => void;
    ({ client, receive } = connectClient(onColor));

    receive({ type: "color", payload: { on_dark: [1, 2, 3] } });
    receive({ type: "color", payload: { on_light: [4, 5, 6] } });

    expect(onColor).toHaveBeenLastCalledWith({
      on_dark: [1, 2, 3],
      on_light: [4, 5, 6],
    });
  });

  it("nulls malformed palette values instead of forwarding them", () => {
    // onColor's type promises numeric 3-tuples or null; wire data that is
    // neither must not leak through to consumers trusting that contract.
    const onColor = vi.fn();
    let receive: (message: object) => void;
    ({ client, receive } = connectClient(onColor));

    receive({ type: "color", payload: { on_dark: [1, 2, 3] } });
    receive({
      type: "color",
      payload: { on_dark: [100, 180], on_light: "red", primary: [10, 20, 30] },
    });

    expect(onColor).toHaveBeenLastCalledWith({
      on_dark: null,
      on_light: null,
      primary: [10, 20, 30],
    });
  });
});
