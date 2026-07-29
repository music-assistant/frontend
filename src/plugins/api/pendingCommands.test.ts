import { describe, expect, it, vi } from "vitest";
import { ConnectionState, MusicAssistantApi } from "./index";

type FakeTransport = {
  send: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
  on: (event: string, handler: (payload: unknown) => void) => void;
  emit: (event: string, payload: unknown) => void;
};

const makeTransport = (): FakeTransport => {
  const handlers: Record<string, (payload: unknown) => void> = {};
  return {
    send: vi.fn(),
    disconnect: vi.fn(),
    on: (event, handler) => {
      handlers[event] = handler;
    },
    emit: (event, payload) => handlers[event]?.(payload),
  };
};

/** Resolves to "pending" when the promise has not settled within a tick. */
const outcomeOf = (promise: Promise<unknown>) => {
  const pending = Symbol("pending");
  return Promise.race([
    promise.then(
      () => "resolved",
      (err) => (err as Error)?.message ?? "rejected",
    ),
    new Promise((resolve) => setTimeout(() => resolve(pending), 20)),
  ]).then((outcome) => (outcome === pending ? "pending" : outcome));
};

const connectedApi = () => {
  const api = new MusicAssistantApi();
  api.state.value = ConnectionState.CONNECTED;
  const transport = makeTransport();
  // @ts-expect-error - inject a transport that accepts sends but never replies
  api.transport = transport;
  return { api, transport };
};

describe("commands in flight when the connection drops", () => {
  it("rejects them on an explicit disconnect", async () => {
    const { api } = connectedApi();
    const inFlight = api.sendCommand("ai_radio/stations/list");

    api.disconnect();

    expect(await outcomeOf(inFlight)).toBe("Connection lost");
  });

  it.each(["reconnecting", "failed", "disconnected"])(
    "rejects them when the transport goes %s",
    async (state) => {
      const { api } = connectedApi();
      const inFlight = api.sendCommand("ai_radio/stations/list");

      api["handleTransportStateChange"](state);

      expect(await outcomeOf(inFlight)).toBe("Connection lost");
    },
  );

  it("still resolves a command whose reply arrives normally", async () => {
    const { api } = connectedApi();
    const inFlight = api.sendCommand("ai_radio/stations/list");
    const messageId = [...api["commands"].keys()][0];

    api["handleResultMessage"]({
      message_id: messageId,
      result: [{ id: "show", name: "Show" }],
    } as never);

    expect(await outcomeOf(inFlight)).toBe("resolved");
  });
});
