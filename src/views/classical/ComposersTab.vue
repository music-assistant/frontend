<template>
  <div class="composers-tab">
    <div class="composers-controls">
      <input
        v-model="search"
        type="search"
        :placeholder="searchPlaceholder"
        class="composers-search"
        :aria-label="searchPlaceholder"
      />
      <label class="composers-sort">
        {{ $t("classical_sort_label") }}
        <select v-model="sort">
          <option value="sort_name">{{ $t("sort.sort_name") }}</option>
          <option value="name">{{ $t("sort.name") }}</option>
          <option value="works">{{ $t("classical_sort_works") }}</option>
        </select>
      </label>
    </div>

    <ul v-if="filteredComposers.length" class="composer-grid">
      <li v-for="c in filteredComposers" :key="c.item_id" class="composer-card">
        <router-link
          :to="`/classical/composers/${c.item_id}`"
          class="composer-card-link"
          :aria-label="c.name"
        >
          <div class="composer-thumb">
            <img
              v-if="c.fanart_url || c.thumbnail_url"
              :src="c.fanart_url || c.thumbnail_url || ''"
              :alt="c.name"
              loading="lazy"
            />
            <div v-else class="composer-thumb-placeholder"></div>
          </div>
          <div class="composer-meta">
            <div class="composer-name">{{ c.name }}</div>
            <div v-if="c.year_range" class="composer-sub">
              {{ c.year_range }}
            </div>
            <div class="composer-sub">
              {{ $t("works") }}: {{ c.work_count }}
            </div>
          </div>
        </router-link>
      </li>
    </ul>
    <p v-else-if="composers.length" class="text-muted-foreground">
      {{ $t("classical_no_composers_match") }}
    </p>
    <p v-else class="text-muted-foreground">
      {{ $t("classical_no_composers") }}
    </p>
  </div>
</template>

<script setup lang="ts">
import { normalizeForFilter } from "@/helpers/utils";
import { getComposers, type ClassicalComposer } from "@/services/classical";
import { computed, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";

defineOptions({ name: "ComposersTab" });

type SortKey = "name" | "sort_name" | "works";

const { t } = useI18n();

const composers = ref<ClassicalComposer[]>([]);
const search = ref("");
const sort = ref<SortKey>("sort_name");

const searchPlaceholder = computed(() =>
  t("classical_filter_composers_placeholder"),
);

onMounted(async () => {
  composers.value = await getComposers();
});

const collator = new Intl.Collator(undefined, { numeric: true });

const filteredComposers = computed(() => {
  const q = normalizeForFilter(search.value.trim());
  const filtered = q
    ? composers.value.filter((c) => normalizeForFilter(c.name).includes(q))
    : composers.value;
  const sorted = [...filtered];
  sorted.sort((a, b) => {
    if (sort.value === "works") {
      const byCount = b.work_count - a.work_count;
      if (byCount !== 0) return byCount;
      return collator.compare(a.sort_name || a.name, b.sort_name || b.name);
    }
    if (sort.value === "sort_name") {
      return collator.compare(a.sort_name || a.name, b.sort_name || b.name);
    }
    return collator.compare(a.name, b.name);
  });
  return sorted;
});
</script>

<style scoped>
.composers-tab {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.composers-controls {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
  align-items: center;
}

.composers-search {
  flex: 1;
  min-width: 200px;
  padding: 0.45rem 0.7rem;
  border-radius: 6px;
  border: 1px solid var(--border, #444);
  background: var(--card, transparent);
  color: inherit;
  font: inherit;
}

.composers-sort {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.9rem;
  color: var(--muted-foreground, #aaa);
}

.composers-sort select {
  /* Pinned identically in WorksTab and PerformersTab. */
  min-width: 12rem;
  background: var(--card, transparent);
  color: inherit;
  border: 1px solid var(--border, #444);
  border-radius: 6px;
  padding: 0.3rem 0.5rem;
  font: inherit;
}

.composer-grid {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 1rem;
}

.composer-card {
  display: flex;
  flex-direction: column;
}

.composer-card-link {
  display: flex;
  flex-direction: column;
  color: inherit;
  text-decoration: none;
  transition: transform 0.15s ease;
}

.composer-card-link:hover,
.composer-card-link:focus-visible {
  transform: translateY(-2px);
}

.composer-thumb {
  display: block;
  /* fanart.tv background art proportions */
  aspect-ratio: 16 / 9;
  border-radius: 8px;
  overflow: hidden;
  background: var(--muted, #2a2a2a);
}

.composer-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.composer-thumb-placeholder {
  width: 100%;
  height: 100%;
  background: linear-gradient(135deg, #4a4a4a, #1a1a1a);
}

.composer-meta {
  margin-top: 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
}

.composer-name {
  font-weight: 600;
  font-size: 0.95rem;
}

.composer-card-link:hover .composer-name,
.composer-card-link:focus-visible .composer-name {
  text-decoration: underline;
}

.composer-sub {
  color: var(--muted-foreground, #888);
  font-size: 0.8125rem;
}
</style>
