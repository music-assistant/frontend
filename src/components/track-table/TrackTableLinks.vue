<template>
  <span>
    <template v-for="(target, index) in targets" :key="target.uri">
      <span v-if="index > 0">{{ separator }}</span>
      <button
        type="button"
        class="cursor-pointer hover:text-foreground hover:underline focus-visible:underline focus-visible:outline-none"
        @click.stop="open(target)"
      >
        {{ target.name }}
      </button>
    </template>
  </span>
</template>

<script setup lang="ts">
import router from "@/plugins/router";

export interface LinkTarget {
  item_id: string;
  provider: string;
  name: string;
  uri: string;
}

export interface Props {
  targets: LinkTarget[];
  // the detail route each name opens
  routeName: "artist" | "album";
  separator?: string;
}

const props = withDefaults(defineProps<Props>(), {
  separator: " | ",
});

const open = function (target: LinkTarget) {
  router.push({
    name: props.routeName,
    params: { itemId: target.item_id, provider: target.provider },
  });
};
</script>
