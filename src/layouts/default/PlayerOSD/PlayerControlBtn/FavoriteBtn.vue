<template>
  <ResponsiveIcon
    v-if="isVisible"
    v-bind="props.icon"
    :disabled="disabled || !item"
    :icon="item?.favorite ? 'mdi-heart' : 'mdi-heart-outline'"
    :title="$t('tooltip.favorite')"
    :type="'btn'"
    @click="onClick"
  />
</template>

<script setup lang="ts">
import { type MediaItemType } from "@/plugins/api/interfaces";
import api from "@/plugins/api";
import ResponsiveIcon, {
  ResponsiveIconProps,
} from "@/components/mods/ResponsiveIcon.vue";

// properties
export interface Props {
  item?: MediaItemType;
  isVisible?: boolean;
  icon?: ResponsiveIconProps;
  disabled?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  item: undefined,
  isVisible: true,
  icon: undefined,
  disabled: false,
});

const onClick = function () {
  if (!props.item) return;
  api.toggleFavorite(props.item);
};
</script>
