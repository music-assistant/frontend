<template>
  <v-container v-bind="containerProps" class="container">
    <!-- Dynamically inherit slots from parent -->
    <template v-for="(value, name) in ($slots as unknown)" #[name]>
      <slot :name="name"></slot>
    </template>
  </v-container>
</template>

<script lang="ts">
import { computed } from 'vue';

export default {
  setup(props, ctx) {
    const containerDefaults = computed(() => ({}));

    const containerProps = computed(() => ({
      ...containerDefaults.value,
      ...ctx.attrs,
    }));

    return { containerProps };
  },
};
</script>

<style>
.container {
  padding: 20px;
}

@media (min-width: 1920px) {
  .container {
    max-width: unset !important;
  }
}

@media (min-width: 1280px) {
  .container {
    max-width: unset !important;
  }
}

@media (min-width: 960px) {
  .container {
    max-width: unset !important;
  }
}
</style>
