import { describe, expect, it } from "vitest";

import { WebRTCTransport } from "../../src/plugins/remote/webrtc-transport";

type ProxyResult = {
  status: number;
  headers: Record<string, string>;
  body: Uint8Array;
};

// The reassembly logic lives on private methods; a thin cast keeps the test focused on
// behaviour without widening the public API.
type TransportInternals = {
  httpProxyCallbacks: Map<
    string,
    { resolve: (value: ProxyResult) => void; reject: (error: Error) => void }
  >;
  dispatchMessage: (data: string) => void;
  handleChunk: (frame: { id: number; seq: number; count: number; b64: string }) => void;
  on: (event: string, cb: (...args: unknown[]) => void) => void;
};

function makeTransport(): TransportInternals {
  const transport = new WebRTCTransport({
    signalingServerUrl: "wss://example.invalid/ws",
    remoteId: "TEST-REMOTE-ID",
  });
  return transport as unknown as TransportInternals;
}

function pending(transport: TransportInternals, id: string): Promise<ProxyResult> {
  return new Promise<ProxyResult>((resolve, reject) => {
    transport.httpProxyCallbacks.set(id, { resolve, reject });
  });
}

function toHex(bytes: number[]): string {
  return bytes.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Build "__chunk__" frames exactly as the server does: UTF-8 bytes -> byte slices -> base64.
function makeChunks(text: string, id: number, pieceBytes = 8) {
  const bytes = new TextEncoder().encode(text);
  const count = Math.max(1, Math.ceil(bytes.length / pieceBytes));
  const frames: { type: "__chunk__"; id: number; seq: number; count: number; b64: string }[] = [];
  for (let seq = 0; seq < count; seq++) {
    const slice = bytes.slice(seq * pieceBytes, (seq + 1) * pieceBytes);
    let binary = "";
    slice.forEach((b) => (binary += String.fromCharCode(b)));
    frames.push({ type: "__chunk__", id, seq, count, b64: btoa(binary) });
  }
  return frames;
}

describe("WebRTCTransport chunk reassembly", () => {
  it("resolves a whole (unchunked) http-proxy-response", async () => {
    const transport = makeTransport();
    const result = pending(transport, "req-1");

    transport.dispatchMessage(
      JSON.stringify({
        type: "http-proxy-response",
        id: "req-1",
        status: 200,
        headers: { "content-type": "image/png" },
        body: toHex([1, 2, 3, 4]),
      }),
    );

    const { status, headers, body } = await result;
    expect(status).toBe(200);
    expect(headers).toEqual({ "content-type": "image/png" });
    expect(Array.from(body)).toEqual([1, 2, 3, 4]);
  });

  it("reassembles a chunked http-proxy-response and resolves it", async () => {
    const transport = makeTransport();
    const result = pending(transport, "req-2");
    const msg = JSON.stringify({
      type: "http-proxy-response",
      id: "req-2",
      status: 200,
      headers: {},
      body: toHex([9, 8, 7, 6, 5, 4, 3, 2, 1, 0]),
    });

    for (const frame of makeChunks(msg, 42)) transport.handleChunk(frame);

    const { body } = await result;
    expect(Array.from(body)).toEqual([9, 8, 7, 6, 5, 4, 3, 2, 1, 0]);
  });

  it("reassembles chunks that arrive out of order", async () => {
    const transport = makeTransport();
    const result = pending(transport, "req-3");
    const msg = JSON.stringify({
      type: "http-proxy-response",
      id: "req-3",
      status: 200,
      headers: {},
      body: toHex([1, 2, 3, 4, 5, 6, 7, 8]),
    });

    for (const frame of [...makeChunks(msg, 7)].reverse()) transport.handleChunk(frame);

    const { body } = await result;
    expect(Array.from(body)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it("emits a reassembled non-proxy message as a normal message event", () => {
    const transport = makeTransport();
    const received: unknown[] = [];
    transport.on("message", (m) => received.push(m));

    const msg = JSON.stringify({ command: "players/all", message_id: 1 });
    for (const frame of makeChunks(msg, 99)) transport.handleChunk(frame);

    expect(received).toEqual([msg]);
  });

  it("reassembles multibyte payloads split across byte boundaries", () => {
    const transport = makeTransport();
    const received: unknown[] = [];
    transport.on("message", (m) => received.push(m));

    const msg = JSON.stringify({ name: "音楽ライブラリ".repeat(5) });
    // pieceBytes = 5 forces slices to fall inside 3-byte characters
    for (const frame of makeChunks(msg, 5, 5)) transport.handleChunk(frame);

    expect(received).toEqual([msg]);
  });

  it("does not throw on an unknown/duplicate chunk", () => {
    const transport = makeTransport();
    expect(() =>
      transport.handleChunk({ id: 123, seq: 0, count: 2, b64: btoa("x") }),
    ).not.toThrow();
  });
});
