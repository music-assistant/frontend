<template>
  <div class="works-tab">
    <div class="works-controls">
      <input
        v-model="search"
        type="search"
        :placeholder="searchPlaceholder"
        class="works-search"
        :aria-label="searchPlaceholder"
      />
      <YearRangeFilter
        v-model:from="yearFrom"
        v-model:to="yearTo"
        :earliest="composedBounds.earliest"
        :latest="composedBounds.latest"
      />
      <label class="works-sort">
        {{ $t("classical_sort_label") }}
        <select v-model="sort">
          <option value="composer">{{ $t("classical_sort_composer") }}</option>
          <option value="title">{{ $t("classical_sort_title") }}</option>
          <option value="year">{{ $t("classical_sort_year") }}</option>
          <option value="recordings">
            {{ $t("classical_sort_recordings") }}
          </option>
        </select>
      </label>
    </div>

    <ul v-if="filteredWorks.length" class="work-list">
      <li v-for="w in filteredWorks" :key="w.item_id" class="work-row">
        <router-link :to="`/classical/works/${w.item_id}`" class="work-link">
          <span class="work-composer">{{ w.composer }}</span>
          <span class="work-title">{{ w.name }}</span>
        </router-link>
        <!-- Rendered even when empty so every row keeps all four columns. -->
        <span class="work-catalog">{{ w.catalog_number }}</span>
        <span class="work-year">{{ w.year_composed }}</span>
        <span class="work-recordings">
          {{ w.recording_count }}
          {{
            w.recording_count === 1
              ? $t("classical_recording")
              : $t("classical_recordings_lower")
          }}
        </span>
      </li>
    </ul>
    <p v-else-if="works.length" class="text-muted-foreground">
      {{ $t("classical_no_works_match") }}
    </p>
    <p v-else class="text-muted-foreground">
      {{ $t("classical_no_works") }}
    </p>
  </div>
</template>

<script setup lang="ts">
import { normalizeForFilter } from "@/helpers/utils";
import { getWorks, type ClassicalWorkSummary } from "@/services/classical";
import YearRangeFilter from "@/views/classical/components/YearRangeFilter.vue";
import { useYearRange, yearBounds } from "@/views/classical/yearRange";
import { computed, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";

defineOptions({ name: "WorksTab" });

type SortKey = "composer" | "title" | "year" | "recordings";

const { t } = useI18n();

const works = ref<ClassicalWorkSummary[]>([]);
const search = ref("");
const sort = ref<SortKey>("composer");

const { from: yearFrom, to: yearTo, matches: matchesYear } = useYearRange();

const searchPlaceholder = computed(() =>
  t("classical_filter_works_placeholder"),
);

onMounted(async () => {
  works.value = await getWorks();
});

const collator = new Intl.Collator(undefined, { numeric: true });

// Placeholder years, so the boxes advertise the span the library actually covers.
const composedBounds = computed(() =>
  yearBounds(works.value.map((w) => w.year_composed)),
);

const filteredWorks = computed(() => {
  const q = normalizeForFilter(search.value.trim());
  const filtered = works.value.filter((w) => {
    if (q) {
      const hay = `${w.composer} ${w.name} ${w.catalog_number ?? ""}`;
      if (!normalizeForFilter(hay).includes(q)) return false;
    }
    return matchesYear(w.year_composed);
  });
  const sorted = [...filtered];
  sorted.sort((a, b) => {
    switch (sort.value) {
      case "title":
        return collator.compare(a.name, b.name);
      case "year":
        return (a.year_composed ?? Infinity) - (b.year_composed ?? Infinity);
      case "recordings":
        return b.recording_count - a.recording_count;
      case "composer":
      default: {
        const byComposer = collator.compare(a.composer, b.composer);
        if (byComposer !== 0) return byComposer;
        // Within a composer, secondary sort by catalog number so works appear
        // in canonical Op./BWV/K. order. Empty catalogs sort last.
        const ac = a.catalog_number || "";
        const bc = b.catalog_number || "";
        if (!ac && !bc) return 0;
        if (!ac) return 1;
        if (!bc) return -1;
        return collator.compare(ac, bc);
      }
    }
  });
  return sorted;
});
</script>

<style scoped>
.works-tab {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.works-controls {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
  align-items: center;
}

.works-search {
  flex: 1;
  min-width: 200px;
  padding: 0.45rem 0.7rem;
  border-radius: 6px;
  border: 1px solid var(--border, #444);
  background: var(--card, transparent);
  color: inherit;
  font: inherit;
}

.works-sort {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.9rem;
  color: var(--muted-foreground, #aaa);
}

.works-sort select {
  /* Pinned identically in ComposersTab and PerformersTab. */
  min-width: 12rem;
  background: var(--card, transparent);
  color: inherit;
  border: 1px solid var(--border, #444);
  border-radius: 6px;
  padding: 0.3rem 0.5rem;
  font: inherit;
}

.work-list {
  list-style: none;
  margin: 0;
  padding: 0;
  /* Column tracks live on the list, and the rows borrow them through subgrid,
     so catalog, year and count line up all the way down. */
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto auto auto;
  column-gap: 0.75rem;
}

.work-row {
  display: grid;
  grid-column: 1 / -1;
  grid-template-columns: subgrid;
  align-items: baseline;
  padding: 0.5rem 0.25rem;
  border-bottom: 1px solid var(--border, rgba(255, 255, 255, 0.06));
}

.work-row:last-child {
  border-bottom: 0;
}

.work-link {
  display: flex;
  flex-direction: column;
  min-width: 0;
  color: inherit;
  text-decoration: none;
}

.work-link:hover .work-title {
  text-decoration: underline;
}

.work-composer {
  font-size: 0.8rem;
  color: var(--muted-foreground, #aaa);
}

.work-title {
  font-weight: 600;
  font-size: 0.95rem;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.work-catalog,
.work-year,
.work-recordings {
  font-size: 0.85rem;
  color: var(--muted-foreground, #888);
  white-space: nowrap;
}
</style>
