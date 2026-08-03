import { resetServerTime, serverNow } from "@/composables/useServerTime";
import { MusicAssistantApi } from "@/plugins/api";
import { BaseTransport, TransportState } from "@/plugins/remote/transport";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// The server clock runs 45 seconds behind this device's.
const DEVICE_NOW_MS = Date.parse("2026-01-01T00:00:45Z");
const SERVER_CLOCK_ERROR_SECONDS = 45;

/** Transport that answers `time` and records every command the client sends. */
class FakeTransport extends BaseTransport {
  public commands: string[] = [];

  constructor(private failsTimeCommand = false) {
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
        schema_version: 42,
        min_supported_schema_version: 28,
        base_url: "http://localhost:8095",
      }),
    );
  }

  disconnect(): void {
    this.setState(TransportState.DISCONNECTED);
  }

  fail(): void {
    this.setState(TransportState.FAILED);
  }

  send(data: string): void {
    const msg = JSON.parse(data) as { message_id: string; command: string };
    this.commands.push(msg.command);
    if (msg.command !== "time") return;
    this.emit(
      "message",
      JSON.stringify(
        this.failsTimeCommand
          ? {
              message_id: msg.message_id,
              error_code: "invalid_command",
              details: "Invalid command: time",
            }
          : {
              message_id: msg.message_id,
              result: Date.now() / 1000 - SERVER_CLOCK_ERROR_SECONDS,
            },
      ),
    );
  }
}

describe("api server time sync", () => {
  let api: MusicAssistantApi;

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(DEVICE_NOW_MS);
    // vitest does not fake performance.now(), which the offset estimate is anchored on
    vi.spyOn(performance, "now").mockReturnValue(1000);
    api = new MusicAssistantApi();
  });

  afterEach(() => {
    api.disconnect();
    resetServerTime();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it("corrects the clock offset after connecting", async () => {
    const transport = new FakeTransport();
    await api.initialize(transport);
    await vi.advanceTimersByTimeAsync(0);

    expect(transport.commands).toContain("time");
    expect(serverNow()).toBeCloseTo(
      Date.now() / 1000 - SERVER_CLOCK_ERROR_SECONDS,
      3,
    );
  });

  it("stops probing once the connection has failed for good", async () => {
    const transport = new FakeTransport();
    // a probe on a dead connection cannot succeed and leaves a pending command behind
    const probe = vi.spyOn(api, "getServerTime");
    await api.initialize(transport);
    await vi.advanceTimersByTimeAsync(0);

    transport.fail();
    await vi.advanceTimersByTimeAsync(100);
    const probesWhenFailed = probe.mock.calls.length;
    // long enough for several refresh rounds, which would each probe again
    await vi.advanceTimersByTimeAsync(5 * 60_000);

    expect(probe).toHaveBeenCalledTimes(probesWhenFailed);
  });

  it("leaves the device clock alone when the server cannot report its time", async () => {
    const transport = new FakeTransport(true);
    await api.initialize(transport);
    await vi.advanceTimersByTimeAsync(0);

    expect(transport.commands).toContain("time");
    expect(serverNow()).toBeCloseTo(Date.now() / 1000, 6);
  });
});
