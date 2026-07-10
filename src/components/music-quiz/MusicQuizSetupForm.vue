<template>
  <div class="quiz-setup">
    <label>
      {{ $t("providers.music_quiz.session_name") }}
      <input v-model="name" type="text" />
    </label>
    <label>
      {{ $t("providers.music_quiz.rounds") }}
      <input v-model.number="roundCount" min="2" type="number" />
    </label>
    <label>
      {{ $t("providers.music_quiz.suggestions") }}
      <input v-model.number="suggestionCount" min="2" type="number" />
    </label>
    <label>
      {{ $t("providers.music_quiz.answer_seconds") }}
      <input v-model.number="answerDuration" min="1" type="number" />
    </label>
    <label>
      {{ $t("providers.music_quiz.difficulty") }}
      <select v-model="difficulty">
        <option value="easy">
          {{ $t("providers.music_quiz.difficulty_easy") }}
        </option>
        <option value="normal">
          {{ $t("providers.music_quiz.difficulty_normal") }}
        </option>
        <option value="hard">
          {{ $t("providers.music_quiz.difficulty_hard") }}
        </option>
      </select>
    </label>
    <div class="quiz-setup__wide quiz-setup__sources">
      <div class="quiz-setup__source-search">
        <label>
          {{ $t("providers.music_quiz.add_tracks_or_playlists") }}
          <input
            v-model="sourceSearchQuery"
            type="search"
            :placeholder="$t('providers.music_quiz.search_music')"
          />
        </label>
        <div
          v-if="sourceSearchQuery.length >= 2"
          class="quiz-setup__source-results"
        >
          <p v-if="sourceSearching" class="quiz-setup__muted">
            {{ $t("providers.music_quiz.searching") }}
          </p>
          <button
            v-for="item in sourceResults"
            v-else
            :key="item.uri"
            type="button"
            class="quiz-setup__source-row"
            @click="addSource(item)"
          >
            <MediaItemThumb :item="item" :size="44" />
            <span>
              <strong>{{ item.name }}</strong>
              <small>{{ sourceSubtitle(item) }}</small>
            </span>
          </button>
          <p
            v-if="!sourceSearching && sourceResults.length === 0"
            class="quiz-setup__muted"
          >
            {{ $t("providers.music_quiz.no_sources_found") }}
          </p>
        </div>
      </div>

      <div class="quiz-setup__selected">
        <div class="quiz-setup__selected-header">
          <span>{{ $t("providers.music_quiz.selected_music") }}</span>
          <strong>{{ selectedSourcesSummary }}</strong>
        </div>
        <div
          v-if="selectedSources.length > 0"
          class="quiz-setup__selected-sources"
        >
          <button
            v-for="item in selectedSources"
            :key="item.uri"
            type="button"
            class="quiz-setup__source-chip"
            @click="removeSource(item.uri)"
          >
            <span>
              <strong>{{ item.name }}</strong>
              <small>{{ sourceSubtitle(item) }}</small>
            </span>
            <X class="size-4" />
          </button>
        </div>
        <p v-else class="quiz-setup__muted">
          {{ $t("providers.music_quiz.pick_at_least_one_source") }}
        </p>
      </div>
    </div>
    <Button :disabled="busy || !canCreate" @click="create">
      <PartyPopper class="size-4" />
      {{ $t("create") }}
    </Button>
  </div>
</template>

<script setup lang="ts">
import MediaItemThumb from "@/components/MediaItemThumb.vue";
import { Button } from "@/components/ui/button";
import type { MusicQuizCreateArgs } from "@/composables/useMusicQuiz";
import { getMusicQuizSourceSummary } from "@/helpers/music_quiz_sources";
import api from "@/plugins/api";
import { MediaType, type Playlist, type Track } from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import { PartyPopper, X } from "@lucide/vue";
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { toast } from "vue-sonner";

type SourceItem = Track | Playlist;

defineProps<{ busy: boolean }>();
const emit = defineEmits<{ create: [args: MusicQuizCreateArgs] }>();

const sessionNameAdjectives = [
  "Neon",
  "Golden",
  "Midnight",
  "Cosmic",
  "Electric",
  "Velvet",
  "Lucky",
  "Hidden",
];
const sessionNameNouns = [
  "Mixtape",
  "Groove",
  "Encore",
  "Jukebox",
  "Chorus",
  "Setlist",
  "Playlist",
  "Jam",
];

const name = ref(generateSessionName());
const roundCount = ref(5);
const suggestionCount = ref(4);
const answerDuration = ref(30);
const difficulty = ref<MusicQuizCreateArgs["difficulty"]>("normal");
const sourceSearchQuery = ref("");
const sourceResults = ref<SourceItem[]>([]);
const selectedSources = ref<SourceItem[]>([]);
const sourceSearching = ref(false);
let sourceSearchTimer: ReturnType<typeof setTimeout> | undefined;

const sourceUris = computed(() =>
  selectedSources.value.map((item) => item.uri),
);
const canCreate = computed(() => sourceUris.value.length > 0);
const selectedSourcesSummary = computed(() =>
  getMusicQuizSourceSummary(selectedSources.value),
);

function generateSessionName() {
  const seeds = new Uint32Array(2);
  window.crypto.getRandomValues(seeds);
  const adjective =
    sessionNameAdjectives[seeds[0] % sessionNameAdjectives.length];
  const noun = sessionNameNouns[seeds[1] % sessionNameNouns.length];
  const time = new Date().toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
  return `${adjective} ${noun} ${time}`;
}

function create() {
  emit("create", {
    round_count: roundCount.value,
    suggestion_count: suggestionCount.value,
    answer_duration: answerDuration.value,
    difficulty: difficulty.value,
    source_uris: sourceUris.value,
    name: name.value.trim() || generateSessionName(),
  });
  name.value = generateSessionName();
}

function scheduleSourceSearch() {
  if (sourceSearchTimer) clearTimeout(sourceSearchTimer);
  sourceSearchTimer = setTimeout(searchSources, 250);
}

async function searchSources() {
  const query = sourceSearchQuery.value.trim();
  if (query.length < 2) {
    sourceResults.value = [];
    sourceSearching.value = false;
    return;
  }
  sourceSearching.value = true;
  try {
    const result = await api.search(
      query,
      [MediaType.TRACK, MediaType.PLAYLIST],
      8,
    );
    const selected = new Set(selectedSources.value.map((item) => item.uri));
    sourceResults.value = [...result.tracks, ...result.playlists].filter(
      (item) => !selected.has(item.uri),
    );
  } catch (err) {
    toast.error(
      err instanceof Error
        ? err.message
        : $t("providers.music_quiz.source_search_failed"),
    );
  } finally {
    sourceSearching.value = false;
  }
}

function addSource(item: SourceItem) {
  if (selectedSources.value.some((source) => source.uri === item.uri)) return;
  selectedSources.value.push(item);
  sourceResults.value = sourceResults.value.filter(
    (result) => result.uri !== item.uri,
  );
}

function removeSource(uri: string) {
  selectedSources.value = selectedSources.value.filter(
    (source) => source.uri !== uri,
  );
  scheduleSourceSearch();
}

function sourceSubtitle(item: SourceItem) {
  if (item.media_type === MediaType.PLAYLIST)
    return $t("providers.music_quiz.playlist");
  const artist = (item as Track).artists?.[0]?.name;
  return artist
    ? $t("providers.music_quiz.track_with_artist", [artist])
    : $t("providers.music_quiz.track");
}

watch(sourceSearchQuery, () => scheduleSourceSearch());

onBeforeUnmount(() => {
  if (sourceSearchTimer) clearTimeout(sourceSearchTimer);
});
</script>

<style scoped>
.quiz-setup {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 0.75rem;
}

.quiz-setup label {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  font-size: 0.875rem;
}

.quiz-setup input,
.quiz-setup select {
  min-height: 2.5rem;
  border: 1px solid hsl(var(--foreground) / 0.35);
  border-radius: 6px;
  background: hsl(var(--muted));
  box-shadow: inset 0 1px 0 hsl(var(--foreground) / 0.06);
  padding: 0.5rem;
  color: hsl(var(--foreground));
  outline: none;
  transition:
    border-color 0.15s ease,
    box-shadow 0.15s ease;
}

.quiz-setup input:focus,
.quiz-setup select:focus {
  border-color: hsl(var(--primary));
  box-shadow:
    inset 0 1px 0 hsl(var(--foreground) / 0.06),
    0 0 0 3px hsl(var(--primary) / 0.2);
}

.quiz-setup__wide {
  grid-column: 1 / -1;
}

.quiz-setup__sources {
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(260px, 0.8fr);
  align-items: start;
  gap: 1rem;
}

.quiz-setup__source-search,
.quiz-setup__selected {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.quiz-setup__source-results {
  max-height: 18rem;
  overflow-y: auto;
  overscroll-behavior: contain;
  border: 1px solid hsl(var(--border));
  border-radius: 6px;
  background: hsl(var(--background));
  padding: 0.35rem;
}

.quiz-setup__selected-sources {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  max-height: 12.5rem;
  overflow-y: auto;
  overscroll-behavior: contain;
}

.quiz-setup__selected-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  min-height: 2.5rem;
  border: 1px solid hsl(var(--border));
  border-radius: 6px;
  background: hsl(var(--background));
  padding: 0.5rem 0.75rem;
  font-size: 0.875rem;
}

.quiz-setup__source-row {
  display: grid;
  grid-template-columns: 44px minmax(0, 1fr);
  align-items: center;
  gap: 0.75rem;
  width: 100%;
  border: 0;
  border-radius: 5px;
  background: transparent;
  padding: 0.45rem;
  text-align: left;
}

.quiz-setup__source-row:hover {
  background: hsl(var(--muted));
}

.quiz-setup__source-row span {
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.quiz-setup__source-row strong,
.quiz-setup__source-row small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.quiz-setup__source-row small,
.quiz-setup__muted {
  color: hsl(var(--muted-foreground));
}

.quiz-setup__source-chip {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 1rem;
  align-items: center;
  gap: 0.75rem;
  width: 100%;
  border: 1px solid hsl(var(--border));
  border-radius: 6px;
  background: hsl(var(--muted));
  padding: 0.6rem 0.75rem;
  text-align: left;
}

.quiz-setup__source-chip span {
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.quiz-setup__source-chip strong,
.quiz-setup__source-chip small {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

@media (max-width: 800px) {
  .quiz-setup__sources {
    grid-template-columns: 1fr;
  }
}
</style>
