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
    class="now-playing-source border-transparent text-inherit shadow-none"
    :class="
      plain
        ? 'border-0 bg-transparent px-0'
        : 'bg-background/40 backdrop-blur-md'
    "
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
    <span v-if="!iconOnly || !nowPlayingSource.iconDomain" class="truncate">
      {{ nowPlayingSource.name }}
    </span>
  </Badge>
</template>

<script setup lang="ts">
import ProviderIcon from "@/components/ProviderIcon.vue";
import { Badge } from "@/components/ui/badge";
import { useNowPlayingSource } from "@/composables/nowPlayingSource";

interface Props {
  /**
   * Let the icon name the source on its own; the name stays available in the
   * label and tooltip. Sources without an icon keep showing their name.
   */
  iconOnly?: boolean;
  /**
   * Drop the pill background, border and horizontal padding so the badge
   * lines up with the text around it, for surfaces with a background of
   * their own.
   */
  plain?: boolean;
}

defineProps<Props>();

const { nowPlayingSource } = useNowPlayingSource();
</script>

<style scoped>
.now-playing-source__icon {
  flex-shrink: 0;
}
</style>
