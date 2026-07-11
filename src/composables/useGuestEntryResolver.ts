import {
  getMusicQuizInfo,
  isMusicQuizProviderEvent,
} from "@/composables/useMusicQuiz";
import {
  createGuestQuizAffinity,
  type GuestQuizAffinity,
} from "@/helpers/guest_quiz_affinity";
import { consumeMusicQuizJoinedGameEnded } from "@/helpers/music_quiz_guest_state";
import api, { ConnectionState } from "@/plugins/api";
import { authManager } from "@/plugins/auth";
import { EventType, type EventMessage } from "@/plugins/api/interfaces";
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
  | "loading"
  | "quiz"
  | "party"
  | "quiz-ended"
  | "quiz-inactive"
  | "inactive";

export const guestEntryStateKey: InjectionKey<Readonly<Ref<GuestEntryState>>> =
  Symbol("guest-entry-state");

export async function resolveGuestEntry(
  quizAffinity: GuestQuizAffinity = createGuestQuizAffinity(getGuestIdentity()),
): Promise<GuestEntryState> {
  const state = await resolveGuestEntryState(quizAffinity);
  if (state === "quiz") quizAffinity.record();
  return state;
}

export function useGuestEntryResolver() {
  const route = useRoute();
  const router = useRouter();
  const state = ref<GuestEntryState>("loading");
  let guestIdentity = getGuestIdentity();
  let quizAffinity = createGuestQuizAffinity(guestIdentity);
  let active = false;
  let requestedVersion = 0;
  let preserveEndedState = false;
  let resolutionPromise: Promise<void> | null = null;
  let quizProviderInstanceId: string | undefined;
  const unsubscribers: (() => void)[] = [];

  onMounted(async () => {
    active = true;
    await waitForApiInitialization();
    if (!active) return;

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
    active = false;
    requestedVersion += 1;
    unsubscribers.forEach((unsubscribe) => unsubscribe());
  });

  return {
    state: readonly(state),
    resolve: requestResolution,
  };

  function requestResolution(): Promise<void> {
    return scheduleResolution(false);
  }

  function requestEndedResolution(): Promise<void> {
    return scheduleResolution(true);
  }

  function scheduleResolution(preserveEnded: boolean): Promise<void> {
    requestedVersion += 1;
    preserveEndedState ||= preserveEnded;
    resolutionPromise ??= processResolutions().finally(() => {
      resolutionPromise = null;
    });
    return resolutionPromise;
  }

  async function processResolutions() {
    while (active) {
      const version = requestedVersion;
      const resolutionAffinity = getQuizAffinity();
      const nextState = await resolveGuestEntryState(resolutionAffinity);
      if (!active) return;
      if (version !== requestedVersion) continue;
      if (resolutionAffinity !== getQuizAffinity()) {
        requestedVersion += 1;
        continue;
      }

      if (nextState === "quiz") resolutionAffinity.record();
      state.value =
        preserveEndedState &&
        nextState === "quiz-inactive" &&
        !quizAffinity.active
          ? "quiz-ended"
          : nextState;
      preserveEndedState = false;
      await syncRoute();
      if (version === requestedVersion) return;
    }
  }

  function handleProviderEvent(event: EventMessage) {
    if (!isMusicQuizProviderEvent(event.data)) return;
    if (!isScopedQuizProviderEvent(event.object_id)) return;
    if (event.data.event === "game_removed") {
      queueMicrotask(() => {
        if (!active) return;
        if (consumeMusicQuizJoinedGameEnded() && route.path === "/guest/quiz") {
          void requestEndedResolution();
          return;
        }
        void requestResolution();
      });
      return;
    }
    void requestResolution();
  }

  // Lock onto the first Music Quiz provider instance we see events from, matching
  // the scoping convention used by useMusicQuizHost/useMusicQuizPlayer, so events
  // from an unrelated instance can't spuriously re-trigger resolution.
  function isScopedQuizProviderEvent(objectId?: string) {
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

  function getQuizAffinity(): GuestQuizAffinity {
    const currentIdentity = getGuestIdentity();
    if (currentIdentity !== guestIdentity) {
      guestIdentity = currentIdentity;
      quizAffinity = createGuestQuizAffinity(currentIdentity);
      preserveEndedState = false;
    }
    return quizAffinity;
  }
}

function getGuestIdentity(): string | undefined {
  if (!authManager.isGuestAccessSession()) return undefined;
  return authManager.getClaim("jti") || undefined;
}

async function resolveGuestEntryState(
  quizAffinity: GuestQuizAffinity,
): Promise<GuestEntryState> {
  const providerDomains = new Set(
    Object.values(api.providers).map((provider) => provider.domain),
  );
  const hasMusicQuiz = providerDomains.has("music_quiz");

  if (hasMusicQuiz) {
    const game = await getMusicQuizInfo();
    if (game) return "quiz";
  }
  if (quizAffinity.active) return "quiz-inactive";
  if (providerDomains.has("party")) return "party";
  return hasMusicQuiz ? "quiz-inactive" : "inactive";
}

function getGuestEntryPath(state: GuestEntryState): string | undefined {
  if (state === "quiz") return "/guest/quiz";
  if (state === "quiz-ended") return "/guest/quiz";
  if (state === "party") return "/guest/party";
  if (state === "quiz-inactive" || state === "inactive") return "/guest";
  return undefined;
}

async function waitForApiInitialization() {
  if (api.state.value === ConnectionState.INITIALIZED) return;

  await new Promise<void>((resolve) => {
    const unwatch = watch(
      () => api.state.value,
      (newState) => {
        if (newState === ConnectionState.INITIALIZED) {
          unwatch();
          resolve();
        }
      },
      { immediate: true },
    );
  });
}
