<template>
  <DropdownMenu>
    <DropdownMenuTrigger as-child>
      <Badge
        as="button"
        type="button"
        variant="secondary"
        class="cursor-pointer gap-1.5 bg-muted text-muted-foreground hover:bg-accent hover:text-accent-foreground"
        :aria-label="`${$t('tooltip.album_type')}: ${summary}`"
      >
        {{ summary }}
      </Badge>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="start">
      <!-- stays open, so several types can be ticked in one go -->
      <DropdownMenuCheckboxItem
        v-for="type in DISCOGRAPHY_TYPES"
        :key="type"
        :model-value="modelValue.includes(type)"
        :disabled="isLastTicked(type)"
        @select.prevent
        @update:model-value="toggle(type)"
      >
        {{ $t(`album_type.${type}`) }}
      </DropdownMenuCheckboxItem>
    </DropdownMenuContent>
  </DropdownMenu>
</template>

<script setup lang="ts">
import { discographyTypesLabel } from "@/components/artist/discographyRows";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  DISCOGRAPHY_TYPES,
  withDiscographyTypeToggled,
} from "@/helpers/discography_types";
import type { AlbumType } from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import { computed } from "vue";

export interface Props {
  // the ticked release types, at least one
  modelValue: AlbumType[];
}
const props = defineProps<Props>();

const emit = defineEmits<{
  (e: "update:modelValue", types: AlbumType[]): void;
}>();

// e.g. "Albums +2"
const summary = computed(() => discographyTypesLabel(props.modelValue));

/** The only ticked type can't be unticked. */
function isLastTicked(type: AlbumType): boolean {
  return props.modelValue.length === 1 && props.modelValue[0] === type;
}

function toggle(type: AlbumType) {
  emit("update:modelValue", withDiscographyTypeToggled(props.modelValue, type));
}
</script>
