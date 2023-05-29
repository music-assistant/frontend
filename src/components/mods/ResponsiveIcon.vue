<template>
  <div
    :class="hover ? 'responsive-icon-holder-hover' : 'responsive-icon-holder'"
    :style="{
      width: props.width,
      height: props.width,
      maxHeight: props.maxHeight,
      maxWidth: props.maxWidth,
      minHeight: props.minHeight,
      minWidth: props.minWidth,
    }"
    ref="responsiveIconHolder"
  >
    <v-icon
      ref="responsiveIcon"
      class="responsive-icon"
      :color="color ? color : isDark ? '#fff' : '#000'"
      :icon="props.icon ? props.icon : 'mdi-check'"
      ><template v-if="$slots.default" #default> <slot name="default"></slot> </template
    ></v-icon>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from 'vue';

// properties
interface Props {
  width?: string;
  height?: string;
  maxWidth?: string;
  maxHeight?: string;
  minWidth?: string;
  minHeight?: string;
  icon?: string;
  hover?: boolean;
  color?: string;
  isDark?: boolean;
}
const props = withDefaults(defineProps<Props>(), { minWidth: '24px', minHeight: '24px' });

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
