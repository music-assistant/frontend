import { describe, expect, it } from "vitest";

import { WebRTCTransport } from "../../src/plugins/remote/webrtc-transport";

// Stands in for an RTCDataChannel: records what the transport sends and lets a test push
// messages back in.
class FakeDataChannel {
  readyState: RTCDataChannelState = "connecting";
  sent: string[] = [];
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onerror: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;

  constructor(readonly label: string) {}

  send(data: string): void {
    this.sent.push(data);
  }

  open(): void {
    this.readyState = "open";
    this.onopen?.();
  }

  close(): void {
    this.readyState = "closed";
    this.onclose?.();
  }

  receive(data: string): void {
    this.onmessage?.({ data });
  }
}

// The channel wiring lives on private members; a thin cast keeps the tests focused on
// behaviour without widening the public API.
type TransportInternals = {
  peerConnection: unknown;
  dataChannel: FakeDataChannel | null;
  httpProxyChannel: FakeDataChannel | null;
  chunkGroups: Map<number, unknown>;
  setupDataChannelHandlers: () => void;
};

function makeTransport() {
  const transport = new WebRTCTransport({
    signalingServerUrl: "wss://example.invalid/ws",
    remoteId: "TEST-REMOTE-ID",
  });
  const internals = transport as unknown as TransportInternals;
  const channels: FakeDataChannel[] = [];

  const apiChannel = new FakeDataChannel("ma-api");
  apiChannel.readyState = "open";
  internals.peerConnection = {
    connectionState: "connected",
    close: () => {},
    createDataChannel: (label: string) => {
      const channel = new FakeDataChannel(label);
      channels.push(channel);
      // a real channel opens a moment after it is created
      queueMicrotask(() => channel.open());
      return channel;
    },
  };
  internals.dataChannel = apiChannel;
  internals.setupDataChannelHandlers();

  return { transport, internals, apiChannel, channels };
}

// Yields a macrotask so the channel negotiation triggered by server_info can settle.
function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function serverInfo(schemaVersion: number): string {
  return JSON.stringify({
    server_id: "test-server",
    server_version: "2.9.0",
    schema_version: schemaVersion,
    min_supported_schema_version: 28,
    base_url: "http://localhost:8095",
    homeassistant_addon: false,
    onboard_done: true,
    name: "Test server",
    status: "running",
  });
}

function proxyResponse(id: string, body: number[]): string {
  return JSON.stringify({
    type: "http-proxy-response",
    id,
    status: 200,
    headers: { "content-type": "image/png" },
    body: body.map((b) => b.toString(16).padStart(2, "0")).join(""),
  });
}

function sentRequestId(channel: FakeDataChannel): string {
  return JSON.parse(channel.sent[0]).id;
}

// Split a message into "__chunk__" frames the way the server does.
function makeChunks(text: string, id: number, pieceBytes = 8): string[] {
  const bytes = new TextEncoder().encode(text);
  const count = Math.max(1, Math.ceil(bytes.length / pieceBytes));
  const frames: string[] = [];
  for (let seq = 0; seq < count; seq++) {
    const slice = bytes.slice(seq * pieceBytes, (seq + 1) * pieceBytes);
    let binary = "";
    slice.forEach((b) => (binary += String.fromCharCode(b)));
    frames.push(
      JSON.stringify({ type: "__chunk__", id, seq, count, b64: btoa(binary) }),
    );
  }
  return frames;
}

describe("WebRTCTransport http_proxy channel", () => {
  it("keeps proxied requests on the API channel for a server that predates it", async () => {
    const { transport, apiChannel, channels } = makeTransport();

    apiChannel.receive(serverInfo(48));
    await flush();

    expect(channels).toEqual([]);

    const response = transport.sendHttpProxyRequest("GET", "/imageproxy?p=1");
    expect(JSON.parse(apiChannel.sent[0])).toMatchObject({
      type: "http-proxy-request",
      method: "GET",
      path: "/imageproxy?p=1",
    });

    apiChannel.receive(proxyResponse(sentRequestId(apiChannel), [1, 2, 3]));
    await expect(response).resolves.toMatchObject({ status: 200 });
  });

  it("sends proxied requests on the dedicated channel and resolves its responses", async () => {
    const { transport, internals, apiChannel, channels } = makeTransport();

    apiChannel.receive(serverInfo(49));
    await flush();

    expect(channels.map((channel) => channel.label)).toEqual(["http_proxy"]);
    const proxyChannel = channels[0];
    expect(internals.httpProxyChannel).toBe(proxyChannel);

    const response = transport.sendHttpProxyRequest("GET", "/imageproxy?p=1");
    expect(apiChannel.sent).toEqual([]);
    expect(JSON.parse(proxyChannel.sent[0])).toMatchObject({
      type: "http-proxy-request",
      path: "/imageproxy?p=1",
    });

    proxyChannel.receive(
      proxyResponse(sentRequestId(proxyChannel), [1, 2, 3, 4]),
    );
    const { status, body } = await response;
    expect(status).toBe(200);
    expect(Array.from(body)).toEqual([1, 2, 3, 4]);
  });

  it("negotiates the dedicated channel only once per connection", async () => {
    const { apiChannel, channels } = makeTransport();

    apiChannel.receive(serverInfo(49));
    apiChannel.receive(serverInfo(49));
    await flush();

    expect(channels).toHaveLength(1);
  });

  it("reassembles a chunked response that arrives on the dedicated channel", async () => {
    const { transport, apiChannel, channels } = makeTransport();

    apiChannel.receive(serverInfo(49));
    await flush();
    const proxyChannel = channels[0];

    const response = transport.sendHttpProxyRequest("GET", "/imageproxy?p=1");
    const message = proxyResponse(
      sentRequestId(proxyChannel),
      [9, 8, 7, 6, 5, 4, 3, 2, 1, 0],
    );
    for (const frame of makeChunks(message, 42)) proxyChannel.receive(frame);

    const { body } = await response;
    expect(Array.from(body)).toEqual([9, 8, 7, 6, 5, 4, 3, 2, 1, 0]);
  });

  it("falls back to the API channel once the dedicated channel closes", async () => {
    const { transport, internals, apiChannel, channels } = makeTransport();

    apiChannel.receive(serverInfo(49));
    await flush();

    channels[0].close();
    expect(internals.httpProxyChannel).toBeNull();

    const response = transport.sendHttpProxyRequest("GET", "/imageproxy?p=1");
    expect(JSON.parse(apiChannel.sent[0])).toMatchObject({
      type: "http-proxy-request",
    });

    apiChannel.receive(proxyResponse(sentRequestId(apiChannel), [5]));
    await expect(response).resolves.toMatchObject({ status: 200 });
  });

  it("drops half-received chunks when the dedicated channel closes", async () => {
    const { transport, internals, apiChannel, channels } = makeTransport();

    apiChannel.receive(serverInfo(49));
    await flush();
    const proxyChannel = channels[0];

    void transport.sendHttpProxyRequest("GET", "/imageproxy?p=1");
    const frames = makeChunks(
      proxyResponse(sentRequestId(proxyChannel), [1, 2, 3, 4, 5, 6, 7, 8]),
      42,
    );
    // the channel drops with the response only partly delivered
    proxyChannel.receive(frames[0]);
    expect(internals.chunkGroups.size).toBe(1);

    proxyChannel.close();

    expect(internals.chunkGroups.size).toBe(0);
  });

  it("never emits a message that arrives on the dedicated channel", async () => {
    const { transport, apiChannel, channels } = makeTransport();
    const received: string[] = [];
    transport.on("message", (data) => received.push(data));

    apiChannel.receive(serverInfo(49));
    await flush();
    expect(received).toEqual([serverInfo(49)]);

    channels[0].receive(
      JSON.stringify({ command: "players/all", message_id: 1 }),
    );
    expect(received).toEqual([serverInfo(49)]);
  });

  it("closes the dedicated channel when the transport is torn down", async () => {
    const { transport, internals, apiChannel, channels } = makeTransport();

    apiChannel.receive(serverInfo(49));
    await flush();
    const proxyChannel = channels[0];

    transport.disconnect();

    expect(proxyChannel.readyState).toBe("closed");
    expect(internals.httpProxyChannel).toBeNull();
  });
});
