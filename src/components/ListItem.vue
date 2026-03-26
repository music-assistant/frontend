<template>
  <Item
    v-hold="(v: Event) => $emit('menu', v)"
    :class="listItemClasses"
    size="sm"
    class="cursor-pointer"
    @click="$emit('click', $event)"
    @click.right.prevent="(v: Event) => $emit('menu', v)"
  >
    <ItemMedia v-if="$slots.prepend">
      <slot name="prepend"></slot>
    </ItemMedia>
    <ItemContent>
      <ItemTitle v-if="$slots.title">
        <slot name="title"></slot>
      </ItemTitle>
      <ItemDescription v-if="$slots.subtitle">
        <slot name="subtitle"></slot>
      </ItemDescription>
      <slot></slot>
    </ItemContent>
    <ItemActions v-if="$slots.append || showMenuBtn">
      <slot name="append"></slot>
      <Button
        v-if="showMenuBtn"
        variant="icon"
        icon="mdi-dots-vertical"
        aria-label="Show context menu"
        @click.stop="(v: Event) => $emit('menu', v)"
      />
    </ItemActions>
  </Item>
</template>

<script lang="ts">
export type { ListItemEmits, ListItemProps } from "@/composables/useListItem";
</script>

<script setup lang="ts">
import Button from "@/components/Button.vue";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import {
  defaultListItemProps,
  useListItem,
  type ListItemEmits,
  type ListItemProps,
} from "@/composables/useListItem";

const props = withDefaults(defineProps<ListItemProps>(), defaultListItemProps);

defineEmits<ListItemEmits>();

const { listItemClasses } = useListItem(props);
</script>

<style scoped>
.list-item-main {
  border-radius: 4px !important;
  padding: 7px !important;
  padding-right: 0 !important;
  margin-right: -18px !important;
}

.list-item--compact {
  padding: 4px;
}

.list-item--comfortable {
  padding: 12px;
}
</style>
