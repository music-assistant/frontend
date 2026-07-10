<template>
  <div
    v-if="visible"
    class="listen-in"
    :class="{ 'listen-in--active': isListeningIn }"
  >
    <div class="listen-in__row">
      <Headphones :size="20" class="listen-in__icon" />
      <div class="listen-in__text">
        <span class="listen-in__title">{{ title }}</span>
        <span class="listen-in__desc">{{ description }}</span>
      </div>
      <Button
        v-if="mode === 'remote'"
        :variant="isListeningIn ? 'secondary' : 'default'"
        size="sm"
        :disabled="busy"
        class="listen-in__action"
        @click="isListeningIn ? disableListenIn() : enableListenIn()"
      >
        {{ isListeningIn ? labels.stop : labels.tap }}
      </Button>
      <Switch
        v-else
        :model-value="isListeningIn"
        :disabled="busy"
        :aria-label="title"
        class="listen-in__action"
        @update:model-value="onToggle"
      />
    </div>
    <span class="listen-in__attribution">{{ labels.poweredBy }}</span>
  </div>
</template>

<script lang="ts">
import type { ListenInMode } from "@/composables/useListenIn";
import type { EventType } from "@/plugins/api/interfaces";

/** UI strings a host domain supplies to render the listen-in control. */
export interface ListenInLabels {
  title: string;
  titleActive: string;
  descriptionVenue: string;
  descriptionRemote: string;
  tap: string;
  stop: string;
  poweredBy: string;
  errorNoWebPlayer: string;
  errorListenIn: string;
  errorStopListenIn: string;
}

export interface ListenInProps {
  /** Command namespace, e.g. "party" or "music_quiz". */
  domain: string;
  /** Current experience mode; `undefined` hides the control. */
  mode?: ListenInMode;
  labels: ListenInLabels;
  /** Extra events that trigger a can_listen_in re-check (domain state changes). */
  recheckEvents?: EventType[];
  /** Optional server-error extractor passed through to useListenIn. */
  getErrorMessage?: (err: unknown, fallback: string) => string;
}
</script>

<script setup lang="ts">
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useListenIn } from "@/composables/useListenIn";
import { Headphones } from "@lucide/vue";
import { computed } from "vue";
import { toast } from "vue-sonner";

const props = defineProps<ListenInProps>();

const {
  isListeningIn,
  busy,
  shouldShowListenInToggle,
  enableListenIn,
  disableListenIn,
} = useListenIn({
  domain: props.domain,
  mode: () => props.mode,
  notifyError: (message) => toast.error(message),
  errorMessages: {
    noWebPlayer: props.labels.errorNoWebPlayer,
    listenIn: props.labels.errorListenIn,
    stopListenIn: props.labels.errorStopListenIn,
  },
  recheckEvents: props.recheckEvents,
  getErrorMessage: props.getErrorMessage,
});

// Remote mode keeps the control visible while listening so guests can stop.
const visible = computed(
  () => shouldShowListenInToggle.value || isListeningIn.value,
);

const title = computed(() =>
  isListeningIn.value ? props.labels.titleActive : props.labels.title,
);

const description = computed(() =>
  props.mode === "remote"
    ? props.labels.descriptionRemote
    : props.labels.descriptionVenue,
);

function onToggle(enabled: boolean) {
  if (enabled) enableListenIn();
  else disableListenIn();
}
</script>

<style scoped>
.listen-in {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  padding: 0.6rem 0.9rem;
  margin-bottom: 1rem;
  border-radius: 12px;
  background: rgba(var(--v-theme-primary), 0.08);
  border: 1px solid rgba(var(--v-theme-primary), 0.2);
  flex-shrink: 0;
}

.listen-in__row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.listen-in--active {
  background: rgba(var(--v-theme-primary), 0.16);
  border-color: rgba(var(--v-theme-primary), 0.4);
}

.listen-in__icon {
  color: rgb(var(--v-theme-primary));
  flex-shrink: 0;
}

.listen-in__text {
  display: flex;
  flex-direction: column;
  min-width: 0;
  flex: 1;
}

.listen-in__title {
  font-weight: 600;
  font-size: 0.9rem;
}

.listen-in__desc {
  font-size: 0.78rem;
  color: rgba(var(--v-theme-on-surface), 0.7);
}

.listen-in__action {
  flex-shrink: 0;
}

.listen-in__attribution {
  font-size: 0.68rem;
  color: rgba(var(--v-theme-on-surface), 0.5);
  text-align: center;
}
</style>
