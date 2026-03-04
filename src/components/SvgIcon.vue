<template>
  <component
    :is="iconComponent"
    role="img"
    class="inline-block fill-current"
    :style="`height: ${height}; width: ${width}`"
  />
</template>

<script lang="ts">
import { computed, defineComponent, PropType } from "vue";

interface IconProps {
  darkMode?: boolean;
  height?: string;
  width?: string;
  name: string;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const icons: Record<string, any> = {};

export default defineComponent({
  props: {
    darkMode: {
      type: Boolean as PropType<boolean>,
      required: false,
      default: true,
    },
    height: {
      type: String as PropType<string>,
      required: false,
      default: "1.4em",
    },
    width: {
      type: String as PropType<string>,
      required: false,
      default: "1.4em",
    },
    name: {
      type: String as PropType<string>,
      required: true,
      validator(value: string) {
        return Object.prototype.hasOwnProperty.call(icons, value);
      },
    },
  },
  setup(props: IconProps) {
    const iconComponent = computed(() => {
      if (
        props.darkMode &&
        icons[props.name].props &&
        icons[props.name].props.darkMode
      ) {
        icons[props.name].props.darkMode.default = true;
      }
      return icons[props.name];
    });

    return {
      iconComponent,
    };
  },
});
</script>
