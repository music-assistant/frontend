<template>
  <div class="flex items-center justify-between gap-3">
    <div class="flex items-center gap-2">
      <Label class="text-sm">{{ $t("smart_playlist.dedup_hours") }}</Label>
      <Tooltip>
        <TooltipTrigger as-child>
          <span class="cursor-help inline-flex">
            <HelpCircle class="h-3.5 w-3.5 text-muted-foreground" />
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" class="max-w-[220px] z-[10001]">
          {{ $t("smart_playlist.dedup_hours_tooltip") }}
        </TooltipContent>
      </Tooltip>
    </div>
    <div class="flex items-center gap-2">
      <Select
        :model-value="String(modelValue ?? 0)"
        @update:model-value="onChange"
      >
        <SelectTrigger class="h-8 w-[110px] text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="0" class="text-xs">
            {{ $t("smart_playlist.off") }}
          </SelectItem>
          <SelectItem
            v-for="h in presets"
            :key="h"
            :value="String(h)"
            class="text-xs"
          >
            {{ h }}h
          </SelectItem>
        </SelectContent>
      </Select>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { AcceptableValue } from "reka-ui";
import { HelpCircle } from "lucide-vue-next";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

defineProps<{
  modelValue: number | undefined;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: number | undefined];
}>();

const presets = [1, 2, 4, 6, 12, 24, 48, 72, 168];

function onChange(v: AcceptableValue) {
  const n = Number(v ?? 0);
  emit("update:modelValue", !n ? undefined : n);
}
</script>
