import { webPlayer } from "@/plugins/web_player";
import { computed, onBeforeUnmount, ref, watch, type Ref } from "vue";

/** After this long without a go-ahead, the buttons stop waiting. */
const CONNECT_TIMEOUT_MS = 20000;

/**
 * Whether this device can play the quiz's music yet. Its web player has to
 * connect, and then the server has to accept it as a listener, which takes
 * a few seconds after a page loads. Meanwhile listen buttons show
 * Connecting… instead of failing with "not available yet". When the player
 * is ready, `recheck` asks the server again. If the go-ahead never comes
 * (another tab holds the player, or it's switched off), the wait stops so
 * the buttons behave as before.
 */
export function useMusicQuizListenReady(
  recheck: () => Promise<void>,
  canListenIn: Ref<boolean>,
) {
  const ready = computed(() => !!webPlayer.player_id && webPlayer.audio_ready);
  const timedOut = ref(false);
  let timer: ReturnType<typeof setTimeout> | undefined;

  /** Start (or start again) the time allowed for connecting. */
  function restartWait() {
    clearTimeout(timer);
    timedOut.value = false;
    timer = setTimeout(() => {
      timedOut.value = true;
    }, CONNECT_TIMEOUT_MS);
  }
  restartWait();

  watch(ready, (isReady) => {
    if (isReady) void recheck();
  });
  onBeforeUnmount(() => clearTimeout(timer));

  const waiting = computed(
    () => !timedOut.value && (!ready.value || !canListenIn.value),
  );
  return { ready, waiting, timedOut, restartWait };
}
