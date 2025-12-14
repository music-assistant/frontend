<template>
  <v-list-item
    v-hold="(v: any) => $emit('menu', v)"
    v-bind="listItemProps"
    :class="listItemClasses"
    @click="$emit('click', $event)"
    @click.right.prevent="(v: any) => $emit('menu', v)"
    @input="(v: any) => $emit('input', v)"
  >
    <template v-for="(_, name) in $slots" #[name]>
      <slot :name="name"></slot>
    </template>
    <template v-if="$slots.append || showMenuBtn" #append>
      <slot name="append"></slot>
      <Button
        v-if="showMenuBtn"
        variant="icon"
        icon="mdi-dots-vertical"
        aria-label="Show context menu"
        @click.stop="(v: any) => $emit('menu', v)"
      />
    </template>
  </v-list-item>
</template>

<script lang="ts">
export type { ListItemEmits, ListItemProps } from "@/composables/useListItem";
</script>

<script setup lang="ts">
import Button from "@/components/Button.vue";
import {
  defaultListItemProps,
  useListItem,
  type ListItemEmits,
  type ListItemProps,
} from "@/composables/useListItem";

const props = withDefaults(defineProps<ListItemProps>(), defaultListItemProps);

defineEmits<ListItemEmits>();

const { listItemProps, listItemClasses } = useListItem(props);
</script>

<style scoped>
.list-item-main {
  border-radius: 4px !important;
  padding: 7px !important;
  padding-right: 0 !important;
  margin-right: -18px !important;
}

.list-item-main :deep(.v-list-item__append) {
  display: flex;
  justify-content: flex-end;
  align-items: center;
  padding: 0;
}

.list-item-main :deep(.v-list-item__prepend .v-icon) {
  margin-inline-end: 5px !important;
}

.list-item-main :deep(.v-list-item__prepend > div) {
  display: flex !important;
  align-items: center !important;
}

.list-item-main :deep(.v-list-item__content > div) {
  padding-left: 10px;
  padding-right: 10px;
}

.list-item--compact {
  padding: 4px;
}

.list-item--comfortable {
  padding: 12px;
}
</style>
