<template>
  <!-- the padding keeps the badge at the same distance from the speaker for
       every glyph size, so the composition holds in the player bar and the
       player cards alike -->
  <span class="relative inline-flex p-1.5">
    <Speaker v-bind="$attrs" />
    <Badge
      data-player-group-count
      as="span"
      variant="outline"
      class="border-foreground/30 bg-background text-muted-foreground absolute -top-1 -right-1 h-4 min-w-4 rounded-full px-1 text-[10px] font-normal shadow-none"
    >
      {{ count }}
    </Badge>
  </span>
</template>

<script setup lang="ts">
import { Badge } from "@/components/ui/badge";
import { Speaker } from "@lucide/vue";

// attributes land on the speaker glyph, so callers size and style it directly
defineOptions({
  inheritAttrs: false,
});

defineProps<{
  count: number;
}>();
</script>
