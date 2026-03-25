<template>
  <div class="search-section">
    <Button
      variant="ghost"
      size="icon"
      class="back-arrow"
      :disabled="!showBack"
      :aria-label="$t('back')"
      @click="$emit('back')"
    >
      <ArrowLeft :size="20" />
    </Button>

    <InputGroup class="search-input-group">
      <InputGroupAddon>
        <Search />
      </InputGroupAddon>
      <InputGroupInput
        ref="inputRef"
        :model-value="searchQuery"
        :placeholder="$t('providers.party.guest_page.search_placeholder')"
        autofocus
        inputmode="search"
        enterkeyhint="search"
        @update:model-value="$emit('update:searchQuery', $event)"
        @keydown.enter="$emit('submit')"
      />
      <InputGroupAddon align="inline-end">
        <InputGroupButton
          v-if="searchQuery"
          size="icon-sm"
          @click="$emit('clear')"
        >
          <X :size="16" />
        </InputGroupButton>
      </InputGroupAddon>
    </InputGroup>
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
import { computed, ref } from "vue";
import { $t } from "@/plugins/i18n";
import { Button } from "@/components/ui/button";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { ArrowLeft, Music, Search, UserRound, X } from "lucide-vue-next";

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

const inputRef = ref<InstanceType<typeof InputGroupInput> | null>(null);

const focus = () => {
  inputRef.value?.focus();
};

defineExpose({ focus });

const filters = computed(() => [
  { value: "all", label: $t("searchtype_all"), icon: null },
  {
    value: "track",
    label: $t("providers.party.guest_page.filter_songs"),
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
  flex-shrink: 0;
}

.back-arrow:disabled {
  opacity: 0.4;
}

.search-input-group {
  flex: 1;
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
