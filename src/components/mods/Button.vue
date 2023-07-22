<template>
  <v-btn v-bind="btnProps" variant="plain">
    <!-- Dynamically inherit slots from parent -->
    <template v-for="(value, name) in $slots as unknown" #[name]>
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
    const btnDefault = computed(() => ({
      ripple: false,
    }));

    const btnIconDefault = computed(() => ({
      ripple: false,
      icon: true,
    }));

    const btnIconListView = computed(() => ({
      ripple: true,
      icon: true,
      class: 'v-btn--variant-icon-list-view',
      size: 30,
    }));

    const btnProps = computed(() => {
      const variant = props.variant;
      return variant === 'icon'
        ? btnIconDefault.value
        : variant === 'listViewIcon'
        ? btnIconListView.value
        : btnDefault.value;
    });

    return { btnProps };
  },
};
</script>

<style>
.v-btn--variant-icon {
  width: calc(var(--v-btn-height) + 10px) !important;
  height: calc(var(--v-btn-height) + 10px) !important;
}

.v-btn--variant-icon-list-view {
  border-radius: 20px;
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
