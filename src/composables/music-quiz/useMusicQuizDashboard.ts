import {
  getMusicQuizPublicState,
  isMusicQuizProviderEvent,
  isSupportedMusicQuiz,
  type MusicQuizCurrentRound,
  type MusicQuizPublicState,
} from "@/composables/music-quiz/useMusicQuiz";
import api, { ConnectionState } from "@/plugins/api";
import { waitForApiInitialization } from "@/plugins/api/helpers";
import { EventType } from "@/plugins/api/interfaces";
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";

/**
 * Viewer-only Music Quiz state for the cast/kiosk dashboard.
 *
 * Fetches the guest-safe public state once on mount, then follows the provider's
 * game_updated broadcasts. Their payload already IS the public state, so unlike
 * the host composable this never re-fetches; game_removed clears the state.
 */
export function useMusicQuizDashboard() {
  const state = ref<MusicQuizPublicState | null>(null);
  const loading = ref(true);
  const providerInstanceId = ref<string | null>(null);

  let unsubscribeProviderEvent: (() => void) | undefined;
  let stateRequestId = 0;
  let disposed = false;

  const currentRound = computed<MusicQuizCurrentRound | null>(() => {
    const currentState = state.value;
    return currentState && isSupportedMusicQuiz(currentState)
      ? (currentState.current_round ?? null)
      : null;
  });

  const joinLink = computed(() => state.value?.join_url ?? "");

  async function fetchState() {
    const requestId = ++stateRequestId;
    loading.value = true;
    try {
      const nextState = await getMusicQuizPublicState();
      if (disposed || requestId !== stateRequestId) return;
      state.value = nextState;
    } catch (err) {
      if (disposed || requestId !== stateRequestId) return;
      // a kiosk display has nowhere to surface an error: fall back to waiting
      console.warn("Could not load the Music Quiz public state", err);
      state.value = null;
    } finally {
      if (requestId === stateRequestId) loading.value = false;
    }
  }

  onMounted(() => {
    void (async () => {
      // On a hard refresh this can mount before the provider registry is known,
      // which would resolve to a wrong "no quiz" answer.
      await waitForApiInitialization();
      if (disposed) return;
      await fetchState();
    })();
    unsubscribeProviderEvent = api.subscribe(
      EventType.PROVIDER_EVENT,
      handleProviderEvent,
    );
  });

  onBeforeUnmount(() => {
    disposed = true;
    stateRequestId += 1;
    unsubscribeProviderEvent?.();
  });

  // A TV that drops its socket only gets a fresh game_updated once something
  // changes in the game; refetch on reconnect so it isn't stuck showing stale
  // state until then. Not immediate, so it only fires on an actual transition
  // and doesn't duplicate the mount's own fetch; any edge-case overlap is
  // harmless since fetchState()'s stateRequestId guard already dedupes it.
  watch(
    () => api.state.value,
    (newState) => {
      if (newState === ConnectionState.INITIALIZED) void fetchState();
    },
  );

  return { state, loading, currentRound, joinLink, fetchState };

  function handleProviderEvent(event: { object_id?: string; data?: unknown }) {
    if (!isMusicQuizProviderEvent(event.data)) return;
    const payload = event.data;
    if (!isScopedProviderEvent(event.object_id)) return;
    applyState(payload.event === "game_updated" ? payload.state : null);
  }

  function isScopedProviderEvent(objectId?: string) {
    if (!objectId) return false;
    if (!providerInstanceId.value) {
      providerInstanceId.value = objectId;
      return true;
    }
    return providerInstanceId.value === objectId;
  }

  function applyState(nextState: MusicQuizPublicState | null) {
    stateRequestId += 1;
    state.value = nextState;
    loading.value = false;
  }
}
