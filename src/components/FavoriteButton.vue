<script setup lang="ts">
import { type MediaItemType } from "@/plugins/api/interfaces";
import api from "@/plugins/api";
import Button from "@/components/mods/Button.vue";

interface Props {
  item: MediaItemType;
}

const props = defineProps<Props>();
</script>

<template>
  <Button
    v-bind="props"
    variant="list"
    :icon="item?.favorite ? 'mdi-heart' : 'mdi-heart-outline'"
    :title="$t('tooltip.favorite')"
    @click="api.toggleFavorite(item)"
    @click.prevent
    @click.stop
  />
</template>
