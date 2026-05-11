<template>
  <!-- Library / favourite / play / menu affordances for a list row, matching
       the existing ListviewItem layout. Click handlers stop propagation so
       they don't trigger the row's primary action. -->
  <div class="row-actions">
    <v-icon
      v-if="inLibrary"
      icon="mdi-bookshelf"
      size="20"
      class="library-icon"
      :title="$t('item_in_library')"
    />
    <v-btn
      icon
      variant="text"
      size="x-small"
      :title="$t('tooltip.favorite')"
      @click.stop.prevent="$emit('toggle-favorite')"
    >
      <v-icon :icon="favorite ? 'mdi-heart' : 'mdi-heart-outline'" size="20" />
    </v-btn>
    <v-btn
      icon
      variant="text"
      size="x-small"
      :title="$t('play')"
      @click.stop.prevent="$emit('play')"
    >
      <v-icon icon="mdi-play-circle-outline" size="24" />
    </v-btn>
    <v-btn
      icon
      variant="text"
      size="x-small"
      :title="$t('tooltip.show_menu')"
      @click.stop.prevent="(e: Event) => $emit('menu', e)"
    >
      <v-icon icon="mdi-dots-vertical" size="20" />
    </v-btn>
  </div>
</template>

<script setup lang="ts">
defineOptions({ name: "ClassicalRowActions" });

withDefaults(
  defineProps<{
    inLibrary?: boolean;
    favorite?: boolean;
  }>(),
  {
    inLibrary: true,
    favorite: false,
  },
);

defineEmits<{
  (e: "toggle-favorite"): void;
  (e: "play"): void;
  (e: "menu", evt: Event): void;
}>();
</script>

<style scoped>
.row-actions {
  display: flex;
  align-items: center;
  gap: 0.1rem;
  flex-shrink: 0;
}

.library-icon {
  opacity: 0.7;
  margin-right: 0.25rem;
}
</style>
