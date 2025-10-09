<template>
  <v-slider
    ref="sliderRef"
    v-bind="playerVolumeProps"
    @wheel.prevent="onWheel"
    @start="onDragStart"
    @update:model-value="onDrag"
    @end="onDragEnd"
  >
    <!-- Dynamically inherit slots from parent -->
    <!-- @vue-ignore -->
    <template v-for="(value, name) in $slots as unknown" #[name]>
      <slot :name="name"></slot>
    </template>
  </v-slider>
</template>

<script lang="ts">
import { computed, ref } from "vue";

export default {
  props: {
    // eslint-disable-next-line vue/require-default-prop
    width: String,
    // eslint-disable-next-line vue/require-default-prop
    height: String,
    // eslint-disable-next-line vue/require-default-prop
    style: String,
    allowWheel: Boolean,
  },
  emits: ["update:model-value"],
  setup(props, ctx) {
    const sliderRef = ref(null);
    const isDragging = ref(false);
    const startValue = ref(0);
    const lastEmitTime = ref(0);
    const clickCooldown = 250; // milliseconds

    const playerVolumeDefaults = computed(() => ({
      class: "player-volume",
      hideDetails: true,
      trackSize: 2,
      thumbSize: 12, // Always visible thumb
      step: 2,
      elevation: 0,
      style: `width: ${props.width}; height:${props.height}; display: inline-grid; ${props.style}`,
    }));

    const playerVolumeProps = computed(() => ({
      ...playerVolumeDefaults.value,
      ...ctx,
    }));

    const onWheel = ({ deltaY }: WheelEvent) => {
      if (!props.allowWheel) return;
      const step = playerVolumeProps.value.step;

      const volumeValue = ctx.attrs["model-value"] as number;
      const volumeDelta = deltaY < 0 ? step : -step;

      ctx.emit("update:model-value", volumeValue + volumeDelta);
    };

    const onDragStart = () => {
      startValue.value = ctx.attrs["model-value"] as number;
      isDragging.value = true;
    };

    const onDrag = (_newValue: number) => {
      // Don't emit during drag, let the slider update visually
      // We'll decide what to emit in onDragEnd based on the total change
    };

    const onDragEnd = (endValue: number) => {
      const step = playerVolumeProps.value.step;
      const diff = Math.abs(endValue - startValue.value);
      const now = Date.now();

      // If it's a small change, treat as drag and allow it
      if (diff <= step * 2) {
        ctx.emit("update:model-value", endValue);
        isDragging.value = false;
        return;
      }

      // Large change = click on track, convert to step increment
      // Check cooldown to prevent double-clicks
      if (now - lastEmitTime.value < clickCooldown) {
        ctx.emit("update:model-value", startValue.value);
        isDragging.value = false;
        return;
      }

      // Determine direction and apply step change
      const volumeDelta = endValue > startValue.value ? step : -step;
      const steppedValue = Math.max(
        0,
        Math.min(100, startValue.value + volumeDelta),
      );

      ctx.emit("update:model-value", steppedValue);
      lastEmitTime.value = now;
      isDragging.value = false;
    };

    return {
      playerVolumeProps,
      onWheel,
      sliderRef,
      onDragStart,
      onDrag,
      onDragEnd,
      isDragging,
    };
  },
};
</script>

<style scoped>
.v-slider.v-input--horizontal .v-input__control {
  min-height: 5px;
}

.v-slider.v-input--horizontal {
  margin-inline: unset !important;
}
</style>
