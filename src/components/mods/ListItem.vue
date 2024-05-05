<!-- eslint-disable vue/require-explicit-emits -->
<template>
  <v-list-item
    v-bind="listItemProps"
    class="list-item-main"
    @input="(v: any) => $emit('input', v)"
  >
    <!-- Dynamically inherit slots from parent -->
    <template v-for="(value, name) in $slots as unknown" #[name]>
      <slot :name="name"></slot>
    </template>

    <!-- append -->
    <template v-if="$slots.append" #append>
      <slot name="append"></slot>

      <!-- optional contextmenu button -->
      <MAButton
        v-if="showMenuBtn"
        variant="list"
        icon="mdi-dots-vertical"
        @click.stop="(v: any) => $emit('menu', v)"
      />
    </template>
  </v-list-item>
</template>

<script lang="ts">
import { computed } from 'vue';
import MAButton from './Button.vue';

export default {
  components: { MAButton },
  props: {
    showMenuBtn: {
      type: Boolean,
      default: false,
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

<style scoped>
.list-item-main {
  border-radius: 4px !important;
  padding: 7px !important;
  padding-right: 0 !important;
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

.list-item-main > div.v-list-item__prepend > div {
  display: flex !important;
  align-items: center !important;
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
</style>
