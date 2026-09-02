<template>
  <!-- Padding leaves the badge a corner to occupy without covering the glyph. -->
  <span class="relative inline-flex p-1.5" aria-hidden="true">
    <component :is="icon" v-bind="$attrs" />
    <Badge
      v-if="grouped"
      data-player-group-count
      as="span"
      variant="outline"
      class="absolute top-0 right-0 h-4.5 min-w-4.5 rounded-full border-transparent bg-blue-500 px-1 text-[11px] font-normal shadow-none"
    >
      <span class="text-white">{{ count }}</span>
    </Badge>
  </span>
</template>

<script setup lang="ts">
import { Badge } from "@/components/ui/badge";
import { CircleFadingPlus, Copy } from "@lucide/vue";
import { computed } from "vue";

defineOptions({
  inheritAttrs: false,
});

const props = defineProps<{
  count: number;
}>();

const grouped = computed(() => props.count > 1);
const icon = computed(() => (grouped.value ? Copy : CircleFadingPlus));
</script>
