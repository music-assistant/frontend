import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { WebRTCTransport } from "./webrtc-transport";
import { TransportState } from "./transport";

/** Exposes the private members this suite exercises without `any` sprinkled everywhere. */
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
    const transport = makeTransport();
    const connect = vi.fn().mockResolvedValue(undefined);
    transport.connect = connect;
    (transport as unknown as TransportInternals).reconnectAttempts = 1;

    (transport as unknown as TransportInternals).scheduleReconnect();

    expect(transport.state).toBe(TransportState.RECONNECTING);
    // second attempt delay is 1000 * 1.5^1 * jitter(0.5..1) => 750-1500ms
    vi.advanceTimersByTime(0);
    expect(connect).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1500);
    expect(connect).toHaveBeenCalledTimes(1);
  });
});
