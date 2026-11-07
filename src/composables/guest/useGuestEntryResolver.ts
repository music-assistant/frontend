import {
  getMusicQuizInfo,
  isMusicQuizProviderEvent,
} from "@/composables/music-quiz/useMusicQuiz";
import api from "@/plugins/api";
import { waitForApiInitialization } from "@/plugins/api/helpers";
import { EventType, type EventMessage } from "@/plugins/api/interfaces";
import { store } from "@/plugins/store";
import {
  onBeforeUnmount,
  onMounted,
  readonly,
  ref,
  watch,
  type InjectionKey,
  type Ref,
} from "vue";
import { useRoute, useRouter } from "vue-router";

export type GuestEntryState =
  "loading" | "error" | "quiz" | "party" | "quiz-inactive" | "inactive";

export const guestEntryStateKey: InjectionKey<Readonly<Ref<GuestEntryState>>> =
  Symbol("guest-entry-state");

/**
 * Pick the experience a guest should see: a Music Quiz game wins over the
 * Party, and without either the placeholder matching the enabled plugins.
 */
export async function resolveGuestEntry(): Promise<GuestEntryState> {
  if (await getMusicQuizInfo()) return "quiz";
  if (store.enabledPlugins.has("party")) return "party";
  return store.enabledPlugins.has("music_quiz") ? "quiz-inactive" : "inactive";
}

export function useGuestEntryResolver() {
  const route = useRoute();
  const router = useRouter();
  const state = ref<GuestEntryState>("loading");
  let unmounted = false;
  let requestedVersion = 0;
  let resolutionPromise: Promise<void> | null = null;
  let quizProviderInstanceId: string | undefined;
  const unsubscribers: (() => void)[] = [];

  onMounted(async () => {
    await waitForApiInitialization();
    if (unmounted) return;

    unsubscribers.push(
      api.subscribe(EventType.PROVIDERS_UPDATED, requestResolution),
      api.subscribe(EventType.PROVIDER_EVENT, handleProviderEvent),
    );
    await requestResolution();
  });

  watch(
    () => route.path,
    () => void syncRoute(),
  );

  onBeforeUnmount(() => {
    unmounted = true;
    requestedVersion += 1;
    unsubscribers.forEach((unsubscribe) => unsubscribe());
  });

  return {
    state: readonly(state),
    resolve: requestResolution,
  };

  function requestResolution(): Promise<void> {
    requestedVersion += 1;
    resolutionPromise ??= processResolutions().finally(() => {
      resolutionPromise = null;
    });
    return resolutionPromise;
  }

  async function processResolutions() {
    while (!unmounted) {
      const version = requestedVersion;
      let nextState: GuestEntryState;
      try {
        nextState = await resolveGuestEntry();
      } catch {
        if (unmounted) return;
        if (version !== requestedVersion) continue;
        if (state.value === "loading") {
          state.value = "error";
          await syncRoute();
        }
        return;
      }
      if (unmounted) return;
      if (version !== requestedVersion) continue;

      state.value = nextState;
      await syncRoute();
      if (version === requestedVersion) return;
    }
  }

  function handleProviderEvent(event: EventMessage) {
    if (!isMusicQuizProviderEvent(event.data)) return;
    if (!isScopedQuizProviderEvent(event.object_id)) return;
    void requestResolution();
  }

  // Lock onto the first Music Quiz provider instance we see events from, matching
  // the scoping convention used by useMusicQuizHost/useMusicQuizPlayer, so events
  // from an unrelated instance can't spuriously re-trigger resolution.
  function isScopedQuizProviderEvent(objectId?: string | null) {
    if (!objectId) return false;
    if (!quizProviderInstanceId) {
      quizProviderInstanceId = objectId;
      return true;
    }
    return quizProviderInstanceId === objectId;
  }

  async function syncRoute() {
    const target = getGuestEntryPath(state.value);
    if (target && route.path !== target) {
      await router.replace(target);
    }
  }
}

function getGuestEntryPath(state: GuestEntryState): string | undefined {
  if (state === "quiz") return "/guest/quiz";
  if (state === "party") return "/guest/party";
  if (state === "error") return "/guest";
  if (state === "quiz-inactive" || state === "inactive") return "/guest";
  return undefined;
}
