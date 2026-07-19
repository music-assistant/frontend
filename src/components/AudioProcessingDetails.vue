<template>
  <div class="audio-processing-details" data-testid="audio-processing-details">
    <section
      class="audio-processing-group"
      data-section="input"
      data-testid="audio-input-path"
    >
      <div class="audio-processing-header">
        <span
          class="audio-processing-quality-dot"
          :style="{ backgroundColor: qualityTierToColor(inputQualityTier) }"
        ></span>
        <span class="audio-processing-header-title">
          {{ $t("streamdetails.input_header") }}
        </span>
        <span class="audio-processing-header-meta">
          {{ inputQualityLabel }}
        </span>
        <span class="audio-processing-header-rule" aria-hidden="true"></span>
      </div>

      <div class="audio-processing-section">
        <AudioProcessingStage
          v-for="(stage, stageIndex) in inputStages"
          :key="stage.key"
          :stage="stage"
          :class="{
            'audio-processing-stage--terminal':
              outputPaths.length === 0 &&
              processingStages.length === 0 &&
              stageIndex === inputStages.length - 1,
          }"
        />
      </div>
    </section>

    <section class="audio-processing-group" data-section="processing">
      <div class="audio-processing-header">
        <span
          class="audio-processing-quality-dot audio-processing-quality-dot--neutral"
        ></span>
        <span class="audio-processing-header-title">
          {{ $t("streamdetails.processing_header") }}
        </span>
        <span
          class="audio-processing-header-rule audio-processing-header-rule--wide"
          aria-hidden="true"
        ></span>
      </div>

      <div class="audio-processing-section">
        <AudioProcessingStage
          v-for="(stage, stageIndex) in processingStages"
          :key="stage.key"
          :stage="stage"
          :class="{
            'audio-processing-stage--terminal':
              outputPaths.length === 0 &&
              stageIndex === processingStages.length - 1,
          }"
        />
      </div>
    </section>

    <section
      v-for="(output, outputIndex) in outputPaths"
      :key="output.key"
      class="audio-processing-group"
      data-section="output"
      data-testid="audio-output-path"
      :data-player-ids="output.playerIds.join(',')"
    >
      <div class="audio-processing-header">
        <span
          class="audio-processing-quality-dot"
          :style="{ backgroundColor: qualityTierToColor(output.qualityTier) }"
        ></span>
        <span class="audio-processing-header-title">
          {{ $t("streamdetails.output_header") }}
        </span>
        <span class="audio-processing-header-meta">
          {{ output.qualityLabel }}
        </span>
        <span class="audio-processing-header-rule" aria-hidden="true"></span>
      </div>

      <div class="audio-processing-section">
        <AudioProcessingStage
          v-for="stage in output.stages"
          :key="stage.key"
          :stage="stage"
        />
        <AudioProcessingStage
          :stage="output.destination"
          :class="{
            'audio-processing-stage--terminal':
              outputIndex === outputPaths.length - 1,
          }"
        />
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
import { toRef } from "vue";
import AudioProcessingStage from "@/components/AudioProcessingStage.vue";
import { useAudioProcessingDetails } from "@/composables/useAudioProcessingDetails";
import { qualityTierToColor } from "@/composables/useStreamQuality";
import { $t } from "@/plugins/i18n";
import type {
  AudioProcessingChain,
  StreamDetails,
} from "@/plugins/api/interfaces";

const props = defineProps<{
  chain: AudioProcessingChain;
  streamDetails: StreamDetails;
}>();

const {
  inputQualityTier,
  inputQualityLabel,
  inputStages,
  processingStages,
  outputPaths,
} = useAudioProcessingDetails(
  toRef(props, "chain"),
  toRef(props, "streamDetails"),
);
</script>

<style>
.audio-processing-details {
  min-width: 0;
}

.audio-processing-details .audio-processing-group + .audio-processing-group {
  margin-top: 12px;
}

.audio-processing-details .audio-processing-header {
  position: relative;
  display: grid;
  grid-template-columns: 12px max-content max-content minmax(20px, 1fr);
  column-gap: 7px;
  align-items: center;
  min-height: 22px;
}

.audio-processing-details .audio-processing-header::before {
  position: absolute;
  left: 6px;
  top: 50%;
  bottom: 0;
  border-left: 1px solid var(--border);
  content: "";
}

.audio-processing-details
  .audio-processing-group
  + .audio-processing-group
  .audio-processing-header::before {
  top: -12px;
}

.audio-processing-details .audio-processing-quality-dot {
  z-index: 1;
  grid-column: 1;
  justify-self: center;
  width: 7px;
  height: 7px;
  border-radius: 50%;
}

.audio-processing-details .audio-processing-quality-dot--neutral {
  background: var(--muted-foreground);
}

.audio-processing-details .audio-processing-header-title {
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  white-space: nowrap;
}

.audio-processing-details .audio-processing-header-meta {
  color: var(--muted-foreground);
  font-size: 0.65rem;
  white-space: nowrap;
}

.audio-processing-details .audio-processing-header-rule {
  grid-column: 4;
  width: 100%;
  height: 1px;
  background: var(--border);
}

.audio-processing-details .audio-processing-header-rule--wide {
  grid-column: 3 / 5;
}

.audio-processing-details .audio-processing-stage {
  position: relative;
  display: grid;
  grid-template-columns: 12px 16px minmax(0, 1fr) 24px;
  column-gap: 7px;
  align-items: start;
  min-height: 24px;
}

.audio-processing-details .audio-processing-stage-connector {
  box-sizing: border-box;
  grid-column: 1;
  align-self: stretch;
  position: relative;
  width: 13px;
  min-height: 24px;
  margin-left: 6px;
  border-left: 1px solid var(--border);
}

.audio-processing-details .audio-processing-stage-connector::before {
  position: absolute;
  top: 11px;
  left: -1px;
  width: 13px;
  border-top: 1px solid var(--border);
  content: "";
}

.audio-processing-details .audio-processing-stage-connector::after {
  position: absolute;
  top: 10px;
  left: -2.5px;
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: var(--muted-foreground);
  opacity: 0.7;
  content: "";
}

.audio-processing-details
  .audio-processing-stage--terminal
  .audio-processing-stage-connector {
  align-self: start;
  height: 12px;
  min-height: 0;
  border-bottom: 1px solid var(--border);
  border-bottom-left-radius: 5px;
}

.audio-processing-details
  .audio-processing-stage--terminal
  .audio-processing-stage-connector::before {
  display: none;
}

.audio-processing-details .audio-processing-stage-icon {
  grid-column: 2;
  width: 16px;
  height: 16px;
  margin-top: 4px;
}

.audio-processing-details .audio-processing-stage-copy {
  grid-column: 3;
  min-width: 0;
  padding: 3px 0;
}

.audio-processing-details .audio-processing-stage-primary {
  display: flex;
  min-width: 0;
  align-items: baseline;
  gap: 6px;
  line-height: 1.25;
}

.audio-processing-details .audio-processing-stage-title {
  min-width: 0;
  font-weight: 500;
  overflow-wrap: anywhere;
}

.audio-processing-details .audio-processing-stage-badge {
  flex: 0 0 auto;
  padding: 0 5px;
  border: 1px solid var(--border);
  border-radius: 999px;
  background: var(--muted);
  font-size: 0.625rem;
  line-height: 1.4;
  white-space: nowrap;
}

.audio-processing-details .audio-processing-stage-subtitle {
  margin-top: 1px;
  color: var(--muted-foreground);
  font-size: 0.72rem;
  line-height: 1.25;
  overflow-wrap: anywhere;
}

.audio-processing-details .audio-processing-stage-subtitle-part--atomic {
  display: inline-block;
  white-space: nowrap;
}

.audio-processing-details .audio-processing-stage-info {
  grid-column: 4;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  justify-self: end;
  width: 22px;
  height: 22px;
  margin-top: 1px;
  padding: 0;
  border: none;
  border-radius: 50%;
  background: none;
  color: var(--muted-foreground);
  cursor: pointer;
}

.audio-processing-details .audio-processing-stage-info:hover {
  background: var(--muted);
  color: var(--foreground);
}

.audio-processing-details .audio-processing-stage-info:focus-visible {
  outline: 2px solid var(--ring);
  outline-offset: 1px;
}
</style>
