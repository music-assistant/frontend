<script setup lang="ts">
import { Label } from "@/components/ui/label";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { $t } from "@/plugins/i18n";
import { Info } from "@lucide/vue";

defineProps<{
  /** Already-translated field label. */
  label: string;
  /** Already-translated explanation, shown behind an info icon. Omit for no icon. */
  description?: string;
  /** Forwarded to the underlying label's `for` attribute. */
  htmlFor?: string;
}>();
</script>

<template>
  <div class="flex items-center gap-1.5">
    <Label :for="htmlFor">{{ label }}</Label>
    <TooltipProvider v-if="description" :delay-duration="200">
      <Tooltip>
        <TooltipTrigger as-child>
          <button
            type="button"
            class="text-muted-foreground shrink-0 opacity-60 hover:opacity-100"
            :aria-label="$t('tooltip.help')"
          >
            <Info :size="14" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" class="max-w-[300px]">
          {{ description }}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  </div>
</template>
