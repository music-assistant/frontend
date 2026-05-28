<template>
  <div class="flex flex-col gap-0.5">
    <p v-if="mode === 'seed'" class="text-sm text-muted-foreground">
      {{ $t("smart_playlist.seed_count_hint") }}
    </p>
    <template v-else>
      <p v-if="isCountingTracks" class="text-sm text-muted-foreground">…</p>
      <p
        v-else-if="matchingTrackCount !== null"
        class="text-sm text-muted-foreground"
      >
        ~{{ matchingTrackCount }} {{ $t("tracks") }}
        <span v-if="matchingDuration !== null" class="ml-1">
          (~{{ formatDuration(matchingDuration) }})
        </span>
      </p>
      <p class="text-sm text-muted-foreground/70">
        {{ $t("smart_playlist.track_count_hint") }}
      </p>
    </template>
  </div>
</template>

<script setup lang="ts">
import type { SmartPlaylistMode } from "@/composables/useSmartPlaylistRulesForm";
import { formatDuration } from "@/helpers/utils";

defineProps<{
  mode: SmartPlaylistMode;
  isCountingTracks: boolean;
  matchingTrackCount: number | null;
  matchingDuration: number | null;
}>();
</script>
