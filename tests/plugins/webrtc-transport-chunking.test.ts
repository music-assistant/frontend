import { describe, expect, it } from "vitest";

import { WebRTCTransport } from "../../src/plugins/remote/webrtc-transport";

type ProxyResult = {
  status: number;
  headers: Record<string, string>;
  body: Uint8Array;
};

// The chunk-reassembly logic lives on private methods; a thin cast keeps the test
// focused on behaviour without exposing internals on the public API.
type TransportInternals = {
  httpProxyCallbacks: Map<
    string,
    { resolve: (value: ProxyResult) => void; reject: (error: Error) => void }
  >;
  handleHttpProxyResponse: (data: {
    id: string;
    status: number;
    headers: Record<string, string>;
    body: string;
  }) => void;
  handleHttpProxyResponseStart: (data: {
    id: string;
    status: number;
    headers: Record<string, string>;
    chunks: number;
  }) => void;
  handleHttpProxyResponseChunk: (data: {
    id: string;
    index: number;
    body: string;
  }) => void;
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

describe("WebRTCTransport chunked http-proxy responses", () => {
  it("resolves a legacy single-message response", async () => {
    const transport = makeTransport();
    const result = pending(transport, "req-legacy");

    transport.handleHttpProxyResponse({
      id: "req-legacy",
      status: 200,
      headers: { "content-type": "image/png" },
      body: toHex([1, 2, 3, 4]),
    });

    const { status, headers, body } = await result;
    expect(status).toBe(200);
    expect(headers).toEqual({ "content-type": "image/png" });
    expect(Array.from(body)).toEqual([1, 2, 3, 4]);
  });

  it("reassembles a chunked response into the original body", async () => {
    const transport = makeTransport();
    const result = pending(transport, "req-chunked");

    transport.handleHttpProxyResponseStart({
      id: "req-chunked",
      status: 200,
      headers: { "content-type": "image/jpeg" },
      chunks: 3,
    });
    transport.handleHttpProxyResponseChunk({ id: "req-chunked", index: 0, body: toHex([10, 11]) });
    transport.handleHttpProxyResponseChunk({ id: "req-chunked", index: 1, body: toHex([20, 21]) });
    transport.handleHttpProxyResponseChunk({ id: "req-chunked", index: 2, body: toHex([30]) });

    const { status, headers, body } = await result;
    expect(status).toBe(200);
    expect(headers).toEqual({ "content-type": "image/jpeg" });
    expect(Array.from(body)).toEqual([10, 11, 20, 21, 30]);
  });

  it("reassembles correctly when chunks arrive out of order", async () => {
    const transport = makeTransport();
    const result = pending(transport, "req-ooo");

    transport.handleHttpProxyResponseStart({
      id: "req-ooo",
      status: 200,
      headers: {},
      chunks: 3,
    });
    transport.handleHttpProxyResponseChunk({ id: "req-ooo", index: 2, body: toHex([3]) });
    transport.handleHttpProxyResponseChunk({ id: "req-ooo", index: 0, body: toHex([1]) });
    transport.handleHttpProxyResponseChunk({ id: "req-ooo", index: 1, body: toHex([2]) });

    const { body } = await result;
    expect(Array.from(body)).toEqual([1, 2, 3]);
  });

  it("ignores chunks for an unknown request id", () => {
    const transport = makeTransport();
    expect(() =>
      transport.handleHttpProxyResponseChunk({ id: "nope", index: 0, body: toHex([1]) }),
    ).not.toThrow();
  });
});
