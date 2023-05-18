<template>
  <v-btn v-bind="btnProps" variant="plain" class="btn-icon" @input="(v: any) => $emit('input', v)">
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
      icon: true,
    }));

    const btnProps = computed(() => ({
      ...btnDefaults.value,
      ...ctx.attrs,
    }));

    return { parentSlots, btnProps };
  },
};
</script>

<style>
.btn-icon {
  width: calc(var(--v-btn-height) + 10px) !important;
  height: calc(var(--v-btn-height) + 10px) !important;
}
</style>
