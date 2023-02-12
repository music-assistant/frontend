<template>
  <v-slider
    :style="`width: ${props.width}; height:${props.height}; ${props.style}`"
    hide-details
    class="player-volume"
    :track-size="2"
    :thumb-size="isThumbHidden ? 0 : 10"
    :step="2"
    :elevation="0"
    :disabled="props.isPowered ? false : true"
    @touchstart="isThumbHidden = false"
    @touchend="isThumbHidden = true"
    @mouseenter="isThumbHidden = false"
    @mouseleave="isThumbHidden = true"
  >
    <template v-if="$slots.content" #content>
      <slot></slot>
    </template>
    <template v-if="$slots.prepend" #prepend class="player-volume__prepend">
      <slot name="prepend"></slot>
    </template>
    <template v-if="$slots.append" #append class="player-volume__append">
      <slot name="append"></slot>
    </template>
  </v-slider>
</template>

<script setup lang="ts">
import { ref } from 'vue';

// properties
export interface Props {
  width?: string;
  height?: string;
  isPowered?: boolean;
  style?: string;
}

const props = withDefaults(defineProps<Props>(), {
  width: '100%',
  height: 'auto',
  isPowered: false,
  style: '',
});

// local refs
const isThumbHidden = ref(true);
</script>