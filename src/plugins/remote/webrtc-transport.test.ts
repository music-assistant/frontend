import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WebRTCTransport } from "./webrtc-transport";
import { MessageTooLargeError, TransportState } from "./transport";

/** Private members this suite drives. */
type TransportInternals = {
  scheduleReconnect(): void;
  reconnectAttempts: number;
  dataChannel: unknown;
  peerConnection: unknown;
  setupDataChannelHandlers(): void;
};

const makeTransport = () =>
  new WebRTCTransport({
    signalingServerUrl: "wss://example.invalid/signaling",
    remoteId: "test-remote-id",
  });

describe("WebRTCTransport.scheduleReconnect", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("retries immediately on the first attempt", () => {
    const transport = makeTransport();
    const connect = vi.fn().mockResolvedValue(undefined);
    transport.connect = connect;

    (transport as unknown as TransportInternals).scheduleReconnect();

    expect(transport.state).toBe(TransportState.RECONNECTING);
    vi.advanceTimersByTime(0);
    expect(connect).toHaveBeenCalledTimes(1);
  });

  it("backs off with jitter from the second attempt on", () => {
    // Pin the jitter to its minimum so the delay lands on an exact boundary:
    // 1000 * 1.5^1 * (0.5 + 0 * 0.5) = 750ms.
    vi.spyOn(Math, "random").mockReturnValue(0);

    const transport = makeTransport();
    const connect = vi.fn().mockResolvedValue(undefined);
    transport.connect = connect;
    (transport as unknown as TransportInternals).reconnectAttempts = 1;

    (transport as unknown as TransportInternals).scheduleReconnect();

    expect(transport.state).toBe(TransportState.RECONNECTING);
    vi.advanceTimersByTime(749);
    expect(connect).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(connect).toHaveBeenCalledTimes(1);
  });
});

describe("WebRTCTransport.send chunking", () => {
  const CHUNK_SIZE = 64 * 1024;
  const CHUNK_OVERHEAD = 128;
  const INBOUND_MAX_BYTES = 4 * 1024 * 1024;
  const FRAME_KEYS = ["b64", "count", "id", "seq", "type"];

  interface ChunkFrame {
    type: string;
    id: number;
    seq: number;
    count: number;
    b64: string;
  }

  const pieceSizeFor = (limit: number) =>
    Math.min(CHUNK_SIZE, Math.floor((limit - CHUNK_OVERHEAD) / 4) * 3);

  const setup = (maxMessageSize: number | null = CHUNK_SIZE) => {
    const transport = makeTransport();
    const internals = transport as unknown as TransportInternals;
    const send = vi.fn();
    internals.dataChannel = { readyState: "open", send };
    internals.peerConnection = {
      sctp: maxMessageSize === null ? null : { maxMessageSize },
    };
    return { transport, internals, send };
  };

  const sentFrames = (send: ReturnType<typeof vi.fn>): ChunkFrame[] =>
    send.mock.calls.map(([frame]) => JSON.parse(frame as string));

  const byteLength = (text: string) => new TextEncoder().encode(text).length;

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("passes a small message through untouched", () => {
    const { transport, send } = setup();
    const message = JSON.stringify({ command: "players/all" });

    transport.send(message);

    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith(message);
  });

  it("passes exactly the limit through and chunks one byte more", () => {
    const { transport, send } = setup();

    transport.send("a".repeat(CHUNK_SIZE));
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith("a".repeat(CHUNK_SIZE));

    send.mockClear();
    transport.send("a".repeat(CHUNK_SIZE + 1));
    expect(sentFrames(send)[0].type).toBe("__chunk__");
  });

  it("compares bytes rather than string length", () => {
    const { transport, send } = setup();
    // 2 bytes per character: under the limit as a string, over it as bytes
    const message = "\u00e9".repeat(CHUNK_SIZE / 2 + 1);
    expect(message.length).toBeLessThan(CHUNK_SIZE);
    expect(byteLength(message)).toBeGreaterThan(CHUNK_SIZE);

    transport.send(message);

    expect(sentFrames(send)[0].type).toBe("__chunk__");
  });

  it("splits a large message into well-formed frames", () => {
    const { transport, send } = setup();
    const message = "x".repeat(CHUNK_SIZE * 3);

    transport.send(message);

    const frames = sentFrames(send);
    const pieceSize = pieceSizeFor(CHUNK_SIZE);
    const expectedCount = Math.ceil(message.length / pieceSize);
    expect(frames).toHaveLength(expectedCount);
    frames.forEach((frame, index) => {
      expect(Object.keys(frame).sort()).toEqual(FRAME_KEYS);
      expect(frame.type).toBe("__chunk__");
      expect(frame.seq).toBe(index);
      expect(frame.count).toBe(expectedCount);
      expect(frame.id).toBe(frames[0].id);
    });
    for (const [frame] of send.mock.calls) {
      expect(byteLength(frame as string)).toBeLessThanOrEqual(CHUNK_SIZE);
    }
  });

  it("round-trips through the reassembly path with multi-byte text", () => {
    const { transport, internals, send } = setup();
    // 3-byte and 4-byte characters guarantee pieces split mid-character
    const message = "a\u20ac\u{1F3B5}".repeat(40000);
    const received: string[] = [];
    transport.on("message", (data) => received.push(data));
    internals.setupDataChannelHandlers();
    const channel = internals.dataChannel as {
      onmessage: (event: { data: string }) => void;
    };

    transport.send(message);
    for (const [frame] of send.mock.calls) {
      channel.onmessage({ data: frame as string });
    }

    expect(sentFrames(send).length).toBeGreaterThan(1);
    expect(received).toEqual([message]);
  });

  it("follows sctp.maxMessageSize when it is below the cap", () => {
    const limit = 16 * 1024;
    const { transport, send } = setup(limit);
    const message = "x".repeat(limit * 3);

    transport.send(message);

    const frames = sentFrames(send);
    const pieceSize = pieceSizeFor(limit);
    expect(frames[0].count).toBe(Math.ceil(message.length / pieceSize));
    for (const [frame] of send.mock.calls) {
      expect(byteLength(frame as string)).toBeLessThanOrEqual(limit);
    }
  });

  it("sends whole up to a channel limit above 64 KiB and chunks only beyond it", () => {
    const limit = 256 * 1024;
    const { transport, send } = setup(limit);

    transport.send("a".repeat(limit));
    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith("a".repeat(limit));

    send.mockClear();
    transport.send("a".repeat(limit + 1));
    const frames = sentFrames(send);
    expect(frames[0].type).toBe("__chunk__");
    expect(frames[0].count).toBe(Math.ceil((limit + 1) / pieceSizeFor(limit)));
    for (const [frame] of send.mock.calls) {
      expect(byteLength(frame as string)).toBeLessThanOrEqual(limit);
    }
  });

  it("never chunks when the channel reports no limit", () => {
    const { transport, send } = setup(Infinity);
    const message = "a".repeat(CHUNK_SIZE * 16);

    transport.send(message);

    expect(send).toHaveBeenCalledTimes(1);
    expect(send).toHaveBeenCalledWith(message);
  });

  it("falls back to 64 KiB when sctp is not available", () => {
    const { transport, send } = setup(null);

    transport.send("a".repeat(CHUNK_SIZE));
    expect(send).toHaveBeenCalledTimes(1);

    send.mockClear();
    transport.send("a".repeat(CHUNK_SIZE + 1));
    expect(sentFrames(send)[0].type).toBe("__chunk__");
  });

  it("uses a different group id for each chunked message", () => {
    const { transport, send } = setup();
    const message = "x".repeat(CHUNK_SIZE * 2);

    transport.send(message);
    transport.send(message);

    const ids = new Set(sentFrames(send).map((frame) => frame.id));
    expect(ids.size).toBe(2);
  });

  it("refuses a message at the gateway's size cap", () => {
    const { transport, send } = setup();

    expect(() => transport.send("x".repeat(INBOUND_MAX_BYTES))).toThrow(
      MessageTooLargeError,
    );
    expect(send).not.toHaveBeenCalled();

    transport.send("x".repeat(INBOUND_MAX_BYTES - 1));
    expect(send).toHaveBeenCalled();
  });
});
