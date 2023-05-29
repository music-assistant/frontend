<template>
  <v-btn v-bind="btnProps" variant="plain">
    <!-- Dynamically inherit slots from parent -->
    <template v-for="slot in parentSlots" #[slot]>
      <slot :name="slot"></slot>
    </template>
  </v-btn>
</template>

<script lang="ts">
import { computed } from 'vue';

export default {
  setup(props, ctx) {
    const parentSlots = computed(() => Object.keys(ctx.slots));

    const btnDefaults = computed(() => ({
      ripple: false,
      variant: '',
    }));

    const btnIconDefaults = computed(() => ({
      ripple: false,
      icon: true,
      variant: '',
    }));

    const btnProps = computed(() => ({
      ...(ctx.attrs.variant === 'icon' ? btnIconDefaults.value : btnDefaults.value),
      ...ctx.attrs,
    }));

    return { parentSlots, btnProps };
  },
};
</script>

<style>
.v-btn--variant-icon {
  width: calc(var(--v-btn-height) + 10px) !important;
  height: calc(var(--v-btn-height) + 10px) !important;
}
</style>
