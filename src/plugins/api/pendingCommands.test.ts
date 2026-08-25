import { describe, expect, it, vi } from "vitest";
import {
  ConnectionLostError,
  ConnectionState,
  MusicAssistantApi,
} from "./index";

type FakeTransport = {
  send: ReturnType<typeof vi.fn>;
  disconnect: ReturnType<typeof vi.fn>;
};

const makeTransport = (): FakeTransport => ({
  send: vi.fn(),
  disconnect: vi.fn(),
});

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

    await expect(inFlight).rejects.toBeInstanceOf(ConnectionLostError);
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

  it("keeps a reconnecting session out of AUTH_REQUIRED when re-auth is cut off", async () => {
    const { api } = connectedApi();
    const reauth = api
      .authenticateWithToken("stored-token")
      .catch(() => undefined);

    // the transport dies again before the auth reply arrives
    api["handleTransportStateChange"]("disconnected");
    api["handleTransportStateChange"]("reconnecting");
    await reauth;

    // AUTH_REQUIRED here would break App.vue's re-auth watch (CONNECTED <- RECONNECTING)
    expect(api.state.value).toBe(ConnectionState.RECONNECTING);
  });

  it("rejects with ConnectionLostError and leaves no commands map entry when sent while disconnected", async () => {
    const api = new MusicAssistantApi();
    api.state.value = ConnectionState.DISCONNECTED;

    await expect(
      api.sendCommand("ai_radio/stations/list"),
    ).rejects.toBeInstanceOf(ConnectionLostError);
    expect(api["commands"].size).toBe(0);
  });

  it("rejects with ConnectionLostError and leaves no commands map entry when the transport's send throws", async () => {
    const { api, transport } = connectedApi();
    transport.send.mockImplementation(() => {
      throw new Error("WebSocket is not connected");
    });

    await expect(
      api.sendCommand("ai_radio/stations/list"),
    ).rejects.toBeInstanceOf(ConnectionLostError);
    expect(api["commands"].size).toBe(0);
  });

  it("does not fall back to AUTH_REQUIRED when a dropped connection blocks re-auth from even being sent", async () => {
    const { api, transport } = connectedApi();
    api.state.value = ConnectionState.RECONNECTING;
    transport.send.mockImplementation(() => {
      throw new Error("WebSocket is not connected");
    });

    await expect(
      api.authenticateWithToken("stored-token"),
    ).rejects.toBeInstanceOf(ConnectionLostError);

    // AUTH_REQUIRED here would wipe the token before the reconnect flow gets to retry
    expect(api.state.value).not.toBe(ConnectionState.AUTH_REQUIRED);
  });
});
