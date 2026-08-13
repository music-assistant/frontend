<!--
  Playback speed control. Only rendered while the playing item has a speed of
  its own (audiobooks and podcast episodes); shows the speed in use and opens
  the playback speed dialog on click.
-->
<template>
  <TooltipProvider v-if="supported" :delay-duration="200">
    <Tooltip>
      <TooltipTrigger as-child>
        <Button
          variant="outline"
          size="xs"
          class="gap-1 tabular-nums"
          :aria-label="$t('change_playback_speed')"
          v-bind="$attrs"
          @click.stop="dialogOpen = true"
        >
          <Gauge :size="16" />
          <span>{{ $t("playback_speed_value", [speedLabel]) }}</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top" class="z-[10001]">
        <p>{{ $t("change_playback_speed") }}</p>
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>

  <!-- outside the button's own condition: a dialog taken down and put back by a
       track change would come back open -->
  <PlaybackSpeedDialog v-model:open="dialogOpen" />
</template>

<script setup lang="ts">
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  formatPlaybackSpeed,
  playbackSpeedSupported,
  queueItemPlaybackSpeed,
} from "@/helpers/elapsed";
import PlaybackSpeedDialog from "@/layouts/default/PlayerOSD/PlaybackSpeedDialog.vue";
import { $t } from "@/plugins/i18n";
import { store } from "@/plugins/store";
import { Gauge } from "@lucide/vue";
import { computed, ref, watch } from "vue";

// forward fallthrough attrs (e.g. spacing classes) to the button, not the
// renderless TooltipProvider root.
defineOptions({ inheritAttrs: false });

const dialogOpen = ref(false);

const supported = computed(() => playbackSpeedSupported(store.curQueueItem));
const speedLabel = computed(() =>
  formatPlaybackSpeed(queueItemPlaybackSpeed(store.curQueueItem)),
);

// the queue moves on under an open dialog, and there is no speed to set on
// whatever it moved to
watch(supported, (isSupported) => {
  if (!isSupported) dialogOpen.value = false;
});
</script>
