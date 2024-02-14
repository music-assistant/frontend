<template>
  <v-slider
    v-bind="playerVolumeProps"
    @touchstart="isThumbHidden = false"
    @touchend="isThumbHidden = true"
    @mouseenter="isThumbHidden = false"
    @mouseleave="isThumbHidden = true"
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

    return { isThumbHidden, playerVolumeProps };
  },
};
</script>
