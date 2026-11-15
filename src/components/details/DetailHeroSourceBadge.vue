<template>
  <!-- a phone header keeps to the item and how to play it; the chrome matches
       the hero buttons -->
  <ItemSourceBadge
    v-if="!isPhone"
    class="size-9 rounded-md border border-white/25 bg-black/40"
    :item="item"
    :size="20"
    :library-only="libraryOnly"
  />
</template>

<script setup lang="ts">
import ItemSourceBadge from "@/components/ItemSourceBadge.vue";
import type { MediaItemType } from "@/plugins/api/interfaces";
import { isPhoneSizedScreen } from "@/plugins/breakpoint";
import { computed } from "vue";

export interface Props {
  item: MediaItemType;
  // show nothing for an item outside the library, where its sources are listed elsewhere
  libraryOnly?: boolean;
}
withDefaults(defineProps<Props>(), {
  libraryOnly: false,
});

const isPhone = computed(() => isPhoneSizedScreen());
</script>
