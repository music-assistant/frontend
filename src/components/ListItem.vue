<template>
  <v-list-item v-bind="listItemProps" class="list-item-main" @input="(v: any) => $emit('input', v)">
    <!-- Dynamically inherit slots from parent -->
    <template v-for="slot in parentSlots" #[slot]>
      <slot :name="slot"></slot>
    </template>

    <!-- append -->
    <template v-if="$slots.append" #append>
      <slot name="append"></slot>
    </template>
  </v-list-item>
</template>

<script lang="ts">
import { computed } from 'vue';

export default {
  setup(props, ctx) {
    const parentSlots = computed(() => Object.keys(ctx.slots));

    const listItemDefaults = computed(() => ({}));

    const listItemProps = computed(() => ({
      ...listItemDefaults.value,
      ...ctx.attrs,
    }));

    return { parentSlots, listItemProps };
  },
};
</script>

<style>
.list-item-main {
  border-radius: 4px !important;
  padding: 4px 4px !important;
}

.list-item-main > div.v-list-item__append {
  display: flex;
  justify-content: end;
  vertical-align: middle;
  align-items: center;
  padding: 0px;
}

.list-item-main > div.v-list-item__append > div {
  padding-left: 4px !important;
}

.list-item-main > div.v-list-item__prepend > .v-icon {
  margin-inline-end: 10px !important;
  width: 50px !important;
}

.list-item-main > div.v-list-item__append > .v-icon {
  margin-inline-start: 10px !important;
  width: 50px !important;
}

.list-item-main > div.v-list-item__prepend > button {
  margin-inline-end: 10px !important;
  width: 50px !important;
}

.list-item-main > div.v-list-item__append > button {
  margin-inline-start: 10px !important;
  width: 50px !important;
}

.v-list-item--density-default:not(.v-list-item--nav).v-list-item--two-line {
  padding-inline-end: 8px !important;
}
</style>
