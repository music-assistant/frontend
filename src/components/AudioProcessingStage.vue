<template>
  <div class="audio-processing-stage" :data-stage="stage.key">
    <span class="audio-processing-stage-connector" aria-hidden="true"></span>
    <component
      :is="stage.icon"
      :size="16"
      class="audio-processing-stage-icon"
    />
    <div class="audio-processing-stage-copy">
      <div class="audio-processing-stage-primary">
        <span class="audio-processing-stage-title">{{ stage.title }}</span>
        <span v-if="stage.badge" class="audio-processing-stage-badge">
          {{ stage.badge }}
        </span>
      </div>
      <div
        v-if="stage.subtitleParts?.length"
        class="audio-processing-stage-subtitle"
      >
        <span
          v-for="(part, index) in stage.subtitleParts"
          :key="`${index}-${part}`"
          class="audio-processing-stage-subtitle-part"
          :class="{
            'audio-processing-stage-subtitle-part--atomic':
              stage.atomicSubtitleParts,
          }"
        >
          {{ index === 0 ? part : ` · ${part}` }}
        </span>
      </div>
    </div>
    <Popover v-if="stage.details?.length">
      <PopoverTrigger as-child>
        <button
          type="button"
          class="audio-processing-stage-info"
          :aria-label="
            $t('streamdetails.more_info_for', {
              item: stage.title,
            })
          "
          :aria-describedby="detailsId"
        >
          <Info :size="14" />
        </button>
      </PopoverTrigger>
      <PopoverContent
        side="top"
        align="end"
        :aria-label="
          $t('streamdetails.more_info_for', {
            item: stage.title,
          })
        "
        class="audio-processing-stage-details-popover !z-[10001] w-fit max-w-[280px] p-2 text-left text-xs"
        @open-auto-focus="focusDetails"
      >
        <div
          ref="detailsFocusTarget"
          class="audio-processing-stage-detail-content outline-none"
          tabindex="-1"
          role="document"
        >
          <ul class="m-0 grid list-none gap-1 p-0 leading-snug">
            <li
              v-for="(detail, index) in stage.details"
              :key="`${index}-${detail}`"
            >
              {{ detail }}
            </li>
          </ul>
        </div>
      </PopoverContent>
    </Popover>
    <span v-if="stage.details?.length" :id="detailsId" class="sr-only">
      {{ stage.details.join(". ") }}
    </span>
  </div>
</template>

<script setup lang="ts">
import { ref, useId } from "vue";
import { Info } from "@lucide/vue";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import type { AudioProcessingDisplayStage } from "@/composables/useAudioProcessingDetails";
import { $t } from "@/plugins/i18n";

defineProps<{ stage: AudioProcessingDisplayStage }>();
const detailsId = useId();
const detailsFocusTarget = ref<HTMLElement>();

function focusDetails(event: Event): void {
  event.preventDefault();
  detailsFocusTarget.value?.focus();
}
</script>

<style>
.audio-processing-stage-details-popover[data-slot="popover-content"] {
  max-height: min(
    320px,
    var(--reka-popover-content-available-height, calc(100dvh - 16px))
  );
  overflow-y: auto;
  overscroll-behavior: contain;
}
</style>
