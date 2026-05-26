<template>
  <p v-if="isCountingTracks" class="text-sm text-muted-foreground">…</p>
  <p
    v-else-if="matchingTrackCount !== null"
    class="text-sm text-muted-foreground"
  >
    ~{{ matchingTrackCount }} {{ $t("tracks") }}
    <span v-if="matchingDuration !== null" class="ml-1"
      >(~{{ formatDuration(matchingDuration) }})</span
    >
  </p>
  <p class="text-xs text-muted-foreground/70">
    {{ $t("smart_playlist.track_count_hint") }}
  </p>
</template>

<script setup lang="ts">
import { formatDuration } from "@/helpers/utils";

defineProps<{
  isCountingTracks: boolean;
  matchingTrackCount: number | null;
  matchingDuration: number | null;
}>();
</script>
