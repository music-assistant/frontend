<template>
  <Card v-if="onAirSession" class="overflow-hidden p-0">
    <div class="flex items-center gap-4 p-4 sm:p-5">
      <div class="h-20 w-20 shrink-0 overflow-hidden rounded-md shadow-lg">
        <MediaItemThumb
          v-if="playlist"
          :item="playlist"
          :size="96"
          :rounded="false"
          class="h-full w-full"
        />
        <div
          v-else
          class="flex h-full w-full items-center justify-center"
          :style="{ background: fallbackArt }"
        >
          <Radio class="h-8 w-8 text-white/80" />
        </div>
      </div>

      <div class="min-w-0 flex-1">
        <div class="flex items-center gap-2">
          <span class="relative flex h-2 w-2">
            <span
              class="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75"
            ></span>
            <span
              class="relative inline-flex h-2 w-2 rounded-full bg-red-500"
            ></span>
          </span>
          <span
            class="text-xs font-semibold uppercase tracking-widest text-red-500"
          >
            {{ $t("providers.ai_radio.card.on_air") }}
          </span>
          <span class="text-xs tabular-nums text-muted-foreground">
            {{ elapsedLabel }}
          </span>
        </div>
        <h2 class="truncate text-lg font-semibold">{{ showName }}</h2>
        <p
          v-if="preparingLabel"
          class="flex items-center gap-1.5 truncate text-sm text-muted-foreground"
        >
          <Loader2 class="h-3.5 w-3.5 shrink-0 animate-spin" />
          <span class="truncate">{{ preparingLabel }}</span>
        </p>
        <p v-else class="truncate text-sm text-muted-foreground">
          {{ subtitle }}
        </p>
      </div>

      <Button
        variant="outline"
        size="sm"
        class="shrink-0"
        :disabled="isStopping"
        @click="onStop"
      >
        <Square class="h-4 w-4" />
        {{
          isStopping
            ? $t("providers.ai_radio.card.stopping")
            : $t("providers.ai_radio.card.stop")
        }}
      </Button>
    </div>
  </Card>
</template>

<script setup lang="ts">
import MediaItemThumb from "@/components/MediaItemThumb.vue";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useShows } from "@/composables/ai-radio/useShows";
import { errorMessage, showArtGradient } from "@/helpers/ai_radio";
import { formatDuration } from "@/helpers/utils";
import api from "@/plugins/api";
import { $t } from "@/plugins/i18n";
import { Loader2, Radio, Square } from "@lucide/vue";
import { computed, onMounted, onUnmounted, ref } from "vue";
import { toast } from "vue-sonner";

const { shows, sessions, stoppingSessionId, playlistFor, stopShow } =
  useShows();

const onAirSession = computed(() =>
  sessions.value.find((session) => session.status === "running"),
);

const onAirShow = computed(() =>
  shows.value.find((show) => show.id === onAirSession.value?.station_id),
);

const showName = computed(
  () => onAirShow.value?.name || onAirSession.value?.station_id || "",
);

const playlist = computed(() => {
  const show = onAirShow.value;
  if (!show) return undefined;
  return playlistFor(show.source_playlist_provider, show.source_playlist_id);
});

const playerName = computed(() => {
  const playerId = onAirShow.value?.default_player_id;
  return playerId ? api.players[playerId]?.name : undefined;
});

const subtitle = computed(() =>
  [playlist.value?.name, playerName.value].filter(Boolean).join(" · "),
);

const PHASE_LABEL_KEYS: Record<string, string> = {
  fetch_source_tracks: "providers.ai_radio.phase.fetch_source_tracks",
  planning_sections: "providers.ai_radio.phase.planning_sections",
  generating_llm: "providers.ai_radio.phase.generating_llm",
  generating_tts: "providers.ai_radio.phase.generating_tts",
  publishing_playlist: "providers.ai_radio.phase.publishing_playlist",
  initializing_queue: "providers.ai_radio.phase.initializing_queue",
  queueing_batch: "providers.ai_radio.phase.queueing_batch",
  waiting_for_playback: "providers.ai_radio.phase.waiting_for_playback",
};

const preparingLabel = computed(() => {
  const progress = onAirSession.value?.progress;
  const phase = progress?.phase;
  const queuedTracks =
    typeof progress?.queued_tracks === "number" ? progress.queued_tracks : 0;

  if (!phase || phase === "running" || queuedTracks > 0) return "";

  return $t(PHASE_LABEL_KEYS[phase] || "providers.ai_radio.phase.preparing");
});

const fallbackArt = computed(() => showArtGradient(showName.value));

const isStopping = computed(
  () =>
    !!onAirSession.value &&
    stoppingSessionId.value === onAirSession.value.session_id,
);

const nowMs = ref(Date.now());
let elapsedTimer: ReturnType<typeof setInterval> | null = null;

const elapsedLabel = computed(() => {
  const startedAt =
    onAirSession.value?.started_at || onAirSession.value?.created_at;
  if (!startedAt) return "";
  const startMs = new Date(startedAt).getTime();
  if (Number.isNaN(startMs)) return "";
  return formatDuration(Math.max(0, (nowMs.value - startMs) / 1000));
});

async function onStop() {
  const session = onAirSession.value;
  if (!session) return;
  try {
    await stopShow(session.session_id);
  } catch (error) {
    const stillRunning = sessions.value.some(
      (item) =>
        item.session_id === session.session_id && item.status === "running",
    );
    if (stillRunning) toast.error(errorMessage(error));
  }
}

onMounted(() => {
  elapsedTimer = setInterval(() => {
    nowMs.value = Date.now();
  }, 1000);
});

onUnmounted(() => {
  if (elapsedTimer) clearInterval(elapsedTimer);
});
</script>
