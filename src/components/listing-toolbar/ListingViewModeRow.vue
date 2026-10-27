<template>
  <DropdownMenuLabel :class="MENU_SECTION_LABEL_CLASS">
    {{ $t("view.view_as") }}
  </DropdownMenuLabel>
  <!-- the three views side by side, each an icon over its short name -->
  <DropdownMenuRadioGroup
    :model-value="modelValue"
    class="flex gap-1 px-1 pb-1"
    @update:model-value="select"
  >
    <DropdownMenuRadioItem
      v-for="view in VIEW_MODES"
      :key="view.value"
      :value="view.value"
      :aria-label="$t(view.label)"
      class="flex-1 flex-col justify-center gap-1 rounded-md px-1 py-2 text-xs data-[state=checked]:bg-primary/15 data-[state=checked]:text-primary"
    >
      <template #indicator-icon><span></span></template>
      <component :is="view.icon" class="size-[18px]" />
      <span class="truncate">{{ $t(view.shortLabel) }}</span>
    </DropdownMenuRadioItem>
  </DropdownMenuRadioGroup>
</template>

<script setup lang="ts">
import {
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from "@/components/ui/dropdown-menu";
import {
  MENU_SECTION_LABEL_CLASS,
  VIEW_MODES,
  type ListingViewMode,
} from "./constants";

defineProps<{
  modelValue: string;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: ListingViewMode];
}>();

const select = (value: unknown) => {
  const view = VIEW_MODES.find((item) => item.value === value);
  if (view) emit("update:modelValue", view.value);
};
</script>
