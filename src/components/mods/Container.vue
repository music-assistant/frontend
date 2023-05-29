<template>
  <v-container v-bind="containerProps" class="container">
    <!-- Dynamically inherit slots from parent -->
    <template v-for="slot in parentSlots" #[slot]>
      <slot :name="slot"></slot>
    </template>
  </v-container>
</template>

<script lang="ts">
import { computed } from 'vue';

export default {
  // properties
  /*
export interface Props {
  type: 'onlyIcon' | 'button' | 'text';
}
const props = withDefaults(defineProps<Props>(), {
  type: 'onlyIcon',
});*/
  setup(props, ctx) {
    const parentSlots = computed(() => Object.keys(ctx.slots));

    const containerDefaults = computed(() => ({}));

    const containerProps = computed(() => ({
      ...containerDefaults.value,
      ...ctx.attrs,
    }));

    return { parentSlots, containerProps };
  },
};
</script>

<style></style>
