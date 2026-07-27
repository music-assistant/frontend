<template>
  <div class="p-4">
    <div class="flex items-center gap-4 pb-7">
      <div class="relative min-w-0 flex-1 px-1">
        <Slider
          class="dsp-slider"
          :model-value="[sliderValue]"
          :min="MIN_SEMITONES"
          :max="MAX_SEMITONES"
          :step="1"
          @update:model-value="onSlide"
        />
        <div
          class="pointer-events-none absolute inset-x-1 top-full mt-2 flex justify-between text-xs text-muted-foreground"
        >
          <span>{{ format(MIN_SEMITONES) }}</span>
          <span>{{ $t("settings.dsp.transpose.original_key") }}</span>
          <span>+{{ format(MAX_SEMITONES) }}</span>
        </div>
      </div>
      <Input
        v-model="fieldValue"
        type="number"
        :min="MIN_SEMITONES"
        :max="MAX_SEMITONES"
        step="0.001"
        class="max-w-[100px]"
        :aria-label="$t('settings.dsp.types.transpose')"
        @focus="isEditing = true"
        @blur="isEditing = false"
      />
      <span class="min-w-[90px] text-muted-foreground">
        {{ unitLabel }}
      </span>
    </div>

    <div class="flex flex-wrap items-center gap-3">
      <Button
        variant="outline"
        size="sm"
        :class="isConcertPitch432 ? 'border-primary text-primary' : ''"
        @click="setConcertPitch432"
      >
        {{ $t("settings.dsp.transpose.concert_pitch_432") }}
      </Button>
      <span class="text-xs text-muted-foreground">
        {{ $t("settings.dsp.transpose.concert_pitch_432_hint") }}
      </span>
    </div>

    <Alert variant="info" class="mt-4">
      <Info />
      <AlertDescription>
        {{ $t("settings.dsp.transpose.help") }}
      </AlertDescription>
    </Alert>
    <Alert v-if="model.semitones !== 0" variant="warning" class="mt-2">
      <TriangleAlert />
      <AlertDescription>
        {{ $t("settings.dsp.transpose.cpu_hint") }}
      </AlertDescription>
    </Alert>
  </div>
</template>

<script setup lang="ts">
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { TransposeFilter } from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import { Info, TriangleAlert } from "@lucide/vue";
import { computed, ref } from "vue";

const MIN_SEMITONES = -6;
const MAX_SEMITONES = 6;
// A=432Hz instead of the usual A=440Hz, a fraction of a semitone down.
const CONCERT_PITCH_432_SEMITONES = -0.318;

const model = defineModel<TransposeFilter>({ required: true });
const isEditing = ref(false);

const clamp = (value: number): number =>
  Math.min(MAX_SEMITONES, Math.max(MIN_SEMITONES, value));

// Fractional values are meaningful here, so keep the decimals and only drop
// trailing zeros.
const format = (value: number): string => Number(value.toFixed(3)).toString();

const unitLabel = computed(() => {
  const semitones = model.value.semitones;
  if (semitones === 0) return $t("settings.dsp.transpose.original_key");
  return Math.abs(semitones) === 1
    ? $t("settings.dsp.transpose.unit_singular")
    : $t("settings.dsp.transpose.unit");
});

const sliderValue = computed(() => model.value.semitones);

const onSlide = (value?: number[]) => {
  if (!value?.length) return;
  model.value.semitones = clamp(value[0]);
};

const fieldValue = computed({
  get: () =>
    isEditing.value
      ? model.value.semitones.toString()
      : format(model.value.semitones),
  set: (value: string) => {
    const semitones = Number(value);
    if (!Number.isFinite(semitones)) return;
    model.value.semitones = clamp(semitones);
  },
});

const isConcertPitch432 = computed(
  () => model.value.semitones === CONCERT_PITCH_432_SEMITONES,
);

const setConcertPitch432 = () => {
  model.value.semitones = CONCERT_PITCH_432_SEMITONES;
};
</script>
