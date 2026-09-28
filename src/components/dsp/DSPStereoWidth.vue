<template>
  <div>
    <div class="p-4">
      <div class="mb-1 mt-2 flex justify-end px-1">
        <span class="text-muted-foreground">{{ model.width.toFixed(2) }}</span>
      </div>
      <div class="px-1 pb-6">
        <Slider
          :model-value="[model.width]"
          :min="0"
          :max="2"
          :step="0.05"
          @update:model-value="onSlide"
        />
        <div class="mt-2 flex justify-between text-xs text-muted-foreground">
          <span>{{ $t("settings.dsp.stereo_width.scale.mono") }}</span>
          <span>{{ $t("settings.dsp.stereo_width.scale.original") }}</span>
          <span>{{ $t("settings.dsp.stereo_width.scale.wide") }}</span>
        </div>
      </div>
    </div>
    <DSPHelp :text="$t('settings.dsp.stereo_width.help')" />
    <div v-if="model.width > 1" class="px-4 pb-4">
      <Alert variant="warning">
        <TriangleAlert />
        <AlertDescription>
          {{ $t("settings.dsp.stereo_width.clip_hint") }}
        </AlertDescription>
      </Alert>
    </div>
  </div>
</template>

<script setup lang="ts">
import { TriangleAlert } from "@lucide/vue";
import { $t } from "@/plugins/i18n";
import { StereoWidthFilter } from "@/plugins/api/interfaces";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Slider } from "@/components/ui/slider";
import DSPHelp from "./DSPHelp.vue";

const model = defineModel<StereoWidthFilter>({ required: true });

const onSlide = (value?: number[]) => {
  if (!value?.length) return;
  model.value.width = value[0];
};
</script>
