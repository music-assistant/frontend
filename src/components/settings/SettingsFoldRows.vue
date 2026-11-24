<template>
  <!-- a closed row keeps its content mounted, so folding a form keeps its
       unsaved edits -->
  <Accordion
    :model-value="open"
    type="multiple"
    :unmount-on-hide="false"
    class="bg-card overflow-hidden rounded-xl border shadow-sm"
    data-testid="settings-fold-rows"
    @update:model-value="setOpen"
  >
    <slot />
  </Accordion>
</template>

<script lang="ts">
import type { InjectionKey } from "vue";

// opens the row of the card with the given value
export const OPEN_FOLD_ROW_KEY: InjectionKey<(value: string) => void> =
  Symbol("open-fold-row");
</script>

<script setup lang="ts">
import { Accordion } from "@/components/ui/accordion";
import { provide } from "vue";

/**
 * A card of settings rows that each fold open in place, all closed at first.
 * Its rows are `SettingsFoldRow`s in the default slot; its v-model holds the
 * values of the open rows.
 */
const open = defineModel<string[]>({ default: () => [] });

defineSlots<{
  default(): unknown;
}>();

const setOpen = function (value: string | string[] | undefined) {
  open.value = Array.isArray(value) ? value : [];
};

provide(OPEN_FOLD_ROW_KEY, (value) => {
  if (!open.value.includes(value)) open.value = [...open.value, value];
});
</script>
