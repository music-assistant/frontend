<template>
  <div class="@container p-4">
    <!-- On/off is the per-filter toggle in the toolbar, not a preset. -->
    <ButtonGroup class="w-full">
      <Button
        v-for="preset in presets"
        :key="preset.id"
        type="button"
        :variant="activePreset === preset.id ? 'default' : 'outline'"
        :aria-pressed="activePreset === preset.id"
        class="h-auto min-w-0 flex-1 flex-col gap-1 py-3 @sm:flex-row @sm:gap-2"
        @click="select(preset)"
      >
        <component :is="preset.icon" class="size-[22px]" :stroke-width="2.25" />
        <span>{{ $t(`settings.dsp.crossfeed.presets.${preset.id}`) }}</span>
      </Button>
    </ButtonGroup>

    <Alert variant="info" class="mt-8">
      <Info />
      <AlertDescription>
        {{ $t("settings.dsp.crossfeed.help") }}
      </AlertDescription>
    </Alert>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { Info, SignalLow, SignalMedium, SignalHigh } from "@lucide/vue";
import { $t } from "@/plugins/i18n";
import { CrossfeedFilter } from "@/plugins/api/interfaces";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
import { CROSSFEED_PRESETS, type CrossfeedPreset } from "./crossfeedPresets";

const model = defineModel<CrossfeedFilter>({ required: true });

const icons: Record<CrossfeedPreset["id"], unknown> = {
  low: SignalLow,
  medium: SignalMedium,
  high: SignalHigh,
};
const presets = CROSSFEED_PRESETS.map((preset) => ({
  ...preset,
  icon: icons[preset.id],
}));

// Preset matching the stored strength, if any.
const activePreset = computed<CrossfeedPreset["id"] | undefined>(
  () => CROSSFEED_PRESETS.find((p) => p.strength === model.value.strength)?.id,
);

// Selecting a level also enables the filter.
const select = (preset: CrossfeedPreset) => {
  model.value.strength = preset.strength;
  model.value.enabled = true;
};
</script>
