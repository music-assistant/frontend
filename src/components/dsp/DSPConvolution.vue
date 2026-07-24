<template>
  <div>
    <div class="px-4 pb-0 pt-2">
      <Label class="mb-1.5 block text-muted-foreground">
        {{ $t("settings.dsp.convolution.impulse_response") }}
      </Label>
      <div class="@container flex items-center gap-2">
        <Select
          :model-value="selectedIRId"
          @update:model-value="(val) => (selectedIRId = val as string)"
        >
          <SelectTrigger class="w-full min-w-0">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem
              v-for="item in irItems"
              :key="item.value"
              :value="item.value"
            >
              <div class="flex flex-col">
                <span>{{ item.title }}</span>
                <span
                  v-if="item.subtitle"
                  class="text-xs text-muted-foreground"
                >
                  {{ item.subtitle }}
                </span>
              </div>
            </SelectItem>
          </SelectContent>
        </Select>
        <Button
          variant="secondary"
          class="shrink-0"
          @click="showManager = true"
        >
          <Library />
          <span class="hidden @md:inline">
            {{ $t("settings.dsp.convolution.manage_irs") }}
          </span>
        </Button>
      </div>
    </div>

    <DSPSlider v-model="gain" type="gain" />

    <div class="px-4">
      <Alert variant="info" class="mb-4">
        <Info />
        <AlertDescription>
          {{ $t("settings.dsp.convolution.help") }}
        </AlertDescription>
      </Alert>
    </div>

    <DSPIRManager
      v-model="showManager"
      :irs="irs"
      @uploaded="onUploaded"
      @removed="onRemoved"
    />
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { Info, Library } from "@lucide/vue";
import type {
  ConvolutionFilter,
  DSPIRMetadata,
} from "@/plugins/api/interfaces";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useDSPIRs } from "@/composables/useDSPIRs";
import { dspIRDetailText } from "@/helpers/dspIR";
import DSPSlider from "./DSPSlider.vue";
import DSPIRManager from "./DSPIRManager.vue";

const { t } = useI18n();

const filter = defineModel<ConvolutionFilter>({ required: true });

const { irs, refresh } = useDSPIRs();
const showManager = ref(false);

// The server accepts -60..60 dB; the slider itself only spans the usual ±15,
// but the number field next to it takes any value.
const MIN_GAIN = -60;
const MAX_GAIN = 60;

// reka-ui's Select rejects an empty-string item value, so the "none" option
// carries a sentinel that maps back to the empty id the server expects.
const NONE_VALUE = "__none__";

const irItems = computed(() => {
  const items = [
    {
      value: NONE_VALUE,
      title: t("settings.dsp.convolution.none"),
      subtitle: undefined as string | undefined,
    },
    ...irs.value.map((ir) => ({
      value: ir.ir_id,
      title: ir.name,
      subtitle: dspIRDetailText(ir),
    })),
  ];
  // An id we can't resolve means the IR was removed (or the config came from
  // another server) — show it rather than silently rendering an empty field.
  const irId = filter.value.ir_id;
  if (irId && !irs.value.some((ir) => ir.ir_id === irId)) {
    items.push({
      value: irId,
      title: t("settings.dsp.convolution.missing"),
      subtitle: undefined,
    });
  }
  return items;
});

const selectedIRId = computed({
  get: () => filter.value.ir_id || NONE_VALUE,
  set: (value: string) => {
    filter.value.ir_id = value === NONE_VALUE ? "" : (value ?? "");
  },
});

const gain = computed({
  get: () => filter.value.gain,
  set: (value: number) => {
    if (Number.isNaN(value)) return;
    filter.value.gain = Math.min(MAX_GAIN, Math.max(MIN_GAIN, value));
  },
});

const onUploaded = (ir: DSPIRMetadata) => {
  void refresh();
  filter.value.ir_id = ir.ir_id;
  showManager.value = false;
};

const onRemoved = (irId: string) => {
  void refresh();
  // The server blanks the reference server-side; mirror it locally so the
  // editor doesn't hold a dangling id until the update event lands.
  if (filter.value.ir_id === irId) filter.value.ir_id = "";
};
</script>
