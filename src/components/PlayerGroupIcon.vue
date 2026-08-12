<template>
  <!-- the padding is what the badge overlaps into, so the count keeps the same
       grip on the speaker for every glyph size; the trigger around it carries
       the accessible name, count included -->
  <span class="relative inline-flex p-1.5" aria-hidden="true">
    <Speaker :stroke-width="1.4" v-bind="$attrs" />
    <Badge
      data-player-group-count
      as="span"
      variant="outline"
      class="border-foreground/30 bg-background text-muted-foreground absolute top-0 right-0 h-4.5 min-w-4.5 rounded-full px-1 text-[11px] font-normal shadow-none"
    >
      {{ count }}
    </Badge>
  </span>
</template>

<script setup lang="ts">
import { Badge } from "@/components/ui/badge";
import { Speaker } from "@lucide/vue";

// attributes land on the speaker glyph, so callers size it directly
defineOptions({
  inheritAttrs: false,
});

defineProps<{
  count: number;
}>();
</script>
