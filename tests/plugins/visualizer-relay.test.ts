/**
 * VisualizerRelayClient color handling.
 *
 * Color payloads accumulate into a merged palette, and a stream/start that no
 * longer advertises the "color" type (color_tint disabled server-side) must
 * drop the palette a canvas kept across the reconnect, or the stale tint
 * would paint until the player changes.
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

  it("drops the palette when stream/start no longer advertises color", () => {
    const onColor = vi.fn();
    let receive: (message: object) => void;
    ({ client, receive } = connectClient(onColor));

    receive({ type: "color", payload: { on_dark: [1, 2, 3] } });
    receive({
      type: "stream/start",
      payload: { visualizer: { types: ["waveform", "beat"] } },
    });

    expect(onColor).toHaveBeenLastCalledWith({});
  });

  it("keeps the palette when stream/start advertises color", () => {
    const onColor = vi.fn();
    let receive: (message: object) => void;
    ({ client, receive } = connectClient(onColor));

    receive({ type: "color", payload: { on_dark: [1, 2, 3] } });
    receive({
      type: "stream/start",
      payload: { visualizer: { types: ["waveform", "beat", "color"] } },
    });

    expect(onColor).toHaveBeenCalledTimes(1);
  });

  it("keeps the palette on a stream/start without advertised types", () => {
    // Older servers don't send the visualizer types; absence of the list must
    // not read as "color unsupported".
    const onColor = vi.fn();
    let receive: (message: object) => void;
    ({ client, receive } = connectClient(onColor));

    receive({ type: "color", payload: { on_dark: [1, 2, 3] } });
    receive({ type: "stream/start" });

    expect(onColor).toHaveBeenCalledTimes(1);
  });
});
