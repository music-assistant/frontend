<script setup lang="ts">
import Button from "@/components/Button.vue";
import api from "@/plugins/api";
import { type MediaItemType } from "@/plugins/api/interfaces";

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
