<template>
  <v-container v-bind="btnProps" variant="default" fluid>
    <!-- Dynamically inherit slots from parent -->
    <template v-for="(value, name) in $slots as unknown" #[name]>
      <slot :name="name"></slot>
    </template>
  </v-container>
</template>

<script lang="ts">
import { ButtonProps } from '@/plugins/api/interfaces';
import vuetify from '@/plugins/vuetify';
import { defineProps, computed } from 'vue';

export default {
  props: {
    variant: {
      type: String,
      default: 'default',
      validator: (value: string) => {
        const allowedVariants = ['default', 'panel'];
        return allowedVariants.includes(value);
      },
    },
  },
  setup(props, ctx) {
    const btnDefault = {};

    const containerDefault = computed(() => ({ class: 'container-default' }));

    const containerPanel = computed(() => ({
      class: vuetify.theme.current.value.dark
        ? 'container-default container-panels-dark'
        : 'container-default container-panels-light',
    }));

    const btnProps = computed(() => {
      const variant = props.variant;
      switch (variant) {
        case 'default':
          return containerDefault.value;
        case 'panel':
          return containerPanel.value;
        default:
          return containerDefault.value;
      }
    });

    return { btnProps };
  },
};
</script>

<style>
.container-default {
  padding: 10px;
}

.container-panels-light {
  background: #f5f5f5;
}

@media (min-width: 1920px) {
  .container-default {
    max-width: unset !important;
  }
}

@media (min-width: 1280px) {
  .container-default {
    max-width: unset !important;
  }
}

@media (min-width: 960px) {
  .container {
    max-width: unset !important;
  }
}
</style>
