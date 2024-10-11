<template>
  <div
    ref="responsiveIconHolder"
    :class="[
      type == 'btn' && !disabled
        ? 'responsive-icon-holder-btn'
        : 'responsive-icon-holder',
    ]"
    :style="{
      width: staticWidth ? staticWidth : width,
      height: staticWidth ? staticWidth : height,
      maxHeight: staticHeight ? staticHeight : maxHeight,
      maxWidth: staticWidth ? staticWidth : maxWidth,
      minHeight: staticHeight ? staticHeight : minHeight,
      minWidth: staticWidth ? staticWidth : minWidth,
    }"
    @click="disabled ? $event.preventDefault() : $emit('clicked')"
  >
    <v-badge :model-value="badge == true" color="error" dot>
      <v-icon
        v-if="type === 'icon'"
        ref="responsiveIcon"
        class="responsive-icon"
        :color="color ? color : ''"
        :icon="icon ? icon : 'mdi-check'"
        :width="staticWidth ? staticWidth : null"
        :height="staticHeight ? staticHeight : null"
        :disabled="disabled"
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
        :icon="icon ? icon : 'mdi-check'"
        :width="staticWidth ? staticWidth : null"
        :height="staticHeight ? staticHeight : null"
        :disabled="disabled"
      >
        <!-- Dynamically inherit slots from parent -->
        <template v-for="(value, name) in $slots as unknown" #[name]>
          <slot :name="name"></slot>
        </template>
      </v-icon>
    </v-badge>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, watch } from "vue";

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
  type?: "icon" | "btn";
  color?: string;
  disabled?: boolean;
  badge?: boolean;
}
withDefaults(defineProps<ResponsiveIconProps>(), {
  width: undefined,
  height: undefined,
  staticWidth: undefined,
  staticHeight: undefined,
  maxWidth: undefined,
  maxHeight: undefined,
  minWidth: "24px",
  minHeight: "24px",
  icon: undefined,
  type: "icon",
  color: undefined,
  badge: undefined,
});

const emit = defineEmits<{
  (e: "clicked"): void;
}>();

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
  window.addEventListener("resize", adjustIconSize);
});

onBeforeUnmount(() => {
  window.removeEventListener("resize", adjustIconSize);
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
