<template>
  <v-list-item v-bind="listItemProps" class="list-item-main" @input="(v: any) => $emit('input', v)">
    <!-- Dynamically inherit slots from parent -->
    <template v-for="(value, name) in ($slots as unknown)" #[name]>
      <slot :name="name"></slot>
    </template>

    <!-- append -->
    <template v-if="$slots.append" #append>
      <slot name="append"></slot>

      <!-- contextmenu -->
      <div v-if="contextMenuItems.length > 0" class="contextmenubtn">
        <v-menu location="bottom end">
          <template #activator="{ props }">
            <v-btn v-bind="props" id="menu" variant="plain" ripple icon="mdi-dots-vertical" />
          </template>
          <v-list>
            <ListItem
              v-for="(item, index) in contextMenuItems.filter((x) => x.hide != true)"
              :key="index"
              :title="$t(item.label, item.labelArgs)"
              :disabled="item.disabled == true"
              @click="item.action ? item.action() : ''"
            >
              <template #prepend>
                <v-avatar :icon="item.icon" />
              </template>
            </ListItem>
          </v-list>
        </v-menu>
      </div>
    </template>
  </v-list-item>
</template>

<script lang="ts">
import { computed } from 'vue';
import type { ContextMenuItem } from '@/helpers/contextmenu';

export default {
  props: {
    contextMenuItems: {
      type: Array<ContextMenuItem>,
      default: [],
    },
  },
  setup(props, ctx) {
    const listItemDefaults = computed(() => ({}));

    const listItemProps = computed(() => ({
      ...listItemDefaults.value,
      ...ctx.attrs,
    }));

    return { listItemProps };
  },
};
</script>

<style>
.list-item-main {
  border-radius: 4px !important;
  padding: 7px !important;
}

.list-item-main > div.v-list-item__append {
  display: flex;
  justify-content: end;
  vertical-align: middle;
  align-items: center;
  padding: 0px;
}

.list-item-main > div.v-list-item__prepend > .v-icon {
  margin-inline-end: 5px !important;
}

.list-item-main > div.v-list-item__append > .v-icon {
  margin-inline-start: 5px !important;
}

.list-item-main > div.v-list-item__prepend > button {
  margin-inline-end: 5px !important;
}

.list-item-main > div.v-list-item__append > button {
  margin-inline-start: 5px !important;
}

.list-item-main > div.v-list-item__content > div {
  padding-left: 10px;
  padding-right: 10px;
}

.contextmenubtn {
  width: 25px;
  margin-right: -13px;
}
</style>
