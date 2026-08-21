<!--
  Names the source producing the audio on the active player.

  Live sources put the track they are streaming in the player's media, so this
  is the only place the origin of that audio is stated outside the queue list.
  Renders nothing while the media on screen already names itself.
-->
<template>
  <Badge
    v-if="nowPlayingSource"
    as="span"
    variant="outline"
    class="now-playing-source bg-background/40 border-transparent text-inherit shadow-none backdrop-blur-md"
    role="img"
    :aria-label="$t('tooltip.playing_from', [nowPlayingSource.name])"
    :title="$t('tooltip.playing_from', [nowPlayingSource.name])"
  >
    <ProviderIcon
      v-if="nowPlayingSource.iconDomain"
      class="now-playing-source__icon"
      :domain="nowPlayingSource.iconDomain"
      :size="14"
    />
    <span class="truncate">{{ nowPlayingSource.name }}</span>
  </Badge>
</template>

<script setup lang="ts">
import ProviderIcon from "@/components/ProviderIcon.vue";
import { Badge } from "@/components/ui/badge";
import { useNowPlayingSource } from "@/composables/nowPlayingSource";

const { nowPlayingSource } = useNowPlayingSource();
</script>

<style scoped>
/* drop ProviderIcon's default gutters so the badge's own gap applies */
.now-playing-source__icon {
  margin: 0;
  flex-shrink: 0;
}
</style>
