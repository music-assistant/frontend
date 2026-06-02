<template>
  <EditorialMediaCard
    fluid
    :item="item"
    :is-available="isAvailable"
    :is-selected="isSelected"
    :show-checkboxes="showCheckboxes"
    :is-playing="isPlaying"
    :disable-play-button="disablePlayButton"
    :disabled="disabled"
    :parent-item="parentItem"
    :sort-by="sortBy"
    :show-provider-on-cover="showProviderOnCover"
    @select="(i, selected) => emit('select', i, selected)"
  />
</template>

<script setup lang="ts">
import EditorialMediaCard from "@/components/discover/EditorialMediaCard.vue";
import { ItemMapping, type MediaItemType } from "@/plugins/api/interfaces";

export interface Props {
  item: MediaItemType | ItemMapping;
  size?: number;
  isSelected?: boolean;
  showCheckboxes?: boolean;
  permanentOverlay?: boolean;
  showProviderOnCover?: boolean;
  isAvailable?: boolean;
  isPlaying?: boolean;
  disablePlayButton?: boolean;
  parentItem?: MediaItemType;
  sortBy?: string;
  disabled?: boolean;
}
withDefaults(defineProps<Props>(), {
  size: 200,
  isSelected: false,
  showCheckboxes: false,
  permanentOverlay: false,
  showProviderOnCover: false,
  isAvailable: true,
  disablePlayButton: false,
  disabled: false,
  parentItem: undefined,
  sortBy: undefined,
});

const emit = defineEmits<{
  (e: "select", item: MediaItemType | ItemMapping, selected: boolean): void;
}>();
</script>
