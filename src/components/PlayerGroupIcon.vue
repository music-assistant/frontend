<template>
  <!-- the padding is the corner the badge sits in, so the count keeps the same
       grip on the speaker for every glyph size; the trigger around it carries
       the accessible name, count included -->
  <span class="relative inline-flex p-1.5" aria-hidden="true">
    <Speaker v-bind="$attrs" />
    <!-- filled from the theme rather than the trigger's colour, which turns
         primary while hovered or open and would leave the count unreadable -->
    <Badge
      data-player-group-count
      as="span"
      variant="outline"
      :class="[
        'absolute rounded-full border-transparent bg-muted-foreground/90 px-1 font-normal shadow-none',
        outsetCount
          ? '-top-0.5 -right-0.5 h-4.25 min-w-4.25 text-[10px]'
          : 'top-0 right-0 h-4.5 min-w-4.5 text-[11px]',
      ]"
    >
      <span class="text-background">{{ count }}</span>
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
  // the speaker is small enough in the player drawer that a count sitting on
  // top of it hides the glyph, so callers at that size pull it out onto the
  // corner instead; the player bar has the room and keeps the tighter tuck
  outsetCount?: boolean;
}>();
</script>
