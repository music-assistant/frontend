<template>
  <button
    type="button"
    class="detail-hero-button"
    :class="{
      'detail-hero-button--phone': isPhone,
      'detail-hero-button--icon-only': iconOnly,
      'detail-hero-button--pressed': pressed,
    }"
    :disabled="disabled"
    :aria-label="label"
    :aria-pressed="
      pressed === undefined ? undefined : pressed ? 'true' : 'false'
    "
    :title="label"
    @click="emit('click', $event)"
  >
    <component :is="icon" :size="isPhone ? 18 : 16" />
    <span v-if="!iconOnly">{{ label }}</span>
  </button>
</template>

<script setup lang="ts">
import { isPhoneSizedScreen } from "@/plugins/breakpoint";
import { computed, type Component } from "vue";

export interface Props {
  icon: Component;
  // always the accessible name; visible beside the icon unless `iconOnly`
  label: string;
  iconOnly?: boolean;
  disabled?: boolean;
  // set for a toggle (aria-pressed); when on, the icon takes the primary colour
  pressed?: boolean;
}
withDefaults(defineProps<Props>(), {
  iconOnly: false,
  disabled: false,
  pressed: undefined,
});

const emit = defineEmits<{
  (e: "click", event: MouseEvent): void;
}>();

const isPhone = computed(() => isPhoneSizedScreen());
</script>

<style scoped>
.detail-hero-button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  height: 36px;
  padding: 0 12px;
  border: 1px solid rgba(255, 255, 255, 0.25);
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.4);
  color: #fff;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
}
.detail-hero-button:disabled {
  cursor: default;
  opacity: 0.5;
}
.detail-hero-button:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: 2px;
}
.detail-hero-button--pressed svg {
  color: rgb(var(--v-theme-primary));
}
.detail-hero-button--icon-only {
  width: 36px;
  padding: 0;
}
.detail-hero-button--phone {
  width: 44px;
  height: 44px;
  padding: 0;
  border-radius: 10px;
}
</style>
