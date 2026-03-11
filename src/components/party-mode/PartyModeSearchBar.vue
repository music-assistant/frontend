<template>
  <div class="search-section">
    <v-btn
      icon
      variant="text"
      size="medium"
      class="back-arrow"
      :class="{ active: showBack }"
      :aria-label="$t('back')"
      @click="$emit('back')"
    >
      <v-icon>mdi-arrow-left</v-icon>
    </v-btn>

    <v-text-field
      :model-value="searchQuery"
      :placeholder="$t('providers.party_mode.guest_page.search_placeholder')"
      prepend-inner-icon="mdi-magnify"
      variant="outlined"
      density="comfortable"
      clearable
      autofocus
      hide-details
      inputmode="search"
      enterkeyhint="search"
      class="search-input"
      @update:model-value="$emit('update:searchQuery', $event)"
      @click:clear="$emit('clear')"
      @keydown.enter="$emit('submit')"
    />

    <div class="filter-toggle">
      <!-- TODO -->
    </div>
  </div>

  <!-- Search Filter Chips -->
  <div v-if="hasSearched || searchQuery.length >= 2" class="filter-section">
    <v-chip-group
      :model-value="searchFilter"
      mandatory
      selected-class="filter-active"
      @update:model-value="$emit('update:searchFilter', $event)"
    >
      <v-chip value="all" variant="outlined" size="small" class="filter-chip">
        {{ $t("searchtype_all") }}
      </v-chip>
      <v-chip value="track" variant="outlined" size="small" class="filter-chip">
        <v-icon start size="small">mdi-music-note</v-icon>
        {{ $t("providers.party_mode.guest_page.filter_songs") }}
      </v-chip>
      <v-chip
        value="artist"
        variant="outlined"
        size="small"
        class="filter-chip"
      >
        <v-icon start size="small">mdi-account-music</v-icon>
        {{ $t("artists") }}
      </v-chip>
    </v-chip-group>
  </div>
</template>

<script setup lang="ts">
import { $t } from "@/plugins/i18n";

defineProps<{
  searchQuery: string;
  hasSearched: boolean;
  searchFilter: string;
  showBack: boolean;
}>();

defineEmits<{
  "update:searchQuery": [value: string];
  "update:searchFilter": [value: string];
  clear: [];
  back: [];
  submit: [];
}>();
</script>

<style scoped>
.search-section {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 0.75rem;
  flex-shrink: 0;
}

.back-arrow {
  opacity: 0;
  flex-shrink: 0;
}

.back-arrow.active {
  opacity: 1;
}

.search-input {
  flex: 1;
}

.filter-toggle {
  width: 24px;
  height: 24px;
}

.filter-section {
  display: flex;
  margin-bottom: 1rem;
  flex-shrink: 0;
}

.filter-chip {
  font-weight: 500;
  transition: all 0.2s ease;
}

.filter-active {
  background: rgb(var(--v-theme-primary)) !important;
  color: rgb(var(--v-theme-on-primary)) !important;
  border-color: rgb(var(--v-theme-primary)) !important;
}

@media (max-width: 768px) {
  .search-section {
    gap: 0.75rem;
    margin-bottom: 0.5rem;
  }

  .filter-section {
    margin-bottom: 0.75rem;
  }

  .filter-chip {
    font-size: 0.75rem;
  }
}
</style>
