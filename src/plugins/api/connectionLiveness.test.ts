import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { toast } from "vue-sonner";
import {
  ConnectionLostError,
  ConnectionState,
  MusicAssistantApi,
} from "./index";
import { WebSocketTransport } from "../remote/websocket-transport";

class FakeWebSocket {
  static OPEN = 1;
  static instances: FakeWebSocket[] = [];
  readyState = 0;
  onopen: (() => void) | null = null;
  onclose: ((event: { reason: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  onmessage: ((event: { data: string }) => void) | null = null;
  sent: Array<{ command: string; message_id: string }> = [];
  constructor(_url: string) {
    FakeWebSocket.instances.push(this);
  }
  open() {
    this.readyState = FakeWebSocket.OPEN;
    this.onopen?.();
  }
  send(data: string) {
    this.sent.push(JSON.parse(data));
  }
  reply(command: string, result: unknown) {
    const message = this.sent.findLast((entry) => entry.command === command);
    if (!message) throw new Error(`Missing ${command} command`);
    this.onmessage?.({
      data: JSON.stringify({ message_id: message.message_id, result }),
    });
  }
  errorReply(command: string) {
    const message = this.sent.findLast((entry) => entry.command === command);
    if (!message) throw new Error(`Missing ${command} command`);
    this.onmessage?.({
      data: JSON.stringify({
        message_id: message.message_id,
        error_code: 403,
        details: "Denied",
      }),
    });
  }
  close() {
    this.readyState = 3;
    this.onclose?.({ reason: "closed" });
  }
}

const serverInfo = { server_id: "test", server_version: "test" };
const originalVisibility = Object.getOwnPropertyDescriptor(
  document,
  "visibilityState",
);
async function connectedApi() {
  const api = new MusicAssistantApi();
  const connecting = api.initialize("http://localhost:8095");
  const socket = FakeWebSocket.instances.at(-1)!;
  socket.open();
  socket.onmessage?.({ data: JSON.stringify(serverInfo) });
  await connecting;
  return { api, socket };
}

beforeEach(() => {
  vi.useFakeTimers();
  Object.defineProperty(document, "visibilityState", {
    configurable: true,
    value: "visible",
  });
  FakeWebSocket.instances = [];
  vi.stubGlobal("WebSocket", FakeWebSocket);
});
afterEach(() => {
  if (originalVisibility)
    Object.defineProperty(document, "visibilityState", originalVisibility);
  vi.restoreAllMocks();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("local WebSocket liveness", () => {
  it("recovers a silent open socket, rejects pending work, and ignores late old-socket messages", async () => {
    const { api, socket } = await connectedApi();
    const pending = api.sendCommand("music/tracks/library_items");
    const rejection =
      expect(pending).rejects.toBeInstanceOf(ConnectionLostError);
    await vi.advanceTimersByTimeAsync(45_000);
    expect(socket.sent.some((entry) => entry.command === "time")).toBe(true);
    expect(api.state.value).toBe(ConnectionState.RECONNECTING);
    await rejection;
    await vi.advanceTimersByTimeAsync(1_000);
    expect(FakeWebSocket.instances).toHaveLength(2);
    socket.onmessage?.({ data: JSON.stringify(serverInfo) });
    socket.onopen?.();
    socket.onclose?.({ reason: "late close" });
    expect(api.state.value).toBe(ConnectionState.RECONNECTING);
    expect(FakeWebSocket.instances).toHaveLength(2);
    const replacement = FakeWebSocket.instances[1];
    replacement.open();
    replacement.onmessage?.({ data: JSON.stringify(serverInfo) });
    expect(api.state.value).toBe(ConnectionState.CONNECTED);
    api.disconnect();
  });

  it("keeps a healthy connection when time replies, without timing out slow ordinary commands", async () => {
    const { api, socket } = await connectedApi();
    const pending = api.sendCommand("music/tracks/library_items");
    await vi.advanceTimersByTimeAsync(30_000);
    socket.reply("time", Date.now() / 1000);
    await vi.advanceTimersByTimeAsync(11_000);
    expect(api.state.value).toBe(ConnectionState.CONNECTED);
    socket.reply("music/tracks/library_items", []);
    await expect(pending).resolves.toEqual([]);
    api.disconnect();
  });

  it("checks immediately on wake, coalesces repeated events, and accepts server error replies as liveness", async () => {
    const { api, socket } = await connectedApi();
    window.dispatchEvent(new Event("focus"));
    window.dispatchEvent(new Event("online"));
    document.dispatchEvent(new Event("visibilitychange"));
    // Clock synchronization also sends an initial time request.
    expect(
      socket.sent.filter((entry) => entry.command === "time"),
    ).toHaveLength(2);
    socket.errorReply("time");
    await vi.advanceTimersByTimeAsync(11_000);
    expect(api.state.value).toBe(ConnectionState.CONNECTED);
    api.disconnect();
  });

  it("does not infer failure from a probe deadline while the page is hidden", async () => {
    const { api, socket } = await connectedApi();
    window.dispatchEvent(new Event("focus"));
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    });
    try {
      await vi.advanceTimersByTimeAsync(45_000);
      expect(api.state.value).toBe(ConnectionState.CONNECTED);
      expect(FakeWebSocket.instances).toHaveLength(1);
    } finally {
      if (originalVisibility)
        Object.defineProperty(document, "visibilityState", originalVisibility);
      socket.reply("time", Date.now() / 1000);
      api.disconnect();
    }
  });

  it("ignores retired wake-probe success and error replies without a global toast", async () => {
    const { api, socket } = await connectedApi();
    const errorToast = vi.spyOn(toast, "error");
    window.dispatchEvent(new Event("focus"));
    const oldId = socket.sent.at(-1)!.message_id;
    // Simulate elapsed monotonic time while timer callbacks were paused.
    vi.spyOn(performance, "now").mockReturnValue(11_000);
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    });
    document.dispatchEvent(new Event("visibilitychange"));
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
    document.dispatchEvent(new Event("visibilitychange"));
    const newId = socket.sent.at(-1)!.message_id;
    expect(newId).not.toBe(oldId);
    expect(api["commands"].has(oldId)).toBe(false);
    socket.onmessage?.({
      data: JSON.stringify({
        message_id: oldId,
        error_code: 403,
        details: "Old probe failed",
      }),
    });
    socket.onmessage?.({
      data: JSON.stringify({ message_id: oldId, result: 123 }),
    });
    expect(errorToast).not.toHaveBeenCalled();
    expect(api["connectionProbeId"]).toBe(newId);
    socket.onmessage?.({
      data: JSON.stringify({ message_id: newId, result: 123 }),
    });
    expect(api.state.value).toBe(ConnectionState.CONNECTED);
    expect(api["commands"].has(newId)).toBe(false);
    api.disconnect();
  });

  it("uses monotonic time when the wall clock moves backward before a delayed deadline", async () => {
    const { api, socket } = await connectedApi();
    const timeoutSpy = vi.spyOn(window, "setTimeout");
    window.dispatchEvent(new Event("focus"));
    const oldId = socket.sent.at(-1)!.message_id;
    const deadlineCallback = timeoutSpy.mock.calls.find(
      (call) => call[1] === 10_000,
    )?.[0];
    expect(deadlineCallback).toBeTypeOf("function");
    vi.spyOn(performance, "now").mockReturnValue(25_000);
    vi.setSystemTime(Date.now() - 60_000);
    // A throttled callback runs late even though wall time stepped backwards.
    (deadlineCallback as () => void)();
    expect(api.state.value).toBe(ConnectionState.CONNECTED);
    expect(api["connectionProbeId"]).not.toBe(oldId);
    socket.reply("time", 123);
    api.disconnect();
  });

  it("recovers after a second late unanswered visible probe despite repeated focus events", async () => {
    const { api, socket } = await connectedApi();
    const timeoutSpy = vi.spyOn(window, "setTimeout");
    const pending = api.sendCommand("music/tracks/library_items");
    const rejection =
      expect(pending).rejects.toBeInstanceOf(ConnectionLostError);
    window.dispatchEvent(new Event("focus"));
    const firstId = api["connectionProbeId"];
    const firstDeadline = timeoutSpy.mock.calls.find(
      (call) => call[1] === 10_000,
    )?.[0];
    expect(firstDeadline).toBeTypeOf("function");
    vi.spyOn(performance, "now").mockReturnValue(25_000);
    window.dispatchEvent(new Event("focus"));
    expect(api["connectionProbeId"]).toBe(firstId);
    (firstDeadline as () => void)();
    expect(api.state.value).toBe(ConnectionState.CONNECTED);
    const secondId = api["connectionProbeId"];
    expect(secondId).not.toBe(firstId);
    const secondDeadline = timeoutSpy.mock.calls
      .filter((call) => call[1] === 10_000)
      .at(-1)?.[0];
    vi.mocked(performance.now).mockReturnValue(50_000);
    window.dispatchEvent(new Event("focus"));
    expect(api["connectionProbeId"]).toBe(secondId);
    (secondDeadline as () => void)();
    expect(api.state.value).toBe(ConnectionState.RECONNECTING);
    await rejection;
    expect(socket.readyState).toBe(3);
    api.disconnect();
  });

  it("resets late-probe count on a healthy reply and on a known hide/resume", async () => {
    const { api, socket } = await connectedApi();
    const timeoutSpy = vi.spyOn(window, "setTimeout");
    const now = vi.spyOn(performance, "now").mockReturnValue(0);
    window.dispatchEvent(new Event("focus"));
    const firstDeadline = timeoutSpy.mock.calls.find(
      (call) => call[1] === 10_000,
    )?.[0];
    now.mockReturnValue(25_000);
    (firstDeadline as () => void)();
    expect(api["consecutiveLateConnectionProbes"]).toBe(1);
    const healthyId = api["connectionProbeId"];
    socket.onmessage?.({
      data: JSON.stringify({ message_id: healthyId, result: 123 }),
    });
    expect(api["consecutiveLateConnectionProbes"]).toBe(0);
    window.dispatchEvent(new Event("focus"));
    const oldId = api["connectionProbeId"];
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "hidden",
    });
    document.dispatchEvent(new Event("visibilitychange"));
    expect(api["connectionProbeId"]).toBeUndefined();
    expect(api["consecutiveLateConnectionProbes"]).toBe(0);
    Object.defineProperty(document, "visibilityState", {
      configurable: true,
      value: "visible",
    });
    document.dispatchEvent(new Event("visibilitychange"));
    expect(api["connectionProbeId"]).toBeDefined();
    expect(api["connectionProbeId"]).not.toBe(oldId);
    expect(api.state.value).toBe(ConnectionState.CONNECTED);
    expect(api["consecutiveLateConnectionProbes"]).toBe(0);
    socket.onmessage?.({
      data: JSON.stringify({
        message_id: api["connectionProbeId"],
        result: 123,
      }),
    });
    api.disconnect();
  });

  it("does not accumulate command entries over repeated healthy probe intervals", async () => {
    const { api, socket } = await connectedApi();
    for (let cycle = 0; cycle < 4; cycle++) {
      await vi.advanceTimersByTimeAsync(30_000);
      const activeId = api["connectionProbeId"];
      expect(activeId).toBeDefined();
      socket.onmessage?.({
        data: JSON.stringify({ message_id: activeId, result: 123 }),
      });
      expect(
        [...api["commands"].keys()].filter((id) =>
          id.startsWith(api["connectionProbePrefix"]!),
        ),
      ).toHaveLength(0);
      expect(api["connectionProbeId"]).toBeUndefined();
      expect(api.state.value).toBe(ConnectionState.CONNECTED);
    }
    api.disconnect();
    expect(api["commands"].size).toBe(0);
  });

  it("does not reconnect after manual disconnect", async () => {
    const { api } = await connectedApi();
    api.disconnect();
    await vi.advanceTimersByTimeAsync(90_000);
    expect(FakeWebSocket.instances).toHaveLength(1);
  });
});
