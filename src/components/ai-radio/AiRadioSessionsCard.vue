<template>
  <Card>
    <CardHeader>
      <CardTitle>{{ $t("providers.ai_radio.sessions.title") }}</CardTitle>
      <CardDescription>
        {{ $t("providers.ai_radio.sessions.description") }}
      </CardDescription>
    </CardHeader>
    <CardContent>
      <div v-if="sessions.length === 0" class="text-sm text-muted-foreground">
        {{ $t("providers.ai_radio.sessions.empty") }}
      </div>
      <ul v-else class="space-y-3">
        <li
          v-for="session in sessions"
          :key="session.session_id"
          class="rounded-md border p-3"
        >
          <div class="flex flex-wrap items-center gap-2">
            <span class="font-medium">{{
              stationName(session.station_id)
            }}</span>
            <Badge :variant="sessionBadgeVariant(session.status)">
              {{ session.status }}
            </Badge>
            <Badge variant="outline">{{ session.mode }}</Badge>
          </div>
          <div class="mt-2 text-xs text-muted-foreground">
            {{ $t("providers.ai_radio.sessions.started") }}:
            {{ formatTimestamp(session.started_at || session.created_at) }}
          </div>
          <div
            v-if="sessionProgressSummary(session)"
            class="mt-2 rounded-md border bg-muted/40 px-3 py-2 text-xs"
          >
            <div class="font-medium">
              {{ sessionProgressSummary(session) }}
            </div>
            <div
              v-if="sessionProgressDetails(session)"
              class="mt-1 text-muted-foreground"
            >
              {{ sessionProgressDetails(session) }}
            </div>
          </div>
          <div
            v-if="sessionErrorMessage(session)"
            class="mt-2 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            <div class="font-medium">
              {{ $t("providers.ai_radio.sessions.error") }}
            </div>
            <div class="mt-1 break-words">
              {{ sessionErrorMessage(session) }}
            </div>
          </div>
          <div v-if="session.status === 'running'" class="mt-3">
            <Button
              variant="outline"
              size="sm"
              :disabled="stoppingSessionId === session.session_id"
              @click="stopSession(session.session_id)"
            >
              {{
                stoppingSessionId === session.session_id
                  ? $t("providers.ai_radio.actions.stopping")
                  : $t("providers.ai_radio.actions.stop")
              }}
            </Button>
          </div>
          <div v-else-if="sessionResultPlaylistId(session)" class="mt-3">
            <Button
              variant="outline"
              size="sm"
              @click="openResultPlaylist(session)"
            >
              <ListMusic class="mr-1 h-4 w-4" />
              {{ $t("providers.ai_radio.sessions.open_playlist") }}
            </Button>
          </div>
        </li>
      </ul>
    </CardContent>
  </Card>
</template>

<script setup lang="ts">
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { useAiRadio } from "@/composables/ai-radio/useAiRadio";
import { useAiRadioEditor } from "@/composables/ai-radio/useAiRadioEditor";
import { errorMessage, formatTimestamp } from "@/helpers/ai_radio";
import type { AIRadioSession } from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import { ListMusic } from "@lucide/vue";
import { computed } from "vue";
import { useRouter } from "vue-router";
import { toast } from "vue-sonner";

type BadgeVariant = "default" | "secondary" | "destructive" | "outline";

type AIRadioProgressPhase =
  | "fetch_source_tracks"
  | "initializing_queue"
  | "planning_sections"
  | "generating_llm"
  | "generating_tts"
  | "publishing_playlist"
  | "queueing_batch"
  | "waiting_for_playback"
  | "running";

const router = useRouter();

const { sessions, stoppingSessionId, stopRun } = useAiRadio();
const { stations } = useAiRadioEditor();

// Completed playlist runs report the generated library playlist in `result`.
const sessionResultPlaylistId = (session: AIRadioSession): string => {
  if (session.status !== "completed" || session.mode !== "playlist") {
    return "";
  }
  const playlistId = session.result?.target_playlist_id;
  if (typeof playlistId === "string" && playlistId.trim()) {
    return playlistId;
  }
  if (typeof playlistId === "number") {
    return String(playlistId);
  }
  return "";
};

const openResultPlaylist = (session: AIRadioSession) => {
  const itemId = sessionResultPlaylistId(session);
  if (!itemId) {
    return;
  }
  void router.push({
    name: "playlist",
    params: { itemId, provider: "library" },
  });
};

const stationById = computed(() => {
  const output = new Map<string, string>();
  for (const station of stations.value) {
    output.set(station.id, station.name);
  }
  return output;
});

const stationName = (stationId: string) => {
  return stationById.value.get(stationId) || stationId;
};

const sessionBadgeVariant = (
  status: AIRadioSession["status"],
): BadgeVariant => {
  if (status === "running") return "default";
  if (status === "completed") return "secondary";
  if (status === "failed") return "destructive";
  return "outline";
};

const toProgressRecord = (session: AIRadioSession): Record<string, unknown> => {
  if (!session.progress || typeof session.progress !== "object") {
    return {};
  }
  return session.progress as Record<string, unknown>;
};

const sessionErrorMessage = (session: AIRadioSession): string => {
  if (session.error) {
    return session.error;
  }
  const progress = toProgressRecord(session);
  const progressError = progress.error || progress.error_message;
  if (typeof progressError === "string") {
    return progressError;
  }
  if (progressError && typeof progressError === "object") {
    return errorMessage(progressError);
  }
  return "";
};

const asProgressNumber = (value: unknown): number | null => {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return null;
};

const progressPhaseLabel = (phase: string): string => {
  const labels: Record<AIRadioProgressPhase, string> = {
    fetch_source_tracks: $t(
      "providers.ai_radio.progress.phase.fetch_source_tracks",
    ),
    initializing_queue: $t(
      "providers.ai_radio.progress.phase.initializing_queue",
    ),
    planning_sections: $t(
      "providers.ai_radio.progress.phase.planning_sections",
    ),
    generating_llm: $t("providers.ai_radio.progress.phase.generating_llm"),
    generating_tts: $t("providers.ai_radio.progress.phase.generating_tts"),
    publishing_playlist: $t(
      "providers.ai_radio.progress.phase.publishing_playlist",
    ),
    queueing_batch: $t("providers.ai_radio.progress.phase.queueing_batch"),
    waiting_for_playback: $t(
      "providers.ai_radio.progress.phase.waiting_for_playback",
    ),
    running: $t("providers.ai_radio.progress.phase.running"),
  };
  return labels[phase as AIRadioProgressPhase] || phase;
};

const sessionProgressSummary = (session: AIRadioSession): string => {
  const progress = toProgressRecord(session);
  const phase = String(progress.phase || progress.step || "").trim();
  if (!phase) {
    return "";
  }
  return progressPhaseLabel(phase);
};

const sessionProgressDetails = (session: AIRadioSession): string => {
  const progress = toProgressRecord(session);
  const phase = String(progress.phase || progress.step || "").trim();
  const queuedTracks = asProgressNumber(progress.queued_tracks);
  const totalTracks = asProgressNumber(progress.total_tracks);
  const batchIndex = asProgressNumber(progress.batch_index);
  const sectionsPlanned = asProgressNumber(progress.sections_planned);
  const sectionCount = asProgressNumber(progress.sections);
  const queueEntries = asProgressNumber(progress.queue_entries);
  const entries = asProgressNumber(progress.entries);
  const tracks = asProgressNumber(progress.tracks);

  if (!phase) {
    return "";
  }
  if (phase === "generating_llm") {
    if (sectionsPlanned !== null && batchIndex !== null) {
      return $t("providers.ai_radio.progress.details.llm_batch", [
        batchIndex,
        sectionsPlanned,
      ]);
    }
    if (sectionsPlanned !== null) {
      return $t("providers.ai_radio.progress.details.llm_sections", [
        sectionsPlanned,
      ]);
    }
  }
  if (phase === "generating_tts") {
    if (sectionCount !== null && batchIndex !== null) {
      return $t("providers.ai_radio.progress.details.tts_batch", [
        batchIndex,
        sectionCount,
      ]);
    }
    if (sectionCount !== null) {
      return $t("providers.ai_radio.progress.details.tts_sections", [
        sectionCount,
      ]);
    }
  }
  if (phase === "queueing_batch") {
    if (batchIndex !== null && queueEntries !== null) {
      return $t("providers.ai_radio.progress.details.queue_batch", [
        batchIndex,
        queueEntries,
      ]);
    }
  }
  if (phase === "waiting_for_playback") {
    if (queuedTracks !== null && totalTracks !== null && batchIndex !== null) {
      return $t("providers.ai_radio.progress.details.waiting", [
        batchIndex,
        queuedTracks,
        totalTracks,
      ]);
    }
  }
  if (phase === "publishing_playlist") {
    if (entries !== null || tracks !== null) {
      const entryText =
        entries !== null
          ? $t("providers.ai_radio.progress.details.entries", [entries])
          : "";
      const trackText =
        tracks !== null
          ? $t("providers.ai_radio.progress.details.source_tracks", [tracks])
          : "";
      return [entryText, trackText].filter(Boolean).join(" · ");
    }
  }
  if (queuedTracks !== null && totalTracks !== null) {
    return $t("providers.ai_radio.progress.details.source_processed", [
      queuedTracks,
      totalTracks,
    ]);
  }
  return "";
};

const stopSession = async (sessionId: string) => {
  try {
    await stopRun(sessionId);
  } catch (error) {
    toast.error(
      $t("providers.ai_radio.toast.stop_failed", [errorMessage(error)]),
    );
  }
};
</script>
