import { resetServerTime, serverNow } from "@/composables/useServerTime";
import { MusicAssistantApi } from "@/plugins/api";
import { BaseTransport, TransportState } from "@/plugins/remote/transport";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The server clock runs 45 seconds behind this device's.
const DEVICE_NOW_MS = Date.parse("2026-01-01T00:00:45Z");
const SERVER_CLOCK_ERROR_SECONDS = 45;

/** Transport that replies to `time` and records every command the client sends. */
class FakeTransport extends BaseTransport {
  public commands: string[] = [];

  constructor(private schemaVersion: number) {
    super();
  }

  async connect(): Promise<void> {
    this.setState(TransportState.CONNECTED);
    this.emit("open");
    this.emit(
      "message",
      JSON.stringify({
        server_id: "test-server",
        server_version: "2.99.0",
        schema_version: this.schemaVersion,
        min_supported_schema_version: 28,
        base_url: "http://localhost:8095",
      }),
    );
  }

  disconnect(): void {
    this.setState(TransportState.DISCONNECTED);
  }

  send(data: string): void {
    const msg = JSON.parse(data) as { message_id: string; command: string };
    this.commands.push(msg.command);
    if (msg.command !== "time") return;
    this.emit(
      "message",
      JSON.stringify({
        message_id: msg.message_id,
        result: Date.now() / 1000 - SERVER_CLOCK_ERROR_SECONDS,
      }),
    );
  }
}

describe("api server time sync", () => {
  let api: MusicAssistantApi;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(DEVICE_NOW_MS);
    api = new MusicAssistantApi();
  });

  afterEach(() => {
    api.disconnect();
    resetServerTime();
    vi.useRealTimers();
  });

  it("corrects the clock offset after connecting to a server that reports its time", async () => {
    const transport = new FakeTransport(42);
    await api.initialize(transport);
    await vi.advanceTimersByTimeAsync(0);

    expect(api.supportsServerTime).toBe(true);
    expect(transport.commands).toContain("time");
    expect(serverNow()).toBeCloseTo(
      Date.now() / 1000 - SERVER_CLOCK_ERROR_SECONDS,
      3,
    );
  });

  it("leaves the device clock alone on a server without the time command", async () => {
    const transport = new FakeTransport(41);
    await api.initialize(transport);
    await vi.advanceTimersByTimeAsync(0);

    expect(api.supportsServerTime).toBe(false);
    expect(transport.commands).not.toContain("time");
    expect(serverNow()).toBeCloseTo(Date.now() / 1000, 6);
  });
});
