<template>
  <div class="streamdetails-item" :data-stage="stage.key">
    <component :is="stage.icon" :size="22" class="streamdetails-glyph" />
    <span class="min-w-0">{{ stage.label }}</span>
    <Tooltip v-if="stage.details?.length">
      <TooltipTrigger as-child>
        <button
          type="button"
          class="streamdetails-info"
          :aria-label="$t('streamdetails.more_info')"
        >
          <Info :size="16" />
        </button>
      </TooltipTrigger>
      <TooltipContent side="top" class="z-[10001] max-w-[350px]">
        <template v-for="detail in stage.details" :key="detail">
          {{ detail }}<br />
        </template>
      </TooltipContent>
    </Tooltip>
  </div>
</template>

<script setup lang="ts">
import type { Component } from "vue";
import { Info } from "@lucide/vue";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { $t } from "@/plugins/i18n";

interface AudioProcessingDisplayStage {
  key: string;
  icon: Component;
  label: string;
  details?: string[];
}

defineProps<{ stage: AudioProcessingDisplayStage }>();
</script>
