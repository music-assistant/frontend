import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WebRTCTransport } from "./webrtc-transport";
import { TransportState } from "./transport";

/** Private members this suite drives. */
type TransportInternals = {
  scheduleReconnect(): void;
  reconnectAttempts: number;
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
