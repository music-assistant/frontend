<template>
  <div class="quiz-host">
    <div class="quiz-host__qr">
      <canvas ref="qrCanvas"></canvas>
      <p v-if="qrError" class="quiz-host__qr-error" role="alert">
        {{ $t("providers.music_quiz.qr_unavailable") }}
      </p>
      <Button
        class="quiz-host__copy"
        type="button"
        variant="outline"
        @click="copyLink"
      >
        <Copy class="size-4" />
        {{
          copied
            ? $t("providers.music_quiz.copied")
            : $t("providers.music_quiz.copy_link")
        }}
      </Button>
    </div>
    <details
      v-if="state.phase !== 'finished' && currentRound"
      class="quiz-host__now-playing-details"
    >
      <summary>
        <span>{{ $t("providers.music_quiz.now_playing") }}</span>
        <ChevronDown class="size-4" />
      </summary>
      <div class="quiz-host__now-playing">
        <img
          v-if="currentRoundImageUrl"
          :src="currentRoundImageUrl"
          :alt="currentRound.answer_label"
        />
        <div>
          <span>{{ $t("providers.music_quiz.current_music") }}</span>
          <strong>{{ currentRound.answer_label }}</strong>
        </div>
      </div>
    </details>
    <details
      v-if="(state.sources?.length ?? 0) > 0"
      class="quiz-host__session-sources"
      open
    >
      <summary>
        <span>{{ $t("providers.music_quiz.selected_music") }}</span>
        <strong>{{ sessionSourcesSummary }}</strong>
        <ChevronDown class="size-4" />
      </summary>
      <div class="quiz-host__session-source-list">
        <div
          v-for="source in state.sources ?? []"
          :key="source.uri"
          class="quiz-host__session-source"
        >
          <strong>{{ source.name }}</strong>
          <small>{{ musicQuizSourceTypeLabel(source.media_type) }}</small>
        </div>
      </div>
    </details>
    <div v-if="showActions" class="quiz-host__actions">
      <Button
        :disabled="busy"
        type="button"
        variant="outline"
        @click="emit('delete')"
      >
        <Trash2 class="size-4" />
        {{ $t("delete") }}
      </Button>
      <Button
        v-if="state.phase === 'lobby'"
        :disabled="busy"
        @click="emit('start')"
      >
        <Play class="size-4" />
        {{ $t("providers.music_quiz.start") }}
      </Button>
      <Button
        v-if="state.phase === 'answering'"
        :disabled="busy"
        @click="emit('reveal')"
      >
        <Eye class="size-4" />
        {{ $t("providers.music_quiz.phase_reveal") }}
      </Button>
      <Button
        v-if="state.phase === 'reveal'"
        :disabled="busy"
        @click="emit('next')"
      >
        <SkipForward class="size-4" />
        {{
          isLastRound
            ? $t("providers.music_quiz.finish")
            : $t("providers.music_quiz.next")
        }}
      </Button>
      <Button
        v-if="state.phase === 'finished'"
        :disabled="busy"
        @click="emit('reset')"
      >
        <RotateCcw class="size-4" />
        {{ $t("providers.music_quiz.new_game") }}
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Button } from "@/components/ui/button";
import type {
  MusicQuizHostState,
  MusicQuizRound,
} from "@/composables/useMusicQuiz";
import { renderMusicAssistantQr } from "@/helpers/branded_qr";
import {
  getMusicQuizSourceSummary,
  musicQuizSourceTypeLabel,
} from "@/helpers/music_quiz_sources";
import { copyToClipboard, getMediaImageUrl } from "@/helpers/utils";
import { $t } from "@/plugins/i18n";
import {
  ChevronDown,
  Copy,
  Eye,
  Play,
  RotateCcw,
  SkipForward,
  Trash2,
} from "@lucide/vue";
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { toast } from "vue-sonner";

const props = withDefaults(
  defineProps<{
    state: MusicQuizHostState;
    busy: boolean;
    joinLink: string;
    currentRound: MusicQuizRound | null;
    isLastRound: boolean;
    showActions?: boolean;
  }>(),
  {
    showActions: true,
  },
);
const emit = defineEmits<{
  delete: [];
  start: [];
  reveal: [];
  next: [];
  reset: [];
}>();

const qrCanvas = ref<HTMLCanvasElement | null>(null);
const copied = ref(false);
const qrError = ref(false);
let copiedTimeout: ReturnType<typeof setTimeout> | undefined;

const currentRoundImageUrl = computed(() =>
  getMediaImageUrl(props.currentRound?.image_url ?? ""),
);
const sessionSourcesSummary = computed(() =>
  getMusicQuizSourceSummary(props.state.sources ?? []),
);

async function renderQr() {
  if (!qrCanvas.value || !props.joinLink) return;
  try {
    await renderMusicAssistantQr(qrCanvas.value, props.joinLink);
    qrError.value = false;
  } catch (err) {
    console.error("Could not render Music Quiz join QR", err);
    qrError.value = true;
  }
}

async function copyLink() {
  if (!props.joinLink) return;
  copied.value = await copyToClipboard(props.joinLink);
  if (!copied.value) {
    toast.error($t("providers.music_quiz.copy_join_link_failed"));
  }
  if (copiedTimeout) clearTimeout(copiedTimeout);
  copiedTimeout = setTimeout(() => {
    copied.value = false;
  }, 1600);
}

watch(qrCanvas, () => renderQr());
watch(
  () => props.joinLink,
  () => renderQr(),
  { immediate: true },
);

onBeforeUnmount(() => {
  if (copiedTimeout) clearTimeout(copiedTimeout);
});
</script>

<style scoped>
.quiz-host {
  display: flex;
  flex-wrap: wrap;
  align-items: flex-start;
  gap: 1rem;
}

.quiz-host__qr {
  flex: 0 0 auto;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.quiz-host__qr canvas {
  width: 220px;
  height: 220px;
  border-radius: 12px;
  background: transparent;
}

.quiz-host__qr-error {
  margin: 0;
  max-width: 220px;
  color: var(--muted-foreground);
  font-size: 0.875rem;
}

.quiz-host__copy {
  height: auto;
  min-height: 2.5rem;
  align-items: center;
  padding: 0.6rem 1rem;
  line-height: 1.25;
  white-space: normal;
}

.quiz-host__now-playing-details,
.quiz-host__session-sources {
  flex: 1 1 320px;
  min-width: min(100%, 280px);
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--background);
  overflow: hidden;
}

.quiz-host__now-playing-details summary,
.quiz-host__session-sources summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  cursor: pointer;
  font-weight: 600;
  list-style: none;
  padding: 0.75rem 0.9rem;
  background: var(--muted);
  color: var(--foreground);
  user-select: none;
}

.quiz-host__now-playing-details summary::-webkit-details-marker,
.quiz-host__session-sources summary::-webkit-details-marker {
  display: none;
}

.quiz-host__now-playing-details summary strong,
.quiz-host__session-sources summary strong {
  margin-left: auto;
  color: var(--muted-foreground);
  font-size: 0.8rem;
  font-weight: 500;
}

.quiz-host__now-playing-details summary svg,
.quiz-host__session-sources summary svg {
  flex: 0 0 auto;
  color: var(--muted-foreground);
  transition: transform 0.15s ease;
}

.quiz-host__now-playing-details[open] summary svg,
.quiz-host__session-sources[open] summary svg {
  transform: rotate(180deg);
}

.quiz-host__now-playing {
  display: grid;
  grid-template-columns: 96px minmax(0, 1fr);
  align-items: center;
  gap: 1rem;
  padding: 0.9rem;
}

.quiz-host__now-playing img {
  width: 100%;
  aspect-ratio: 1;
  border-radius: 8px;
  object-fit: cover;
  background: var(--muted);
}

.quiz-host__now-playing div {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
}

.quiz-host__now-playing span {
  color: var(--muted-foreground);
  font-size: 0.875rem;
}

.quiz-host__now-playing strong {
  overflow-wrap: anywhere;
  font-size: 1.4rem;
  line-height: 1.2;
}

.quiz-host__session-source-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  max-height: 12rem;
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 0.75rem;
}

.quiz-host__session-source {
  min-width: 0;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--card);
  padding: 0.6rem 0.75rem;
}

.quiz-host__session-source strong,
.quiz-host__session-source small {
  display: block;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.quiz-host__session-source small {
  color: var(--muted-foreground);
}

.quiz-host__actions {
  flex: 1 1 240px;
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  justify-content: flex-end;
}

@media (max-width: 800px) {
  .quiz-host__actions {
    justify-content: flex-start;
  }

  .quiz-host__now-playing {
    grid-template-columns: 96px minmax(0, 1fr);
  }
}
</style>
