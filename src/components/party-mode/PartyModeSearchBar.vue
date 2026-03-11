<template>
  <div class="search-section">
    <Button
      variant="ghost"
      size="icon"
      class="back-arrow"
      :class="{ active: showBack }"
      :aria-label="$t('back')"
      @click="$emit('back')"
    >
      <ArrowLeft :size="20" />
    </Button>

    <div class="search-input-wrapper">
      <Search :size="18" class="search-icon" />
      <Input
        :model-value="searchQuery"
        :placeholder="$t('providers.party_mode.guest_page.search_placeholder')"
        autofocus
        inputmode="search"
        enterkeyhint="search"
        class="search-input"
        @update:model-value="$emit('update:searchQuery', $event)"
        @keydown.enter="$emit('submit')"
      />
      <Button
        v-if="searchQuery"
        variant="ghost"
        size="icon-sm"
        class="clear-btn"
        @click="$emit('clear')"
      >
        <X :size="16" />
      </Button>
    </div>

    <div class="filter-toggle">
      <!-- TODO -->
    </div>
  </div>

  <!-- Search Filter Chips -->
  <div v-if="hasSearched || searchQuery.length >= 2" class="filter-section">
    <div class="filter-group">
      <Button
        v-for="filter in filters"
        :key="filter.value"
        :variant="searchFilter === filter.value ? 'default' : 'outline'"
        size="sm"
        class="filter-chip"
        @click="$emit('update:searchFilter', filter.value)"
      >
        <component :is="filter.icon" v-if="filter.icon" :size="14" />
        {{ filter.label }}
      </Button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { $t } from "@/plugins/i18n";
import { Button } from "@/components/ui/button";
import Input from "@/components/ui/input/Input.vue";
import { ArrowLeft, Music, Search, UserRound, X } from "lucide-vue-next";

defineProps<{
  searchQuery: string;
  hasSearched: boolean;
  searchFilter: string;
  showBack: boolean;
}>();

defineEmits<{
  "update:searchQuery": [value: string | number];
  "update:searchFilter": [value: string];
  clear: [];
  back: [];
  submit: [];
}>();

const filters = computed(() => [
  { value: "all", label: $t("searchtype_all"), icon: null },
  {
    value: "track",
    label: $t("providers.party_mode.guest_page.filter_songs"),
    icon: Music,
  },
  { value: "artist", label: $t("artists"), icon: UserRound },
]);
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
  pointer-events: none;
  flex-shrink: 0;
}

.back-arrow.active {
  opacity: 1;
  pointer-events: auto;
}

.search-input-wrapper {
  position: relative;
  flex: 1;
  display: flex;
  align-items: center;
}

.search-icon {
  position: absolute;
  left: 0.75rem;
  color: var(--muted-foreground);
  pointer-events: none;
  z-index: 1;
}

.search-input {
  flex: 1;
  padding-left: 2.5rem !important;
  padding-right: 2.5rem !important;
  height: 2.75rem !important;
}

.clear-btn {
  position: absolute;
  right: 0.25rem;
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

.filter-group {
  display: flex;
  gap: 0.5rem;
}

.filter-chip {
  font-weight: 500;
  transition: all 0.2s ease;
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
