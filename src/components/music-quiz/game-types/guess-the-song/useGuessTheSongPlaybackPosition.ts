import {
  onScopeDispose,
  ref,
  toValue,
  watch,
  type MaybeRefOrGetter,
} from "vue";

export interface GuessTheSongPlaybackPositionOptions {
  active: MaybeRefOrGetter<boolean>;
  startedAt: MaybeRefOrGetter<number | null | undefined>;
  duration: MaybeRefOrGetter<number | null | undefined>;
}

export function useGuessTheSongPlaybackPosition(
  options: GuessTheSongPlaybackPositionOptions,
) {
  const position = ref(0);
  let frame: number | undefined;

  watch(
    () =>
      [
        toValue(options.active),
        toValue(options.startedAt),
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

  return { position, teardown: stop };

  function start() {
    if (frame !== undefined) return;
    update();
  }

  function stop() {
    if (frame !== undefined) cancelAnimationFrame(frame);
    frame = undefined;
    position.value = 0;
  }

  function update() {
    const startedAt = toValue(options.startedAt);
    if (!toValue(options.active) || !startedAt) {
      stop();
      return;
    }

    const elapsed = Math.max(0, Date.now() / 1000 - startedAt);
    const duration = toValue(options.duration);
    position.value =
      typeof duration === "number" && duration > 0
        ? Math.min(elapsed, duration)
        : elapsed;
    frame = requestAnimationFrame(update);
  }
}
