<template>
  <div
    v-if="visible"
    class="listen-in min-w-0"
    :class="{ 'listen-in--active': isListeningIn }"
  >
    <div class="listen-in__row w-full min-w-0">
      <Headphones :size="20" class="listen-in__icon" aria-hidden="true" />
      <div class="listen-in__text min-w-0 overflow-hidden">
        <div class="listen-in__title-row min-w-0">
          <span class="listen-in__title block shrink-0 whitespace-nowrap">
            {{ title }}
          </span>
          <span
            :id="attributionId"
            :title="labels.poweredBy"
            class="listen-in__attribution min-w-0 truncate text-[0.625rem]"
          >
            {{ labels.poweredBy }}
          </span>
        </div>
        <span class="listen-in__desc block truncate">{{ description }}</span>
      </div>
      <Button
        v-if="mode === 'remote'"
        :variant="isListeningIn ? 'secondary' : 'default'"
        size="sm"
        :disabled="busy"
        :aria-describedby="attributionId"
        class="listen-in__action shrink-0"
        @click="isListeningIn ? disableListenIn() : enableListenIn()"
      >
        {{ isListeningIn ? labels.stop : labels.tap }}
      </Button>
      <Switch
        v-else
        :model-value="isListeningIn"
        :disabled="busy"
        :aria-label="title"
        :aria-describedby="attributionId"
        class="listen-in__action shrink-0"
        @update:model-value="onToggle"
      />
    </div>
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
  /** Start listening when available unless a stored preference overrides it. */
  autoEnable?: boolean;
  /** Local-storage key used to remember the explicit on/off choice. */
  preferenceKey?: string;
}
</script>

<script setup lang="ts">
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useListenIn } from "@/composables/useListenIn";
import { Headphones } from "@lucide/vue";
import { computed, useId } from "vue";
import { toast } from "vue-sonner";

const props = defineProps<ListenInProps>();
const attributionId = useId();

const {
  isListeningIn,
  busy,
  shouldShowListenInToggle,
  enableListenIn: startListenIn,
  disableListenIn: stopListenIn,
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
  autoEnable: shouldAutoEnable,
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

async function enableListenIn() {
  if (!(await startListenIn())) return;
  rememberPreference(true);
}

async function disableListenIn() {
  rememberPreference(false);
  await stopListenIn();
}

function shouldAutoEnable() {
  if (!props.autoEnable) return false;
  if (!props.preferenceKey) return true;
  try {
    const preference = window.localStorage.getItem(props.preferenceKey);
    return preference === null || preference === "true";
  } catch (error) {
    console.debug("Could not read Listen-in preference:", error);
    return true;
  }
}

function rememberPreference(enabled: boolean) {
  if (!props.preferenceKey) return;
  try {
    window.localStorage.setItem(props.preferenceKey, String(enabled));
  } catch (error) {
    console.debug("Could not store Listen-in preference:", error);
  }
}
</script>

<style scoped>
.listen-in {
  display: flex;
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

.listen-in__title-row {
  display: flex;
  align-items: baseline;
  gap: 0.35rem;
  min-width: 0;
}

.listen-in__title {
  font-weight: 600;
  font-size: 0.9rem;
}

.listen-in__attribution {
  color: rgba(var(--v-theme-on-surface), 0.55);
  line-height: 1;
}

.listen-in__desc {
  font-size: 0.78rem;
  color: rgba(var(--v-theme-on-surface), 0.7);
}
</style>
