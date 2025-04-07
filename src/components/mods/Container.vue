<!--
 Comment marcelveldt 2025-01-04: Not sure about the purpose of these mods
 What can we do to get rid of these mods/hacks and just use the standard Vuetify components?
-->
<template>
  <v-container v-bind="btnProps" variant="default" fluid>
    <!-- Dynamically inherit slots from parent -->
    <!-- @vue-ignore -->
    <template v-for="(value, name) in $slots" #[name]>
      <slot :name="name"></slot>
    </template>
  </v-container>
</template>

<script lang="ts">
import vuetify from "@/plugins/vuetify";
import { computed } from "vue";

export default {
  props: {
    variant: {
      type: String,
      default: "default",
      validator: (value: string) => {
        const allowedVariants = ["default", "panel"];
        return allowedVariants.includes(value);
      },
    },
  },
  setup(props, ctx) {
    const btnDefault = {};

    const containerDefault = computed(() => ({ class: "container-default" }));

    const containerPanel = computed(() => ({
      class: vuetify.theme.current.value.dark
        ? "container-default container-panels-dark"
        : "container-default container-panels-light",
    }));

    const btnProps = computed(() => {
      const variant = props.variant;
      switch (variant) {
        case "default":
          return containerDefault.value;
        case "panel":
          return containerPanel.value;
        default:
          return containerDefault.value;
      }
    });

    return { btnProps };
  },
};
</script>

<style scoped>
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
