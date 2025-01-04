<!--
 Comment marcelveldt 2025-01-04: Not sure about the purpose of these mods
 What can we do to get rid of these mods/hacks and just use the standard Vuetify components?
-->
<template>
  <v-btn v-bind="btnProps" variant="plain">
    <!-- Dynamically inherit slots from parent -->
    <!-- @vue-ignore -->
    <template v-for="(value, name) in $slots" #[name]>
      <slot :name="name"></slot>
    </template>
  </v-btn>
</template>

<script lang="ts">
import { ButtonProps } from "@/plugins/api/interfaces";
import { computed } from "vue";

export default {
  props: {
    variant: {
      type: String,
      default: "default",
      validator: (value: string) => {
        const allowedVariants = [
          "plain",
          "default",
          "responsive",
          "icon",
          "list",
        ];
        return allowedVariants.includes(value);
      },
    },
  },
  setup(props, ctx) {
    const btnDefault = {};

    const btnResponsive = computed(() => ({
      ...btnDefault,
      class: "v-btn--variant-responsive",
      ripple: true,
      icon: true,
      style:
        "height: min(calc(100vw - 40px), calc(100vh - 340px)); width: min(calc(100vw - 40px), calc(100vh - 340px));",
    }));

    const btnIcon = computed(() => ({
      ...btnDefault,
      ripple: false,
    }));

    const btnList = computed(() => ({
      ...btnDefault,
      density: "comfortable",
    }));

    const btnProps = computed<ButtonProps>(() => {
      const variant = props.variant;
      switch (variant) {
        case "default":
          return btnDefault;
        case "plain":
          return btnDefault;
        case "responsive":
          return btnResponsive.value;
        case "icon":
          return btnIcon.value;
        case "list":
          return btnList.value;
        default:
          return btnDefault;
      }
    });

    return { btnProps };
  },
};
</script>

<style>
.v-btn--variant-responsive > .v-btn__content {
  height: 100%;
  width: calc(100vw);
}

.v-btn--variant-responsive > .v-btn__content > .responsive-icon-holder-btn {
  height: 100%;
  width: 100%;
}
</style>
