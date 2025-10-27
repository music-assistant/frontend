<template>
  <v-slider
    ref="sliderRef"
    v-bind="playerVolumeProps"
    :model-value="displayValue"
    @wheel.prevent="onWheel"
    @click.stop
    @start="onDragStart"
    @update:model-value="onUpdateModelValue"
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
import { store } from "@/plugins/store";
import { computed, ref, watch } from "vue";

export default {
  inheritAttrs: false,
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
    const startValue = ref(0);
    const updateCount = ref(0);
    const lastEnd = ref(0);
    const displayValue = ref<number>(
      typeof ctx.attrs["model-value"] === "number"
        ? (ctx.attrs["model-value"] as number)
        : 0,
    );

    const playerVolumeDefaults = computed(() => ({
      class: "player-volume",
      hideDetails: true,
      trackSize: 2,
      thumbSize: 20,
      step: 2,
      elevation: 0,
      style: `width: ${props.width}; height:${props.height}; display: inline-grid; ${props.style}`,
    }));

    const sliderAttrs = computed(() => {
      const attrs = ctx.attrs as Record<string, unknown>;
      const { "model-value": _mv, modelValue: _mv2, ...rest } = attrs || {};

      return rest;
    });

    const playerVolumeProps = computed(() => ({
      ...playerVolumeDefaults.value,
      ...sliderAttrs.value,
    }));

    const onWheel = ({ deltaY }: WheelEvent) => {
      if (!props.allowWheel) return;
      const step = playerVolumeProps.value.step;

      const volumeValue =
        (ctx.attrs["model-value"] as number) ?? displayValue.value;
      const volumeDelta = deltaY < 0 ? step : -step;

      const newValue = Math.max(0, Math.min(100, volumeValue + volumeDelta));
      displayValue.value = newValue;
      ctx.emit("update:model-value", newValue);
    };

    const onDragStart = (value: number) => {
      startValue.value = value;
      updateCount.value = 0;
      displayValue.value = value;

      if (store.isTouchscreen && "vibrate" in navigator && navigator.vibrate) {
        navigator.vibrate(10);
      }
    };

    const onUpdateModelValue = (newValue: number) => {
      updateCount.value++;

      if (updateCount.value > 2) {
        displayValue.value = newValue;
      }
    };

    const onDragEnd = (endValue: number) => {
      // Cooldown to avoid duplicate emits only for moible click (otherwise it fires 2 be calls)
      const now = Date.now();
      if (now - lastEnd.value < 250) {
        return;
      }
      lastEnd.value = now;

      const step = playerVolumeProps.value.step;

      // If we had many updates, that means it was a drag so we emit only the final value
      if (updateCount.value > 3) {
        displayValue.value = endValue;
        ctx.emit("update:model-value", endValue);
      } else {
        const volumeDelta = endValue > startValue.value ? step : -step;
        const newVolume = Math.max(
          0,
          Math.min(100, startValue.value + volumeDelta),
        );
        displayValue.value = newVolume;
        ctx.emit("update:model-value", newVolume);
      }

      updateCount.value = 0;
    };

    watch(
      () => ctx.attrs["model-value"] as number,
      (val) => {
        if (typeof val === "number" && updateCount.value === 0) {
          displayValue.value = val;
        }
      },
    );

    return {
      playerVolumeProps,
      onWheel,
      sliderRef,
      onDragStart,
      onUpdateModelValue,
      onDragEnd,
      displayValue,
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
