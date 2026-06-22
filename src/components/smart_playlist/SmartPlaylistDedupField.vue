<template>
  <div class="flex items-center justify-between gap-3 mb-1">
    <div class="flex items-center gap-2">
      <Label for="sp-dedup" class="text-sm">
        {{ $t("smart_playlist.dedup_hours") }}
      </Label>
      <Badge
        v-if="isInactive"
        variant="outline"
        class="text-[10px] py-0 px-1.5 h-5 gap-1 text-muted-foreground border-muted-foreground/30"
      >
        <span class="h-1.5 w-1.5 rounded-full bg-muted-foreground/60"></span>
        {{ $t("smart_playlist.filter_inactive") }}
      </Badge>
      <Tooltip>
        <TooltipTrigger as-child>
          <span class="cursor-help inline-flex">
            <HelpCircle class="h-3.5 w-3.5 text-muted-foreground" />
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" class="max-w-[260px] z-[10001]">
          {{ $t("smart_playlist.dedup_hours_tooltip") }}
        </TooltipContent>
      </Tooltip>
    </div>
    <div class="flex items-center gap-1.5">
      <NumberField
        id="sp-dedup"
        :model-value="modelValue ?? 0"
        :min="0"
        :max="2160"
        :format-options="{ useGrouping: false, maximumFractionDigits: 0 }"
        class="w-[120px]"
        @update:model-value="onChange"
        @keydown.stop
      >
        <NumberFieldContent>
          <NumberFieldDecrement />
          <NumberFieldInput class="h-8 text-sm" />
          <NumberFieldIncrement />
        </NumberFieldContent>
      </NumberField>
      <span class="text-xs text-muted-foreground">
        {{ $t("smart_playlist.hours_unit") }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  NumberField,
  NumberFieldContent,
  NumberFieldDecrement,
  NumberFieldIncrement,
  NumberFieldInput,
} from "@/components/ui/number-field";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { HelpCircle } from "@lucide/vue";
import { computed } from "vue";

const props = defineProps<{
  modelValue: number | undefined;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: number | undefined];
}>();

const isInactive = computed(
  () => props.modelValue === undefined || props.modelValue <= 0,
);

function onChange(v: number) {
  if (!v || v <= 0) {
    emit("update:modelValue", undefined);
    return;
  }
  emit("update:modelValue", Math.min(2160, Math.floor(v)));
}
</script>
