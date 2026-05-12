<template>
  <article class="recording-card" :class="{ expanded }">
    <div
      class="recording-header-row"
      @contextmenu.prevent="$emit('menu-recording', recording, $event)"
    >
      <button
        type="button"
        class="recording-header"
        :aria-expanded="expanded"
        @click="toggle"
      >
        <ChevronRight class="chevron" :class="{ rotated: expanded }" />
        <div class="recording-title">
          <div class="recording-credits">
            <span v-if="recording.conductor" class="conductor">
              {{ recording.conductor }}
            </span>
            <span v-if="recording.conductor && recording.orchestra"> / </span>
            <span v-if="recording.orchestra" class="orchestra">
              {{ recording.orchestra }}
            </span>
            <span v-if="recording.year" class="year">
              ({{ recording.year }})
            </span>
            <span class="duration-inline">
              [{{ formatDuration(recording.duration_seconds) }}]
            </span>
          </div>
          <span v-if="performerCredits" class="performer-credits">
            {{ performerCredits }}
          </span>
        </div>
      </button>
      <ClassicalRowActions
        :in-library="true"
        :favorite="favorite"
        @toggle-favorite="toggleRecordingFavorite"
        @play="$emit('play-recording', recording)"
        @menu="(e: Event) => $emit('menu-recording', recording, e)"
      />
    </div>

    <div v-if="expanded" class="recording-body">
      <ol class="movements">
        <li
          v-for="m in recording.movements"
          :key="m.track_id"
          class="movement"
          @contextmenu.prevent.stop="
            $emit('menu-movement', m, recording, $event)
          "
        >
          <button
            type="button"
            class="movement-play"
            :title="$t('play')"
            @click="$emit('play-movement', m)"
          >
            <span class="movement-title">{{ m.title }}</span>
            <span class="duration-inline">
              [{{ formatDuration(m.duration_seconds) }}]
            </span>
          </button>
          <ClassicalRowActions
            :in-library="true"
            :favorite="movementFavorites[m.track_id] ?? false"
            @toggle-favorite="
              movementFavorites[m.track_id] = !movementFavorites[m.track_id]
            "
            @play="$emit('play-movement', m)"
            @menu="(e: Event) => $emit('menu-movement', m, recording, e)"
          />
        </li>
      </ol>
      <div v-if="recording.source_album" class="source-album">
        <span class="source-album-arrow">→</span>
        <router-link
          v-if="recording.source_album_id"
          :to="`/albums/library/${recording.source_album_id}`"
        >
          {{ recording.source_album }}
        </router-link>
        <span v-else>{{ recording.source_album }}</span>
      </div>
    </div>
  </article>
</template>

<script setup lang="ts">
import { formatDuration } from "@/helpers/utils";
import type {
  ClassicalRecording,
  ClassicalRecordingMovement,
} from "@/services/classical";
import ClassicalRowActions from "@/views/classical/components/ClassicalRowActions.vue";
import { ChevronRight } from "lucide-vue-next";
import { computed, reactive, ref } from "vue";

defineOptions({ name: "WorkRecordingCard" });

const props = defineProps<{
  recording: ClassicalRecording;
  performerLookup?: Record<string, string>;
}>();

defineEmits<{
  (e: "play-recording", recording: ClassicalRecording): void;
  (e: "play-movement", movement: ClassicalRecordingMovement): void;
  (e: "menu-recording", recording: ClassicalRecording, evt: Event): void;
  (
    e: "menu-movement",
    movement: ClassicalRecordingMovement,
    recording: ClassicalRecording,
    evt: Event,
  ): void;
}>();

const expanded = ref(false);
const toggle = () => {
  expanded.value = !expanded.value;
};

// Cosmetic per-movement favourite state. TODO: replace with the underlying
// Track.favorite flag once movements are real MediaItem records.
const movementFavorites = reactive<Record<string, boolean>>({});

// Recording is favourited only when every member movement is. Partial state
// renders as unfavourited.
const favorite = computed(
  () =>
    props.recording.movements.length > 0 &&
    props.recording.movements.every((m) => movementFavorites[m.track_id]),
);

// Multi-write: toggle every movement in lockstep. TODO: swap for sequential
// `await api.toggleFavorite(track)` per movement once tracks are real.
const toggleRecordingFavorite = () => {
  const next = !favorite.value;
  for (const m of props.recording.movements) {
    movementFavorites[m.track_id] = next;
  }
};

// Performer credits (soloists / ensembles / choirs) for non-conducted
// recordings. Falls back to the raw id when no name lookup is supplied.
const performerCredits = computed(() => {
  if (!props.recording.performer_ids?.length) return "";
  const lookup = props.performerLookup ?? {};
  return props.recording.performer_ids
    .map((id) => lookup[id] ?? id)
    .join(" · ");
});
</script>

<style scoped>
.recording-card:not(:last-child) {
  border-bottom: 1px solid var(--border, #2a2a2a);
}

.recording-header-row {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.recording-header {
  flex: 1;
  min-width: 0;
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.7rem 0.25rem 0.7rem 0;
  background: transparent;
  border: 0;
  text-align: left;
  cursor: pointer;
  font: inherit;
  color: inherit;
}

.recording-header:hover {
  background: var(--muted, rgba(255, 255, 255, 0.04));
}

.chevron {
  width: 1.1rem;
  height: 1.1rem;
  transition: transform 0.15s ease;
  flex-shrink: 0;
}

.chevron.rotated {
  transform: rotate(90deg);
}

.recording-title {
  flex: 1;
  min-width: 0;
}

.recording-credits {
  font-weight: 600;
  font-size: 0.95rem;
}

.year {
  color: var(--muted-foreground, #888);
  font-weight: 400;
  margin-left: 0.25rem;
}

.duration-inline {
  color: var(--muted-foreground, #888);
  font-weight: 400;
  font-variant-numeric: tabular-nums;
  margin-left: 0.4rem;
}

.performer-credits {
  display: block;
  font-weight: 400;
  font-size: 0.85rem;
  color: var(--muted-foreground, #888);
  margin-top: 0.1rem;
}

.recording-body {
  padding: 0 0 0.8rem 2.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.movements {
  list-style: none;
  margin: 0;
  padding: 0;
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
}

.movement {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.movement-play {
  flex: 1;
  min-width: 0;
  text-align: left;
  background: transparent;
  border: 0;
  padding: 0.25rem 0;
  font: inherit;
  color: inherit;
  cursor: pointer;
  display: flex;
  align-items: baseline;
  gap: 0;
}

.movement-play:hover .movement-title {
  text-decoration: underline;
}

.movement-title {
  font-family: var(
    --font-classical-serif,
    "Roboto Serif",
    ui-serif,
    Georgia,
    serif
  );
  font-optical-sizing: auto;
  font-style: italic;
  font-size: 0.95rem;
}

.source-album {
  font-size: 0.85rem;
  color: var(--muted-foreground, #888);
  display: flex;
  align-items: baseline;
  gap: 0.4rem;
}

.source-album-arrow {
  opacity: 0.6;
}
</style>
