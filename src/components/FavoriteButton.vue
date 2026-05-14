<script setup lang="ts">
import Button from "@/components/Button.vue";
import api from "@/plugins/api";
import { type MediaItemType } from "@/plugins/api/interfaces";
import { computed } from "vue";
import { useI18n } from "vue-i18n";

interface Props {
  item: MediaItemType;
}

const props = defineProps<Props>();
const { t } = useI18n();

const favoriteButtonLabel = computed(() =>
  props.item?.favorite ? t("favorites_remove") : t("favorites_add"),
);
</script>

<template>
  <Button
    v-bind="props"
    variant="icon"
    :icon="item?.favorite ? 'mdi-heart' : 'mdi-heart-outline'"
    :title="favoriteButtonLabel"
    :aria-pressed="item?.favorite ? 'true' : 'false'"
    @click="api.toggleFavorite(item)"
    @click.prevent
    @click.stop
  />
</template>
