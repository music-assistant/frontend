<template>
  <div
    ref="iconContainer"
    :class="containerClasses"
    :style="containerStyle"
    @click="handleClick"
  >
    <div class="icon-badge-wrapper">
      <span ref="iconElement" :class="iconClasses" :style="iconSizeStyle">
        <slot>
          <span v-if="icon" class="mdi" :class="icon" />
        </slot>
      </span>
      <span v-if="badge === true" class="icon-badge-dot" />
    </div>
  </div>
</template>

<script lang="ts">
export type { IconEmits, IconProps } from "@/composables/useIcon";
</script>

<script setup lang="ts">
import {
  defaultIconProps,
  useIcon,
  type IconEmits,
  type IconProps,
} from "@/composables/useIcon";
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from "vue";

const props = withDefaults(defineProps<IconProps>(), defaultIconProps);

const emit = defineEmits<IconEmits>();

const { iconProps, containerStyle, containerClasses, iconClasses } =
  useIcon(props);

const iconContainer = ref<HTMLElement>();
const iconElement = ref<HTMLElement>();

const iconSizeStyle = computed(() => {
  const size = iconProps.value.size;
  if (size) {
    const s = typeof size === "number" ? `${size}px` : size;
    return { fontSize: s, width: s, height: s };
  }
  return {};
});

const adjustIconSize = async () => {
  if (
    props.variant !== "responsive" ||
    !iconContainer.value ||
    !iconElement.value
  ) {
    return;
  }

  await nextTick();

  try {
    const containerWidth = iconContainer.value.offsetWidth;
    const containerHeight = iconContainer.value.offsetHeight;
    const iconSize = Math.min(containerWidth, containerHeight);

    iconElement.value.style.fontSize = `${iconSize}px`;
  } catch (error) {
    console.error("Icon sizing adjustment failed:", error);
  }
};

const handleClick = (event: MouseEvent) => {
  if (props.disabled) {
    event.preventDefault();
    event.stopPropagation();
    return;
  }

  emit("click", event);
};

onMounted(() => {
  if (props.variant === "responsive") {
    adjustIconSize();
    window.addEventListener("resize", adjustIconSize);
  }
});

onBeforeUnmount(() => {
  if (props.variant === "responsive") {
    window.removeEventListener("resize", adjustIconSize);
  }
});
</script>

<style scoped>
.icon-container {
  display: flex;
  align-items: center;
  justify-content: center;
}

.icon-container--button {
  opacity: 0.62;
  cursor: pointer !important;
  transition: opacity 0.2s ease;
}

.icon-container--button:hover,
.icon-container--button:focus {
  opacity: 1;
}

.icon-container--button:focus {
  outline: none;
  color: var(--primary);
}

.icon-container--button:active {
  opacity: 1;
}

.icon-container--disabled {
  opacity: 0.5;
  cursor: not-allowed;
  pointer-events: none;
}

.icon {
  line-height: 1;
  display: flex !important;
  align-items: center !important;
  justify-content: center !important;
}

.icon-container--button {
  min-height: 44px;
  min-width: 44px;
  border-radius: 4px;
}

.icon-container {
  width: 100%;
  height: 100%;
  max-width: 100%;
  max-height: 100%;
}

.icon-badge-wrapper {
  position: relative;
  display: inline-flex;
}

.icon-badge-dot {
  position: absolute;
  top: 0;
  right: 0;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: var(--destructive);
}

.media-controls-item .icon {
  font-size: 1em !important;
}
</style>
