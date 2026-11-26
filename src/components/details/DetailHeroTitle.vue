<template>
  <h1
    :class="{ 'line-clamp-2': clamp }"
    class="m-0 text-[44px] leading-[1.2] font-medium tracking-[-1.1px] [overflow-wrap:anywhere] [text-shadow:0_2px_12px_rgba(0,0,0,0.5)] @max-3xl/detail-hero:text-[30px] @max-3xl/detail-hero:tracking-[-0.7px]"
  >
    <!-- the one h1 of the hero, which its pinned bar watches to show the name;
         a logo stands in for the name but the same h1 stays, so the bar keeps
         watching it when the logo comes or goes -->
    <img
      v-if="logo"
      class="inline-block h-20 w-auto align-bottom max-w-full object-contain @max-3xl/detail-hero:h-14"
      :src="logo"
      alt=""
    />
    <span :class="{ 'sr-only': logo }">{{ item.name }}</span>
    <template v-if="!logo">
      <span v-if="version" class="text-[0.6em] tracking-normal text-white/70">
        ({{ version }})
      </span>
      <ExplicitBadge
        v-if="explicit"
        class="ml-1.5 align-middle [--explicit-icon-letter:#fff] [--explicit-icon-square:rgba(255,255,255,0.25)]"
      />
    </template>
  </h1>
</template>

<script setup lang="ts">
import ExplicitBadge from "@/components/details/ExplicitBadge.vue";
import type { MediaItemType } from "@/plugins/api/interfaces";
import { computed } from "vue";

export interface Props {
  item: MediaItemType;
  // an image url shown in place of the name, such as an artist's logo
  logo?: string;
  // cut a long name at two lines; a page whose name is all it has shows it whole
  clamp?: boolean;
}
const props = withDefaults(defineProps<Props>(), {
  logo: undefined,
  clamp: true,
});

const version = computed(() =>
  "version" in props.item ? props.item.version : undefined,
);
const explicit = computed(
  () => "metadata" in props.item && !!props.item.metadata?.explicit,
);
</script>
