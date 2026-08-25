<!--
  Names the external source active on the player.
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
    <img
      v-if="iconDataUri"
      class="now-playing-source__icon"
      :src="iconDataUri"
      alt=""
      :style="{ filter: applyInvert ? 'invert(1)' : undefined }"
    />
    <AudioLines
      v-else
      class="now-playing-source__icon now-playing-source__fallback"
      :size="14"
      aria-hidden="true"
    />
    <span v-if="!iconOnly" class="truncate">
      {{ nowPlayingSource.name }}
    </span>
  </Badge>
</template>

<script setup lang="ts">
import { Badge } from "@/components/ui/badge";
import { useNowPlayingSource } from "@/composables/nowPlayingSource";
import { useProviderIcon } from "@/composables/useProviderIcon";
import { AudioLines } from "@lucide/vue";

interface Props {
  /**
   * Show only the provider or fallback icon. The name stays in the tooltip and
   * accessible label.
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
const { iconDataUri, applyInvert } = useProviderIcon(
  () => nowPlayingSource.value?.iconDomain,
);
</script>

<style scoped>
.now-playing-source__icon {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
  object-fit: contain;
}
</style>
