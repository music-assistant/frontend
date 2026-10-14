<template>
  <span>
    <template v-for="(target, index) in targets" :key="target.uri">
      <span v-if="index > 0">{{ separator }}</span>
      <!-- stopped so the row underneath doesn't open the track or its menu as
           well; a right click keeps the browser's own link menu -->
      <RouterLink
        :to="{
          name: routeName,
          params: { itemId: target.item_id, provider: target.provider },
        }"
        class="text-inherit no-underline hover:text-foreground hover:underline focus-visible:underline focus-visible:outline-none"
        @click.stop
        @contextmenu.stop
      >
        {{ target.name }}
      </RouterLink>
    </template>
  </span>
</template>

<script setup lang="ts">
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

withDefaults(defineProps<Props>(), {
  separator: " | ",
});
</script>
