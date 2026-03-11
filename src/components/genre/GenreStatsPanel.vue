<template>
  <div class="config-panel-content">
    <div class="stats-row">
      <span class="text-medium-emphasis">{{
        $t("settings.total_genres")
      }}</span>
      <span class="font-weight-bold">{{ count ?? "..." }}</span>
    </div>
    <v-btn
      class="mt-4"
      variant="outlined"
      color="primary"
      @click="$emit('view-genres')"
    >
      <template #prepend>
        <GenreIcon class="size-[18px]" />
      </template>
      {{ $t("settings.view_all_genres") }}
    </v-btn>
  </div>
</template>

<script setup lang="ts">
import GenreIcon from "@/components/icons/GenreIcon.vue";

interface Props {
  count: number | undefined;
}

defineProps<Props>();
defineEmits<{ "view-genres": [] }>();
</script>

<style scoped>
.config-panel-content {
  padding: 16px 20px 20px;
  border-top: 1px solid rgba(var(--v-theme-on-surface), 0.08);
}

.stats-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
}
</style>
