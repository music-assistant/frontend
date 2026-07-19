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
        :aria-label="qualityDetailsLabel"
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
      :collision-padding="8"
      class="audio-processing-popover overflow-y-auto"
      data-testid="audio-processing-popover-content"
      :aria-label="$t('show_audio_chain_details')"
      @open-auto-focus="focusPopoverContent"
    >
      <div
        ref="popoverFocusTarget"
        class="audio-processing-popover-focus-target outline-none"
        tabindex="-1"
      >
        <AudioProcessingDetails
          :chain="audioProcessing"
          :stream-details="streamDetails"
        />
      </div>
    </PopoverContent>
  </Popover>
</template>

<script setup lang="ts">
import { computed, ref } from "vue";
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
const qualityDetailsLabel = computed(() =>
  qualityLabel.value
    ? $t("show_audio_chain_details_for_quality", {
        quality: qualityLabel.value,
      })
    : $t("show_audio_chain_details"),
);
const popoverFocusTarget = ref<HTMLElement>();

// disable the trigger when there is no active queue with items
const triggerDisabled = computed(
  () =>
    !store.activePlayerQueue ||
    !store.activePlayerQueue?.active ||
    store.activePlayerQueue?.items == 0,
);

function focusPopoverContent(event: Event): void {
  event.preventDefault();
  popoverFocusTarget.value?.focus();
}
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
.audio-processing-popover[data-slot="popover-content"] {
  width: min(420px, calc(100vw - 16px));
  max-width: calc(100vw - 16px);
  max-height: calc(100vh - 16px);
  max-height: min(
    560px,
    calc(100dvh - 16px),
    var(--reka-popover-content-available-height, calc(100dvh - 16px))
  );
  padding: 12px;
  font-size: 0.8125rem;
  line-height: 1.35;
  overscroll-behavior: contain;
}

.quality-pill-dot {
  display: inline-block;
  height: 8px;
  width: 8px;
  border-radius: 50%;
  flex: 0 0 auto;
}

@media (max-width: 379px) {
  .audio-processing-popover[data-slot="popover-content"] {
    padding: 10px;
    font-size: 0.8rem;
  }
}
</style>
