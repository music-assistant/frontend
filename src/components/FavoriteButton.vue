<script setup lang="ts">
import Button from "@/components/Button.vue";
import api from "@/plugins/api";
import { type MediaItemType } from "@/plugins/api/interfaces";
import { Heart } from "lucide-vue-next";

interface Props {
  item: MediaItemType;
}

const props = defineProps<Props>();
</script>

<template>
  <Button
    v-bind="props"
    variant="icon"
    :title="$t('tooltip.favorite')"
    @click="api.toggleFavorite(item)"
    @click.prevent
    @click.stop
  >
    <Heart
      :size="20"
      :fill="item?.favorite ? 'currentColor' : 'none'"
    />
  </Button>
</template>
