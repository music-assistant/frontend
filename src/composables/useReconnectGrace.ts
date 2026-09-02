import { ConnectionState } from "@/plugins/api";
import { getCurrentScope, onScopeDispose, ref, watch, type Ref } from "vue";

/**
 * Tracks whether the API connection is in the middle of a transparent
 * reconnect, so callers can keep the app mounted instead of dropping back
 * to the login screen for a connection blip.
 *
 * The returned `recovering` ref flips to `true` the moment `state` leaves
 * `INITIALIZED` for `RECONNECTING`, and stays `true` through the
 * reconnect/re-authenticate/re-initialize sequence. It flips back to
 * `false` once `state` reaches `INITIALIZED` again, once the reconnect
 * gives up or needs the user (`FAILED`, `DISCONNECTED`, `AUTH_REQUIRED`),
 * or after `graceMs` without recovering, whichever comes first.
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

  const stop = watch(state, (newState, oldState) => {
    if (
      newState === ConnectionState.RECONNECTING &&
      oldState === ConnectionState.INITIALIZED
    ) {
      recovering.value = true;
      clearTimer();
      timer = setTimeout(() => {
        recovering.value = false;
      }, graceMs);
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
    }
  });

  if (getCurrentScope()) {
    onScopeDispose(() => {
      stop();
      clearTimer();
    });
  }

  return recovering;
}
