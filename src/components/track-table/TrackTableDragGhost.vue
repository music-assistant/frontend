<template>
  <div
    class="pointer-events-none absolute inset-x-0 z-10 rounded-md bg-accent shadow-lg"
    :style="{ top: `${top}px` }"
    aria-hidden="true"
    inert
  >
    <TrackTableRow
      :item="item"
      :index="index"
      :columns="columns"
      :is-selected="false"
      :is-available="isAvailable"
      :parent-item="parentItem"
    />
    <span
      v-if="count > 1"
      class="absolute -top-2 left-2 rounded-full bg-primary px-2 text-xs font-semibold leading-5 text-primary-foreground"
    >
      {{ $t("n_tracks", count, { named: { count } }) }}
    </span>
  </div>
</template>

<script setup lang="ts">
import type { MediaItemType } from "@/plugins/api/interfaces";
import TrackTableRow from "./TrackTableRow.vue";
import type { TrackColumn } from "./trackTableColumns";

export interface Props {
  item: MediaItemType;
  index: number;
  columns: TrackColumn[];
  count: number;
  // px from the top of the list
  top: number;
  isAvailable?: boolean;
  parentItem?: MediaItemType;
}

withDefaults(defineProps<Props>(), {
  isAvailable: true,
  parentItem: undefined,
});
</script>
