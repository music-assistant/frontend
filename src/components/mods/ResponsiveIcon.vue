<template>
  <div
    ref="responsiveIconHolder"
    :class="[
      props.type == 'btn'
        ? 'responsive-icon-holder-btn'
        : 'responsive-icon-holder',
      { disabled: disabled },
    ]"
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
      v-if="type === 'icon'"
      ref="responsiveIcon"
      class="responsive-icon"
      :color="color ? color : ''"
      :icon="props.icon ? props.icon : 'mdi-check'"
      :width="props.staticWidth ? props.staticWidth : null"
      :height="props.staticHeight ? props.staticHeight : null"
    >
      <!-- Dynamically inherit slots from parent -->
      <template v-for="(value, name) in $slots as unknown" #[name]>
        <slot :name="name"></slot>
      </template>
    </v-icon>
    <v-icon
      v-else-if="type === 'btn'"
      ref="responsiveIcon"
      class="responsive-icon"
      style="cursor: pointer"
      :color="color ? color : ''"
      :icon="props.icon ? props.icon : 'mdi-check'"
      :width="props.staticWidth ? props.staticWidth : null"
      :height="props.staticHeight ? props.staticHeight : null"
      :disabled="disabled"
    >
      <!-- Dynamically inherit slots from parent -->
      <template v-for="(value, name) in $slots as unknown" #[name]>
        <slot :name="name"></slot>
      </template>
    </v-icon>
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
  type?: 'icon' | 'btn';
  color?: string;
  disabled?: boolean;
}
const props = withDefaults(defineProps<ResponsiveIconProps>(), {
  minWidth: '24px',
  minHeight: '24px',
  type: 'icon',
});

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

.responsive-icon-holder-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  opacity: 0.62;
  cursor: pointer !important;
}

.responsive-icon-holder-btn:focus,
.responsive-icon-holder-btn:hover {
  opacity: 1;
}
.responsive-icon-holder-btn:focus {
  outline: none;
  color: #00ff00;
}

.responsive-icon-holder-btn:active {
  opacity: 1;
}

.responsive-icon-holder-btn.disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.responsive-icon {
  line-height: 1;
}
</style>
