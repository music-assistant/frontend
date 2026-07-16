<template>
  <Card class="gap-0 overflow-hidden p-0">
    <div class="group relative aspect-square w-full overflow-hidden">
      <MediaItemThumb
        v-if="playlist"
        :item="playlist"
        :size="256"
        class="h-full w-full"
      />
      <div
        v-else
        class="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/25 to-primary/5"
      >
        <Radio class="h-10 w-10 text-primary/70" />
      </div>

      <!-- Hover/tap-to-play affordance; explicit stop control lives in the footer below. -->
      <button
        v-if="!runningSession"
        type="button"
        class="absolute inset-0 flex items-center justify-center bg-black/40 opacity-0 transition-opacity group-hover:opacity-100"
        :disabled="isStarting"
        :aria-label="$t('providers.ai_radio.card.play')"
        @click.stop="onPlay"
      >
        <Loader2 v-if="isStarting" class="h-8 w-8 animate-spin text-white" />
        <Play v-else class="h-8 w-8 text-white" />
      </button>

      <Badge v-if="runningSession" variant="info" class="absolute left-2 top-2">
        {{ $t("providers.ai_radio.card.on_air") }}
      </Badge>

      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <Button
            variant="ghost-icon"
            size="icon-sm"
            class="absolute right-2 top-2 rounded-full bg-background/70 backdrop-blur-sm hover:bg-background/90"
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
          <!-- TODO(task3): enable once the Customize view exists. -->
          <DropdownMenuItem disabled @click="emit('customize', show.id)">
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

    <CardContent class="flex flex-col gap-0.5 p-3">
      <span class="truncate font-medium">{{ show.name }}</span>
      <span class="truncate text-xs text-muted-foreground">
        {{ playlist?.name || show.source_playlist_id }}
      </span>
      <TooltipProvider v-if="failedSession">
        <Tooltip>
          <TooltipTrigger as-child>
            <span class="mt-1 truncate text-xs text-destructive">
              {{ $t("providers.ai_radio.card.session_failed") }}
            </span>
          </TooltipTrigger>
          <TooltipContent side="bottom" class="max-w-[280px]">
            {{
              failedSession.error ||
              $t("providers.ai_radio.card.session_failed")
            }}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </CardContent>

    <CardFooter class="p-3 pt-0">
      <Button
        v-if="runningSession"
        variant="outline"
        size="sm"
        class="w-full"
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
      <Button
        v-else
        size="sm"
        class="w-full"
        :disabled="isStarting"
        @click="onPlay"
      >
        <Play class="h-4 w-4" />
        {{
          isStarting
            ? $t("providers.ai_radio.card.starting")
            : $t("providers.ai_radio.card.play")
        }}
      </Button>
    </CardFooter>
  </Card>
</template>

<script setup lang="ts">
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
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
  resolveShowPlayerId,
  slugify,
} from "@/helpers/ai_radio";
import MediaItemThumb from "@/components/MediaItemThumb.vue";
import type { AIRadioStation } from "@/plugins/api/interfaces";
import { eventbus } from "@/plugins/eventbus";
import { $t } from "@/plugins/i18n";
import { store } from "@/plugins/store";
import { Loader2, MoreVertical, Play, Radio, Square } from "@lucide/vue";
import { computed } from "vue";
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
  runningSessionForStation,
  reportStartError,
  dismissNoAiProviderAlert,
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

async function onPlay() {
  const playerId = resolveShowPlayerId(props.show, store.activePlayerId);
  if (!playerId) {
    toast.error($t("providers.ai_radio.card.no_player"));
    return;
  }
  try {
    await startShow(props.show.id, "dynamic", { playerIdOverride: playerId });
    dismissNoAiProviderAlert();
  } catch (error) {
    const message = errorMessage(error);
    toast.error($t("providers.ai_radio.card.start_failed", [message]));
    reportStartError(message);
  }
}

async function onStop() {
  if (!runningSession.value) return;
  try {
    await stopShow(runningSession.value.session_id);
  } catch (error) {
    toast.error(errorMessage(error));
  }
}

async function onGenerateAsPlaylist() {
  try {
    await startShow(props.show.id, "playlist");
    dismissNoAiProviderAlert();
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
    await saveShow(copy);
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
