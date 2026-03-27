<template>
  <Icon
    v-if="isVisible"
    v-bind="props.icon"
    :disabled="disabled || !item"
    :title="$t('tooltip.favorite')"
    variant="button"
    @click="onClick"
  >
    <Heart
      :size="Number(props.icon?.size) || 24"
      :fill="item?.favorite ? 'currentColor' : 'none'"
    />
  </Icon>
</template>

<script setup lang="ts">
import Icon, { IconProps } from "@/components/Icon.vue";
import api from "@/plugins/api";
import { type MediaItemType } from "@/plugins/api/interfaces";
import { Heart } from "lucide-vue-next";

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
