import { getAvailableMusicQuizTypes } from "@/composables/useMusicQuiz";
import { onScopeDispose, ref, shallowRef } from "vue";

export type MusicQuizAvailabilityStatus =
  | "idle"
  | "loading"
  | "ready"
  | "error";

/**
 * Manage the host-confirmed quiz types available for game creation.
 */
export function useMusicQuizAvailability() {
  const availableTypes = ref<string[]>([]);
  const status = ref<MusicQuizAvailabilityStatus>("idle");
  const error = shallowRef<unknown>(null);
  let requestId = 0;

  async function refresh() {
    const currentRequestId = ++requestId;
    availableTypes.value = [];
    error.value = null;
    status.value = "loading";
    try {
      const nextTypes = await getAvailableMusicQuizTypes();
      if (currentRequestId !== requestId) return false;
      availableTypes.value = nextTypes;
      status.value = "ready";
      return true;
    } catch (err) {
      if (currentRequestId !== requestId) return false;
      error.value = err;
      status.value = "error";
      return false;
    }
  }

  function isAvailable(quizType: string) {
    return status.value === "ready" && availableTypes.value.includes(quizType);
  }

  onScopeDispose(() => {
    requestId += 1;
  });

  return {
    availableTypes,
    status,
    error,
    isAvailable,
    refresh,
  };
}
