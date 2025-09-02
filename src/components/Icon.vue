<template>
  <div
    ref="iconContainer"
    :class="containerClasses"
    :style="containerStyle"
    @click="handleClick"
  >
    <v-badge :model-value="badge === true" color="error" dot>
      <v-icon ref="iconElement" v-bind="iconProps" :class="iconClasses">
        <template v-for="(_, name) in $slots" #[name]>
          <slot :name="name"></slot>
        </template>
      </v-icon>
    </v-badge>
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
import { nextTick, onBeforeUnmount, onMounted, ref } from "vue";
import { VIcon } from "vuetify/components";

const props = withDefaults(defineProps<IconProps>(), defaultIconProps);

const emit = defineEmits<IconEmits>();

const { iconProps, containerStyle, containerClasses, iconClasses } =
  useIcon(props);

const iconContainer = ref<HTMLElement>();
const iconElement = ref<VIcon>();

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

    if (iconElement.value.$el) {
      iconElement.value.$el.style.fontSize = `${iconSize}px`;
    }
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
  color: #00ff00;
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
}

.icon-container--button {
  min-height: 44px;
  min-width: 44px;
  border-radius: 4px;
}
</style>
