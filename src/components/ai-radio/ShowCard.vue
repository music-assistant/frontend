<template>
  <div
    class="show-card ma-tap"
    role="button"
    tabindex="0"
    @click="emit('customize', show.id)"
    @keydown.enter.self="emit('customize', show.id)"
    @keydown.space.self.prevent="emit('customize', show.id)"
  >
    <div class="show-card__art">
      <MediaItemThumb
        v-if="playlist"
        :item="playlist"
        :size="320"
        :rounded="false"
        class="show-card__img"
      />
      <div
        v-else
        class="show-card__fallback"
        :style="{ background: bannerBackground }"
      >
        <span class="show-card__initials">{{ itemInitials(show.name) }}</span>
      </div>

      <Badge
        v-if="runningSession"
        variant="info"
        class="show-card__onair bg-blue-500 text-white"
      >
        {{ $t("providers.ai_radio.card.on_air") }}
      </Badge>

      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <Button
            variant="ghost-icon"
            size="icon-sm"
            class="show-card__menu rounded-full bg-background/70 backdrop-blur-sm hover:bg-background/90"
            :aria-label="$t('open')"
            @click.stop
          >
            <MoreVertical class="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem
            :disabled="isStarting"
            @click="onGenerateAsPlaylist"
          >
            {{ $t("providers.ai_radio.card.generate_playlist") }}
          </DropdownMenuItem>
          <DropdownMenuItem @click="emit('customize', show.id)">
            {{ $t("providers.ai_radio.card.customize") }}
          </DropdownMenuItem>
          <DropdownMenuItem :disabled="isDuplicating" @click="onDuplicate">
            {{ $t("providers.ai_radio.card.duplicate") }}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            :disabled="isDeleting"
            @click="onDelete"
          >
            {{ $t("providers.ai_radio.card.delete") }}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>

    <div class="show-card__meta">
      <div
        class="show-card__title"
        :class="{ 'show-card__title--playing': !!runningSession }"
      >
        {{ show.name }}
      </div>
      <div class="show-card__sub">
        {{ playlist?.name || show.source_playlist_id }}
      </div>
      <div class="show-card__status">
        <TooltipProvider v-if="failedSession">
          <Tooltip>
            <TooltipTrigger as-child>
              <span class="show-card__status-inner text-destructive">
                <TriangleAlert class="h-3 w-3 shrink-0" />
                <span class="truncate">
                  {{
                    $t("providers.ai_radio.card.status_failed", [
                      sessionRelativeTime(failedSession),
                    ])
                  }}
                </span>
              </span>
            </TooltipTrigger>
            <TooltipContent side="top" class="max-w-[280px]">
              {{
                failedSession.error ||
                $t("providers.ai_radio.card.session_failed")
              }}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <button
          v-else-if="completedPlaylistSession"
          type="button"
          class="show-card__status-inner text-primary hover:underline"
          :aria-label="$t('providers.ai_radio.card.open_playlist')"
          @click.stop="onOpenGeneratedPlaylist"
        >
          <ListMusic class="h-3 w-3 shrink-0" />
          <span class="truncate">
            {{
              $t("providers.ai_radio.card.status_playlist_ready", [
                sessionRelativeTime(completedPlaylistSession),
              ])
            }}
          </span>
        </button>
        <span
          v-else-if="lastEndedSession"
          class="show-card__status-inner text-muted-foreground"
        >
          <History class="h-3 w-3 shrink-0" />
          <span class="truncate">
            {{
              $t("providers.ai_radio.card.status_last_on_air", [
                sessionRelativeTime(lastEndedSession),
              ])
            }}
          </span>
        </span>
      </div>

      <button
        v-if="runningSession"
        type="button"
        class="show-card__action"
        :disabled="isStopping"
        :aria-label="$t('providers.ai_radio.card.stop')"
        @click.stop="onStop"
      >
        <Loader2 v-if="isStopping" :size="18" class="animate-spin" />
        <Square v-else :size="14" fill="currentColor" :stroke-width="0" />
      </button>
      <button
        v-else
        type="button"
        class="show-card__action show-card__action--reveal"
        :disabled="isStarting"
        :aria-label="$t('providers.ai_radio.card.play')"
        @click.stop="onPlay"
      >
        <Loader2 v-if="isStarting" :size="18" class="animate-spin" />
        <Play
          v-else
          :size="18"
          fill="currentColor"
          :stroke-width="0"
          class="show-card__action-play-icon"
        />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import {
  bannerBackground,
  itemInitials,
} from "@/components/discover/editorialArtwork";
import MediaItemThumb from "@/components/MediaItemThumb.vue";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useShows } from "@/composables/ai-radio/useShows";
import {
  deepClone,
  errorMessage,
  relativeTimeFromIso,
  resolveShowPlayerId,
  slugify,
} from "@/helpers/ai_radio";
import type { AIRadioSession, AIRadioStation } from "@/plugins/api/interfaces";
import { eventbus } from "@/plugins/eventbus";
import { $t } from "@/plugins/i18n";
import { store } from "@/plugins/store";
import {
  History,
  ListMusic,
  Loader2,
  MoreVertical,
  Play,
  Square,
  TriangleAlert,
} from "@lucide/vue";
import { computed } from "vue";
import { useRouter } from "vue-router";
import { toast } from "vue-sonner";

const props = defineProps<{
  show: AIRadioStation;
}>();

const emit = defineEmits<{
  customize: [stationId: string];
}>();

const {
  shows,
  sessions,
  startingShowId,
  stoppingSessionId,
  deletingShowId,
  savingShow,
  playlistFor,
  getShow,
  saveShow,
  deleteShow,
  startShow,
  stopShow,
  loadStatus,
  runningSessionForStation,
  reportStartError,
} = useShows();

const isStarting = computed(() => startingShowId.value === props.show.id);
const isStopping = computed(
  () =>
    !!runningSession.value &&
    stoppingSessionId.value === runningSession.value.session_id,
);
const isDeleting = computed(() => deletingShowId.value === props.show.id);
// Duplicate reuses the shared save-in-flight flag; there's no dedicated per-show one.
const isDuplicating = computed(() => savingShow.value);

const playlist = computed(() =>
  playlistFor(
    props.show.source_playlist_provider,
    props.show.source_playlist_id,
  ),
);

const runningSession = computed(() => runningSessionForStation(props.show.id));

// `sessions` is globally sorted newest-first, so the first match is the latest for this show.
const latestSession = computed(() =>
  sessions.value.find((session) => session.station_id === props.show.id),
);
const failedSession = computed(() =>
  latestSession.value?.status === "failed" ? latestSession.value : undefined,
);

const completedPlaylistSession = computed(() => {
  const session = latestSession.value;

  if (session?.status !== "completed" || session.mode !== "playlist")
    return undefined;

  return session.result?.target_playlist_id ? session : undefined;
});

const lastEndedSession = computed(() => {
  const session = latestSession.value;

  if (!session) return undefined;

  const endedLive =
    session.status === "stopped" ||
    (session.status === "completed" && session.mode === "dynamic");
  return endedLive ? session : undefined;
});

function sessionRelativeTime(session: AIRadioSession): string {
  return relativeTimeFromIso(session.ended_at || session.created_at);
}

const router = useRouter();

function onOpenGeneratedPlaylist(): void {
  const playlistId = completedPlaylistSession.value?.result?.target_playlist_id;
  if (!playlistId) return;
  router.push({
    name: "playlist",
    params: { provider: "library", itemId: playlistId },
  });
}

/** Any other station's running session, i.e. the one that would block this show from starting. */
function findOtherRunningSession(): AIRadioSession | undefined {
  return sessions.value.find(
    (session) =>
      session.status === "running" && session.station_id !== props.show.id,
  );
}

/** Confirms swapping the on-air show, like switching radio stations. */
function confirmSwitchAndPlay(
  otherSession: AIRadioSession,
  playerId: string,
): void {
  const runningName =
    shows.value.find((show) => show.id === otherSession.station_id)?.name ||
    otherSession.station_id;
  eventbus.emit("deleteConfirmationDialog", {
    title: $t("providers.ai_radio.card.switch_show_title"),
    message: $t("providers.ai_radio.card.switch_show_confirm", [
      runningName,
      props.show.name,
    ]),
    confirmLabel: $t("providers.ai_radio.card.switch_show_confirm_label"),
    onConfirm: async () => {
      try {
        await stopShow(otherSession.session_id);
        await startShow(props.show.id, "dynamic", {
          playerIdOverride: playerId,
        });
      } catch (error) {
        const message = errorMessage(error);
        toast.error($t("providers.ai_radio.card.start_failed", [message]));
        reportStartError(message);
      }
    },
  });
}

async function onPlay() {
  const playerId = resolveShowPlayerId(props.show, store.activePlayerId);
  if (!playerId) {
    toast.error($t("providers.ai_radio.card.no_player"));
    return;
  }
  const otherRunning = findOtherRunningSession();
  if (otherRunning) {
    confirmSwitchAndPlay(otherRunning, playerId);
    return;
  }
  try {
    await startShow(props.show.id, "dynamic", { playerIdOverride: playerId });
  } catch (error) {
    // The server localizes error details, so the max-concurrent reason can't be
    // matched on text. Reconcile status instead: if another show turns out to be
    // running, that's why the start was rejected — offer to switch.
    await loadStatus();
    const raceWinner = findOtherRunningSession();
    if (raceWinner) {
      confirmSwitchAndPlay(raceWinner, playerId);
      return;
    }
    const message = errorMessage(error);
    toast.error($t("providers.ai_radio.card.start_failed", [message]));
    reportStartError(message);
  }
}

async function onStop() {
  const session = runningSession.value;
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

async function onGenerateAsPlaylist() {
  try {
    await startShow(props.show.id, "playlist");
  } catch (error) {
    const message = errorMessage(error);
    toast.error($t("providers.ai_radio.card.start_failed", [message]));
    reportStartError(message);
  }
}

async function onDuplicate() {
  try {
    const full = await getShow(props.show.id);
    const copy = deepClone(full);
    copy.name = $t("providers.ai_radio.card.duplicate_name", [full.name]);
    let id = slugify(copy.name);
    if (shows.value.some((existing) => existing.id === id)) {
      id = `${id}_${Date.now().toString(36)}`;
    }
    copy.id = id;
    await saveShow(copy, $t("providers.ai_radio.toast.station_duplicated"));
  } catch (error) {
    toast.error(errorMessage(error));
  }
}

function onDelete() {
  eventbus.emit("deleteConfirmationDialog", {
    title: $t("providers.ai_radio.confirm.delete_station_title"),
    message: $t("providers.ai_radio.confirm.delete_station"),
    confirmLabel: $t("providers.ai_radio.actions.delete"),
    onConfirm: async () => {
      try {
        await deleteShow(props.show.id);
      } catch (error) {
        toast.error(errorMessage(error));
      }
    },
  });
}
</script>

<style scoped>
.show-card {
  --show-card-pad: 8px;
  position: relative;
  width: 100%;
  box-sizing: border-box;
  text-align: left;
  cursor: pointer;
  background: transparent;
  border: none;
  padding: var(--show-card-pad);
  border-radius: var(--show-card-pad);
  color: rgb(var(--v-theme-on-background));
  transition: background 0.15s ease;
}
.show-card:hover {
  background: rgba(var(--v-theme-on-surface), 0.08);
}
.ma-tap:active {
  transform: scale(0.97);
}

.show-card__art {
  position: relative;
  width: 100%;
  aspect-ratio: 1 / 1;
  border-radius: var(--show-card-pad);
  overflow: hidden;
  box-shadow:
    0 2px 8px rgba(0, 0, 0, 0.25),
    inset 0 0 0 1px rgba(255, 255, 255, 0.04);
}
.show-card__img {
  width: 100%;
  height: 100%;
}
.show-card__fallback {
  position: absolute;
  inset: 0;
  container-type: inline-size;
  display: flex;
  align-items: center;
  justify-content: center;
}
/* mirrors .ed-card__initials on EditorialMediaCard */
.show-card__initials {
  font-size: 34cqw;
  font-weight: 700;
  letter-spacing: 0.02em;
  color: rgba(255, 255, 255, 0.92);
  text-shadow: 0 2px 8px rgba(0, 0, 0, 0.25);
  user-select: none;
}
.show-card__onair {
  position: absolute;
  top: 6px;
  left: 6px;
  z-index: 2;
}
.show-card__menu {
  position: absolute;
  top: 6px;
  right: 6px;
  z-index: 3;
}

.show-card__meta {
  position: relative;
  width: 100%;
  margin-top: 10px;
  padding-right: 44px;
}
.show-card__title {
  font-size: 14px;
  font-weight: 600;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
.show-card__title--playing {
  color: rgb(var(--v-theme-primary));
}
.show-card__sub {
  font-size: 12px;
  color: rgba(var(--v-theme-on-surface), 0.6);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-top: 2px;
}
.show-card__status {
  margin-top: 2px;
  min-height: 18px;
  font-size: 12px;
  display: flex;
  align-items: center;
}
.show-card__status-inner {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
}

.show-card__action {
  position: absolute;
  bottom: 2px;
  right: 0;
  width: 38px;
  height: 38px;
  border-radius: 999px;
  background: rgb(var(--v-theme-primary));
  color: #fff;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 6px 14px rgba(0, 0, 0, 0.35);
  z-index: 4;
}
.show-card__action:disabled {
  opacity: 0.7;
}
.show-card__action-play-icon {
  margin-left: 2px;
  fill: currentColor;
  stroke: none;
}
.show-card__action--reveal {
  opacity: 0;
  pointer-events: none;
  transform: translateY(8px);
  transition:
    opacity 0.18s,
    transform 0.18s;
}
.show-card:hover .show-card__action--reveal,
.show-card:focus-within .show-card__action--reveal {
  opacity: 1;
  pointer-events: auto;
  transform: translateY(0);
}
@media (hover: none) {
  .show-card__action--reveal {
    opacity: 1;
    pointer-events: auto;
    transform: none;
  }
}
</style>
