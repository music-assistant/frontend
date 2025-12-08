<template>
  <Icon
    v-if="isVisible"
    v-bind="props.icon"
    :disabled="disabled || !item"
    :icon="item?.favorite ? 'mdi-heart' : 'mdi-heart-outline'"
    :title="$t('tooltip.favorite')"
    variant="button"
    @click="onClick"
  />
</template>

<script setup lang="ts">
import Icon, { IconProps } from "@/components/Icon.vue";
import api from "@/plugins/api";
import { type MediaItemType } from "@/plugins/api/interfaces";

// properties
export interface Props {
  item?: MediaItemType;
  isVisible?: boolean;
  icon?: IconProps;
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
