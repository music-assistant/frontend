import {
  computed,
  onScopeDispose,
  ref,
  toValue,
  watch,
  type MaybeRefOrGetter,
} from "vue";

export interface MusicQuizAnswerDeadlineOptions {
  active: MaybeRefOrGetter<boolean>;
  deadline: MaybeRefOrGetter<number | null | undefined>;
  duration: MaybeRefOrGetter<number | null | undefined>;
}

export function useMusicQuizAnswerDeadline(
  options: MusicQuizAnswerDeadlineOptions,
) {
  const remainingSeconds = ref<number | null>(null);
  const remainingFraction = ref<number | null>(null);
  let timer: ReturnType<typeof setInterval> | undefined;

  const remainingLabel = computed(() => {
    if (remainingSeconds.value === null) return "";
    return formatCountdown(remainingSeconds.value);
  });

  watch(
    () =>
      [
        toValue(options.active),
        toValue(options.deadline),
        toValue(options.duration),
      ] as const,
    ([active]) => {
      if (!active) {
        stop();
        return;
      }
      start();
    },
    { immediate: true },
  );

  onScopeDispose(stop);

  return {
    remainingLabel,
    remainingSeconds,
    remainingFraction,
    teardown: stop,
  };

  function start() {
    update();
    if (timer !== undefined) return;
    timer = setInterval(update, 250);
  }

  function stop() {
    if (timer !== undefined) clearInterval(timer);
    timer = undefined;
    remainingSeconds.value = null;
    remainingFraction.value = null;
  }

  function update() {
    const deadline = toValue(options.deadline);
    if (!toValue(options.active) || deadline == null) {
      stop();
      return;
    }

    const remaining = deadline - Date.now() / 1000;
    remainingSeconds.value = Math.max(0, Math.ceil(remaining));

    const duration = toValue(options.duration) ?? 0;
    remainingFraction.value =
      duration > 0 ? Math.min(1, Math.max(0, remaining / duration)) : 0;
  }
}

function formatCountdown(seconds: number) {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${String(remainingSeconds).padStart(2, "0")}`;
}
