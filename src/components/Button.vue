<template>
  <button
    v-bind="buttonProps"
    :class="buttonClasses"
    @click="$emit('click', $event)"
  >
    <span v-if="icon && typeof icon === 'string'" class="mdi" :class="icon" />
    <slot></slot>
  </button>
</template>

<script lang="ts">
export type { ButtonEmits, ButtonProps } from "@/composables/useButton";
</script>

<script setup lang="ts">
import {
  defaultButtonProps,
  useButton,
  type ButtonEmits,
  type ButtonProps,
} from "@/composables/useButton";

const props = withDefaults(defineProps<ButtonProps>(), defaultButtonProps);

defineEmits<ButtonEmits>();

const { buttonProps, buttonClasses } = useButton(props);
</script>

<style scoped>
.button:focus-visible {
  outline: 2px solid var(--primary);
  outline-offset: 2px;
}

@media (prefers-contrast: high) {
  .button {
    border: 1px solid currentColor;
  }
}

@media (prefers-reduced-motion: reduce) {
  .button {
    transition: none;
  }
}

.button--responsive {
  min-height: 48px;
  min-width: 48px;
}

.button--icon {
  min-height: 40px;
  min-width: 40px;
}

.button--nav {
  border-radius: 0;
}
</style>
