import { nextTick, ref } from "vue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ConnectionState } from "@/plugins/api";
import { useReconnectGrace } from "./useReconnectGrace";

describe("useReconnectGrace", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("tracks a full reconnect/re-auth/re-init cycle back to INITIALIZED", async () => {
    const state = ref(ConnectionState.INITIALIZED);
    const recovering = useReconnectGrace(state);

    state.value = ConnectionState.RECONNECTING;
    await nextTick();
    expect(recovering.value).toBe(true);

    for (const next of [
      ConnectionState.CONNECTED,
      ConnectionState.AUTHENTICATING,
      ConnectionState.AUTHENTICATED,
    ]) {
      state.value = next;
      await nextTick();
      expect(recovering.value).toBe(true);
    }

    state.value = ConnectionState.INITIALIZED;
    await nextTick();
    expect(recovering.value).toBe(false);

    // the grace timer from the original RECONNECTING transition must not fire later
    vi.advanceTimersByTime(20_000);
    expect(recovering.value).toBe(false);
  });

  it("clears on FAILED", async () => {
    const state = ref(ConnectionState.INITIALIZED);
    const recovering = useReconnectGrace(state);

    state.value = ConnectionState.RECONNECTING;
    await nextTick();
    expect(recovering.value).toBe(true);

    state.value = ConnectionState.FAILED;
    await nextTick();
    expect(recovering.value).toBe(false);
  });

  it("clears once the grace period elapses", async () => {
    const state = ref(ConnectionState.INITIALIZED);
    const recovering = useReconnectGrace(state, 10_000);

    state.value = ConnectionState.RECONNECTING;
    await nextTick();
    expect(recovering.value).toBe(true);

    vi.advanceTimersByTime(9_999);
    expect(recovering.value).toBe(true);

    vi.advanceTimersByTime(1);
    expect(recovering.value).toBe(false);
  });

  it("does not engage when RECONNECTING is not reached from INITIALIZED", async () => {
    const state = ref(ConnectionState.CONNECTING);
    const recovering = useReconnectGrace(state);

    state.value = ConnectionState.RECONNECTING;
    await nextTick();
    expect(recovering.value).toBe(false);

    state.value = ConnectionState.DISCONNECTED;
    await nextTick();
    state.value = ConnectionState.RECONNECTING;
    await nextTick();
    expect(recovering.value).toBe(false);
  });
});
