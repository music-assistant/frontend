<template>
  <Popover>
    <PopoverTrigger as-child>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        class="h-8 gap-1.5 rounded-full border border-border bg-muted/40 px-2 text-[11px] font-normal text-muted-foreground"
        :aria-label="accessibleLabel"
      >
        {{ $t("statistics_library_based") }}
        <Info class="size-3.5" aria-hidden="true" />
      </Button>
    </PopoverTrigger>
    <PopoverContent
      align="start"
      :collision-padding="12"
      class="max-w-[calc(100vw-24px)] text-sm"
      :aria-label="accessibleLabel"
    >
      <p class="m-0">{{ explanation }}</p>
    </PopoverContent>
  </Popover>
</template>

<script setup lang="ts">
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { $t } from "@/plugins/i18n";
import { Info } from "@lucide/vue";
import { computed } from "vue";

interface Props {
  statistic: string;
  explanation: string;
}

const props = defineProps<Props>();

const accessibleLabel = computed(() =>
  $t("statistics_library_based_about", { statistic: props.statistic }),
);
</script>
