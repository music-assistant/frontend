<template>
  <v-alert
    v-bind="alertProps"
    class="alert"
    color="primary"
    density="compact"
    prominent
  >
    <!-- Dynamically inherit slots from parent -->
    <template v-for="(value, name) in $slots as unknown" #[name]>
      <slot :name="name"></slot>
    </template>
  </v-alert>
</template>

<script lang="ts">
import { computed } from 'vue';

export default {
  setup(props, ctx) {
    const alertDefaults = computed(() => ({}));

    const alertProps = computed(() => ({
      ...alertDefaults.value,
      ...ctx.attrs,
    }));

    return { alertProps };
  },
};
</script>

<style>
.alert {
  margin-right: 10px;
}
</style>
