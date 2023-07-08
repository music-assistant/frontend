<template>
  <div
    ref="responsiveIconHolder"
    :class="hover ? 'responsive-icon-holder-hover' : 'responsive-icon-holder'"
    :style="{
      width: props.staticWidth ? props.staticWidth : props.width,
      height: props.staticWidth ? props.staticWidth : props.height,
      maxHeight: props.staticHeight ? props.staticHeight : props.maxHeight,
      maxWidth: props.staticWidth ? props.staticWidth : props.maxWidth,
      minHeight: props.staticHeight ? props.staticHeight : props.minHeight,
      minWidth: props.staticWidth ? props.staticWidth : props.minWidth,
    }"
  >
    <v-icon
      ref="responsiveIcon"
      class="responsive-icon"
      :color="color ? color : ''"
      :icon="props.icon ? props.icon : 'mdi-check'"
      :width="props.staticWidth ? props.staticWidth : null"
      :height="props.staticHeight ? props.staticHeight : null"
      ><template v-if="$slots.default" #default> <slot name="default"></slot> </template
    ></v-icon>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue';

// properties
export interface ResponsiveIconProps {
  width?: string;
  height?: string;
  staticWidth?: string;
  staticHeight?: string;
  maxWidth?: string;
  maxHeight?: string;
  minWidth?: string;
  minHeight?: string;
  icon?: string;
  hover?: boolean;
  color?: string;
}
const props = withDefaults(defineProps<ResponsiveIconProps>(), { minWidth: '24px', minHeight: '24px' });

const adjustIconSize = () => {
  if (responsiveIconHolder.value) {
    const divWidthValue = responsiveIconHolder.value.offsetWidth;
    const divHeightValue = responsiveIconHolder.value.offsetHeight;
    const iconSize = Math.min(divWidthValue, divHeightValue);

    responsiveIcon.value.$el.style.fontSize = `${iconSize}px`;
  }
};

const responsiveIconHolder = ref<HTMLElement>();
const responsiveIcon = ref();

onMounted(() => {
  adjustIconSize();
  window.addEventListener('resize', adjustIconSize);
});

onBeforeUnmount(() => {
  window.removeEventListener('resize', adjustIconSize);
});
</script>

<style scoped>
.responsive-icon-holder {
  display: flex;
  align-items: center;
  justify-content: center;
}

.responsive-icon-holder-hover {
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0.62;
  cursor: pointer;
}

.responsive-icon-holder-hover:focus,
.responsive-icon-holder-hover:hover {
  opacity: 1;
}

.responsive-icon {
  line-height: 1;
}
</style>
