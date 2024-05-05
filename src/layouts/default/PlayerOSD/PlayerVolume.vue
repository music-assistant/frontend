<template>
  <v-slider
    v-bind="playerVolumeProps"
    @touchstart="isThumbHidden = false"
    @touchend="isThumbHidden = true"
    @mouseenter="isThumbHidden = false"
    @mouseleave="isThumbHidden = true"
    @wheel="onWheel"
    @update:model-value="(value) => $emit('update:model-value', value)"
  >
    <!-- Dynamically inherit slots from parent -->
    <template v-for="(value, name) in $slots as unknown" #[name]>
      <slot :name="name"></slot>
    </template>
  </v-slider>
</template>

<script lang="ts">
import { computed, ref } from 'vue';

export default {
  props: {
    // eslint-disable-next-line vue/require-default-prop
    width: String,
    // eslint-disable-next-line vue/require-default-prop
    height: String,
    // eslint-disable-next-line vue/require-default-prop
    style: String,
    isPowered: Boolean,
  },
  emits: ['update:model-value'],
  setup(props, ctx) {
    const isThumbHidden = ref(true);

    const playerVolumeDefaults = computed(() => ({
      class: 'player-volume',
      hideDetails: true,
      trackSize: 2,
      thumbSize: isThumbHidden.value ? 0 : 10,
      step: 2,
      elevation: 0,
      disabled: !props.isPowered,
      style: `width: ${props.width}; height:${props.height}; display: inline-grid; ${props.style}`,
    }));

    const playerVolumeProps = computed(() => ({
      ...playerVolumeDefaults.value,
      ...ctx,
    }));

    const onWheel = ({ deltaY }: WheelEvent) => {
      const step = playerVolumeProps.value.step;

      const volumeValue = ctx.attrs['model-value'] as number;
      const volumeDelta = deltaY < 0 ? step : -step;

      ctx.emit('update:model-value', volumeValue + volumeDelta);
    };

    return { isThumbHidden, playerVolumeProps, onWheel };
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
