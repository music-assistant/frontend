import { ConnectionState } from "@/plugins/api";
import {
  getCurrentScope,
  onScopeDispose,
  readonly,
  ref,
  watch,
  type Ref,
} from "vue";

/**
 * Whether the API connection is in the middle of a reconnect that started from a
 * working session, so callers can keep the app mounted meanwhile.
 *
 * The returned ref turns `true` when `state` goes from `INITIALIZED` to `RECONNECTING`
 * and back to `false` once `INITIALIZED` is reached again, when the reconnect gives up
 * or needs the user (`FAILED`, `DISCONNECTED`, `AUTH_REQUIRED`), or after `graceMs`
 * without further progress.
 */
export function useReconnectGrace(
  state: Ref<ConnectionState>,
  graceMs = 10_000,
): Readonly<Ref<boolean>> {
  const recovering = ref(false);
  let timer: ReturnType<typeof setTimeout> | null = null;

  const clearTimer = () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  };

  const startTimer = () => {
    clearTimer();
    timer = setTimeout(() => {
      recovering.value = false;
    }, graceMs);
  };

  const stop = watch(state, (newState, oldState) => {
    if (
      newState === ConnectionState.RECONNECTING &&
      oldState === ConnectionState.INITIALIZED
    ) {
      recovering.value = true;
      startTimer();
      return;
    }

    if (!recovering.value) {
      return;
    }

    if (
      newState === ConnectionState.INITIALIZED ||
      newState === ConnectionState.FAILED ||
      newState === ConnectionState.DISCONNECTED ||
      newState === ConnectionState.AUTH_REQUIRED
    ) {
      recovering.value = false;
      clearTimer();
    } else {
      // Still recovering (e.g. re-authenticating): give it a fresh grace window.
      startTimer();
    }
  });

  if (getCurrentScope()) {
    onScopeDispose(() => {
      stop();
      clearTimer();
    });
  }

  return readonly(recovering);
}
