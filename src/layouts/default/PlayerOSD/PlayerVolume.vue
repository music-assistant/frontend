<template>
  <v-slider
    ref="sliderRef"
    v-bind="playerVolumeProps"
    :model-value="localValue"
    @wheel.prevent="onWheel"
    @click.stop
    @touchstart="onTouchStart"
    @touchmove="onTouchMove"
    @start="onDragStart"
    @update:model-value="onUpdateModelValue"
    @end="onDragEnd"
  >
    <!-- Dynamically inherit slots from parent -->
    <!-- @vue-ignore -->
    <template v-for="(value, name) in $slots as unknown" #[name]>
      <slot :name="name" :local-value="localValue"></slot>
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
  emits: ["update:model-value", "update:local-value"],
  setup(props, ctx) {
    const sliderRef = ref(null);
    const startValue = ref(0);
    const updateCount = ref(0);
    const lastEnd = ref(0);

    const localValue = ref<number>(
      typeof ctx.attrs["model-value"] === "number"
        ? (ctx.attrs["model-value"] as number)
        : 0,
    );

    const touchStartX = ref(0);
    const touchStartY = ref(0);
    const isScrolling = ref(false);
    const pendingFinalValue = ref<number | null>(null);
    const blockBackendUpdatesUntil = ref(0);
    const debounceTimeout = ref<NodeJS.Timeout | null>(null);
    const valueBeforeTouch = ref<number>(0);

    watch(localValue, (val) => {
      ctx.emit("update:local-value", val);
    });

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

      const volumeDelta = deltaY < 0 ? step : -step;
      const newValue = Math.max(
        0,
        Math.min(100, localValue.value + volumeDelta),
      );

      blockBackendUpdatesUntil.value = Date.now() + 2000;
      localValue.value = newValue;
      ctx.emit("update:model-value", newValue);
      pendingFinalValue.value = newValue;
    };

    const onDragStart = (value: number) => {
      if (isScrolling.value) {
        return;
      }

      blockBackendUpdatesUntil.value = Date.now() + 10000;
      startValue.value = value;
      updateCount.value = 0;
      localValue.value = value;
      pendingFinalValue.value = null;

      if (store.isTouchscreen && "vibrate" in navigator && navigator.vibrate) {
        navigator.vibrate(10);
      }
    };

    const onUpdateModelValue = (newValue: number) => {
      if (isScrolling.value) {
        return;
      }

      updateCount.value++;

      localValue.value = newValue;

      if (updateCount.value > 2) {
        if (debounceTimeout.value) {
          clearTimeout(debounceTimeout.value);
        }

        debounceTimeout.value = setTimeout(() => {
          ctx.emit("update:model-value", newValue);
          debounceTimeout.value = null;
        }, 50);
      }
    };

    const onDragEnd = (endValue: number) => {
      if (debounceTimeout.value) {
        clearTimeout(debounceTimeout.value);
        debounceTimeout.value = null;
      }

      if (isScrolling.value) {
        isScrolling.value = false;
        updateCount.value = 0;
        blockBackendUpdatesUntil.value = 0;
        return;
      }

      const now = Date.now();
      if (now - lastEnd.value < 250) {
        blockBackendUpdatesUntil.value = 0;
        return;
      }
      lastEnd.value = now;

      const step = playerVolumeProps.value.step;

      if (updateCount.value > 3) {
        localValue.value = endValue;
        ctx.emit("update:model-value", endValue);
        pendingFinalValue.value = endValue;
      } else {
        if (!store.mobileLayout) {
          localValue.value = endValue;
          ctx.emit("update:model-value", endValue);
          pendingFinalValue.value = endValue;
        } else {
          const volumeDelta = endValue > startValue.value ? step : -step;
          const newVolume = Math.max(
            0,
            Math.min(100, startValue.value + volumeDelta),
          );
          localValue.value = newVolume;
          ctx.emit("update:model-value", newVolume);
          pendingFinalValue.value = newVolume;
        }
      }

      updateCount.value = 0;

      blockBackendUpdatesUntil.value = Date.now() + 1000;
    };

    const onTouchStart = (event: TouchEvent) => {
      touchStartX.value = event.touches[0].clientX;
      touchStartY.value = event.touches[0].clientY;
      isScrolling.value = false;
      valueBeforeTouch.value = localValue.value;
    };

    const onTouchMove = (event: TouchEvent) => {
      const touchX = event.touches[0].clientX;
      const touchY = event.touches[0].clientY;

      const deltaX = Math.abs(touchX - touchStartX.value);
      const deltaY = Math.abs(touchY - touchStartY.value);

      if (deltaY > 5 && deltaY > deltaX * 2) {
        if (!isScrolling.value) {
          isScrolling.value = true;
          localValue.value = valueBeforeTouch.value;
        }
      }
    };

    watch(
      () => ctx.attrs["model-value"] as number,
      (val) => {
        const now = Date.now();
        const isBlocked = now < blockBackendUpdatesUntil.value;

        if (typeof val === "number") {
          if (
            pendingFinalValue.value !== null &&
            val === pendingFinalValue.value
          ) {
            localValue.value = val;
            pendingFinalValue.value = null;
            blockBackendUpdatesUntil.value = 0;
          } else if (!isBlocked) {
            localValue.value = val;
          }
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
      localValue,
      onTouchStart,
      onTouchMove,
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
