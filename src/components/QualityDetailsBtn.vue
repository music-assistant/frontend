<template>
  <!-- streaming quality details -->
  <Popover v-if="audioProcessing && streamDetails">
    <!-- quality pill/chip trigger; pill = ghost-outline to match the fullscreen
         header controls. A single clean PopoverTrigger so it opens reliably
         inside the fullscreen v-dialog (a Tooltip wrapper here blocked it). -->
    <PopoverTrigger as-child>
      <Button
        :variant="pill ? 'ghost-outline' : 'outline'"
        size="xs"
        :disabled="triggerDisabled"
        :title="$t('show_audio_chain_details')"
      >
        <span
          class="quality-pill-dot"
          :style="{
            backgroundColor: qualityTierToColor(maxOutputQualityTier),
          }"
        ></span>
        <span class="tracking-wide">{{ qualityLabel }}</span>
      </Button>
    </PopoverTrigger>

    <PopoverContent
      :side="pill ? 'bottom' : 'top'"
      align="center"
      :collision-padding="12"
      class="streamdetails-popover overflow-y-auto p-3"
      :style="{
        width: 'fit-content',
        minWidth: '320px',
        maxWidth: 'calc(100vw - 25px)',
        maxHeight: 'calc(100vh - 150px)',
      }"
      @open-auto-focus.prevent
    >
      <AudioProcessingDetails
        :chain="audioProcessing"
        :stream-details="streamDetails"
      />
    </PopoverContent>
  </Popover>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import AudioProcessingDetails from "@/components/AudioProcessingDetails.vue";
import { store } from "@/plugins/store";
import { $t } from "@/plugins/i18n";
import {
  qualityTierRangeLabel,
  qualityTierToColor,
  useStreamQuality,
} from "@/composables/useStreamQuality";

// render the quality indicator as a rounded "pill" (matching the shadcn player
// header controls) instead of the default square chip
defineProps<{ pill?: boolean }>();

const streamDetails = computed(
  () => store.activePlayerQueue?.current_item?.streamdetails,
);
const audioProcessing = computed(
  () => streamDetails.value?.audio_processing ?? undefined,
);

const { minOutputQualityTier, maxOutputQualityTier } =
  useStreamQuality(audioProcessing);

const qualityLabel = computed(() => {
  return qualityTierRangeLabel(
    minOutputQualityTier.value,
    maxOutputQualityTier.value,
  );
});

// disable the trigger when there is no active queue with items
const triggerDisabled = computed(
  () =>
    !store.activePlayerQueue ||
    !store.activePlayerQueue?.active ||
    store.activePlayerQueue?.items == 0,
);
</script>

<script lang="ts">
export const iconHiRes = new URL("@/assets/hires.png", import.meta.url).href;

export const imgCoverDark = new URL("@/assets/cover_dark.png", import.meta.url)
  .href;
export const imgCoverLight = new URL(
  "@/assets/cover_light.png",
  import.meta.url,
).href;
export const iconFolder = new URL("@/assets/folder.svg", import.meta.url).href;
</script>

<style>
.streamdetails-popover {
  /* single knob for the diagram's vertical rhythm; connector lines derive
     their heights from this so content rows and the rail stay in lockstep */
  --sd-row: 34px;
  font-size: 0.875rem;
}

.quality-pill-dot {
  display: inline-block;
  height: 8px;
  width: 8px;
  border-radius: 50%;
  flex: 0 0 auto;
}
</style>
