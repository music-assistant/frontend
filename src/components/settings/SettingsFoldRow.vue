<template>
  <AccordionItem :value="value" :data-testid="`settings-fold-${value}`">
    <AccordionTrigger
      class="hover:bg-accent/50 focus-visible:ring-ring min-w-0 items-center rounded-none px-6 font-normal transition-colors hover:no-underline focus-visible:ring-2"
    >
      <!-- the trigger turns every svg directly in it when open, so the parts
           of the row sit in a line of their own and only the chevron turns -->
      <div class="flex min-w-0 flex-1 items-center gap-4">
        <SettingsRowContent :row="props" test-id-prefix="settings-fold" />
      </div>
      <template #icon>
        <ChevronDown
          class="text-muted-foreground pointer-events-none size-4 shrink-0 transition-transform duration-200"
          aria-hidden="true"
        />
      </template>
    </AccordionTrigger>
    <AccordionContent class="px-6 pt-1 pb-6 max-sm:px-4">
      <slot :open="open" />
    </AccordionContent>
  </AccordionItem>
</template>

<script setup lang="ts">
import { OPEN_FOLD_ROW_KEY } from "@/components/settings/SettingsFoldRows.vue";
import SettingsRowContent, {
  type SettingsRowHead,
} from "@/components/settings/SettingsRowContent.vue";
import {
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { ChevronDown } from "@lucide/vue";
import { inject } from "vue";

/**
 * A row of a `SettingsFoldRows` card: it looks like a settings row and folds
 * open in place to show its content.
 */
interface Props extends SettingsRowHead {
  // names the row among the open rows of its card
  value: string;
}

const props = defineProps<Props>();

defineSlots<{
  // the content of the row
  default(props: {
    // opens the row, e.g. to bring a change to its content into view
    open: () => void;
  }): unknown;
}>();

const openRow = inject(OPEN_FOLD_ROW_KEY)!;

const open = () => openRow(props.value);
</script>
