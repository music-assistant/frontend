<template>
  <v-btn v-bind="btnProps" variant="plain">
    <!-- Dynamically inherit slots from parent -->
    <template v-for="(value, name) in ($slots as unknown)" #[name]>
      <slot :name="name"></slot>
    </template>
  </v-btn>
</template>

<script lang="ts">
import { computed } from 'vue';

export default {
  props: {
    variant: {
      type: String,
      default: '',
    },
  },
  setup(props, ctx) {
    const btnDefaults = computed(() => ({
      ripple: false,
    }));

    const btnIconDefaults = computed(() => ({
      ripple: false,
      icon: true,
    }));

    const btnProps = computed(() => ({
      ...(ctx.attrs.variant === 'icon' ? btnIconDefaults.value : btnDefaults.value),
      ...ctx.attrs,
    }));

    return { btnProps };
  },
};
</script>

<style>
.v-btn--variant-icon {
  width: calc(var(--v-btn-height) + 10px) !important;
  height: calc(var(--v-btn-height) + 10px) !important;
}

.v-btn {
  opacity: 0.62;
  cursor: pointer;
}

.v-btn:focus,
.v-btn:hover {
  opacity: 1;
}
</style>
