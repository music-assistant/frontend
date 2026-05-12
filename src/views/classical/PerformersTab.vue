<template>
  <div class="performers-tab">
    <div class="performers-controls">
      <input
        v-model="search"
        type="search"
        :placeholder="searchPlaceholder"
        class="performers-search"
        :aria-label="searchPlaceholder"
      />
      <label class="performers-sort">
        {{ $t("classical_sort_label") }}
        <select v-model="sort">
          <option value="name">{{ $t("sort.name") }}</option>
          <option value="recordings">
            {{ $t("classical_sort_recordings") }}
          </option>
        </select>
      </label>
    </div>

    <div class="role-chips">
      <button
        v-for="chip in chips"
        :key="chip.value ?? 'all'"
        type="button"
        class="role-chip"
        :class="{ active: chip.value === activeRole }"
        @click="setRole(chip.value)"
      >
        {{ $t(chip.labelKey) }}
      </button>
    </div>

    <ul v-if="filteredPerformers.length" class="performer-grid">
      <li
        v-for="p in filteredPerformers"
        :key="p.item_id"
        class="performer-card"
      >
        <router-link
          :to="`/classical/performers/${p.item_id}`"
          class="performer-card-link"
          :aria-label="p.name"
        >
          <div class="performer-thumb">
            <img
              v-if="p.fanart_url || p.thumbnail_url"
              :src="p.fanart_url || p.thumbnail_url || ''"
              :alt="p.name"
              loading="lazy"
            />
            <div v-else class="performer-thumb-placeholder">
              <span>{{ initials(p.name) }}</span>
            </div>
          </div>
          <div class="performer-meta">
            <div class="performer-name">{{ p.name }}</div>
            <div class="performer-sub performer-role">
              {{ formatRole(p.role) }}
            </div>
            <div class="performer-sub">
              {{ p.recording_count }}
              {{
                p.recording_count === 1
                  ? $t("classical_recording")
                  : $t("classical_recordings_lower")
              }}
            </div>
          </div>
        </router-link>
      </li>
    </ul>
    <p v-else-if="search.trim()" class="text-muted-foreground">
      {{ $t("classical_no_performers_match") }}
    </p>
    <p v-else class="text-muted-foreground">
      {{ $t("classical_no_performers_for_role") }}
    </p>
  </div>
</template>

<script setup lang="ts">
import { ArtistRole } from "@/types/classical";
import { normalizeForFilter } from "@/helpers/utils";
import { getPerformers, type ClassicalPerformer } from "@/services/classical";
import { computed, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";

defineOptions({ name: "PerformersTab" });

type SortKey = "name" | "recordings";

const { t } = useI18n();

const props = defineProps<{
  // Pre-selected chip from /classical/performers?role=conductor.
  role?: string;
}>();

const router = useRouter();

interface Chip {
  /** null = "All" (no role filter). */
  value: ArtistRole | null;
  labelKey: string;
}

const chips: Chip[] = [
  { value: null, labelKey: "classical_role.all" },
  { value: ArtistRole.CONDUCTOR, labelKey: "classical_role.conductors" },
  { value: ArtistRole.ORCHESTRA, labelKey: "classical_role.orchestras" },
  { value: ArtistRole.ENSEMBLE, labelKey: "classical_role.chamber_groups" },
  { value: ArtistRole.CHOIR, labelKey: "classical_role.choirs" },
  { value: ArtistRole.SOLOIST, labelKey: "classical_role.soloists" },
  // Catches credits with role=PERFORMER that weren't classified more specifically.
  { value: ArtistRole.PERFORMER, labelKey: "classical_role.other" },
];

const performers = ref<ClassicalPerformer[]>([]);
const search = ref("");
const sort = ref<SortKey>("name");

const searchPlaceholder = computed(() =>
  t("classical_filter_performers_placeholder"),
);

const activeRole = computed<ArtistRole | null>(() => {
  if (!props.role) return null;
  return chips.find((c) => c.value === props.role)?.value ?? null;
});

const collator = new Intl.Collator(undefined, { numeric: true });

const filteredPerformers = computed(() => {
  const byRole = activeRole.value
    ? performers.value.filter((p) => p.role === activeRole.value)
    : performers.value;
  const q = normalizeForFilter(search.value.trim());
  const filtered = q
    ? byRole.filter((p) => normalizeForFilter(p.name).includes(q))
    : byRole;
  const sorted = [...filtered];
  sorted.sort((a, b) => {
    if (sort.value === "recordings") {
      const byCount = b.recording_count - a.recording_count;
      if (byCount !== 0) return byCount;
    }
    return collator.compare(a.name, b.name);
  });
  return sorted;
});

const setRole = (role: ArtistRole | null) => {
  router.replace({
    path: "/classical/performers",
    query: role ? { role } : {},
  });
};

const formatRole = (raw: string) =>
  raw
    .split("_")
    .map((w) => w[0]?.toUpperCase() + w.slice(1))
    .join(" ");

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

// Fetch the full performer list once; role chips filter client-side.
const load = async () => {
  performers.value = await getPerformers();
};

onMounted(load);
</script>

<style scoped>
.performers-tab {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.performers-controls {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
  align-items: center;
}

.performers-search {
  flex: 1;
  min-width: 200px;
  padding: 0.45rem 0.7rem;
  border-radius: 6px;
  border: 1px solid var(--border, #444);
  background: var(--card, transparent);
  color: inherit;
  font: inherit;
}

.performers-sort {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.9rem;
  color: var(--muted-foreground, #aaa);
}

.performers-sort select {
  /* Pinned identically in WorksTab and ComposersTab. */
  min-width: 12rem;
  background: var(--card, transparent);
  color: inherit;
  border: 1px solid var(--border, #444);
  border-radius: 6px;
  padding: 0.3rem 0.5rem;
  font: inherit;
}

.role-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
}

.role-chip {
  background: transparent;
  color: inherit;
  border: 1px solid var(--border, #444);
  border-radius: 999px;
  padding: 0.3rem 0.85rem;
  font: inherit;
  font-size: 0.85rem;
  cursor: pointer;
  transition:
    background 0.12s ease,
    border-color 0.12s ease;
}

.role-chip:hover {
  background: var(--muted, rgba(255, 255, 255, 0.05));
}

.role-chip.active {
  background: var(--primary, #4a90e2);
  border-color: var(--primary, #4a90e2);
  color: var(--primary-foreground, #fff);
  font-weight: 600;
}

.performer-grid {
  list-style: none;
  margin: 0;
  padding: 0;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
  gap: 1rem;
}

.performer-card {
  display: flex;
  flex-direction: column;
}

.performer-card-link {
  display: flex;
  flex-direction: column;
  color: inherit;
  text-decoration: none;
  transition: transform 0.15s ease;
}

.performer-card-link:hover,
.performer-card-link:focus-visible {
  transform: translateY(-2px);
}

.performer-card-link:hover .performer-name,
.performer-card-link:focus-visible .performer-name {
  text-decoration: underline;
}

.performer-thumb {
  display: block;
  aspect-ratio: 16 / 9;
  border-radius: 8px;
  overflow: hidden;
  background: var(--muted, #2a2a2a);
}

.performer-thumb img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}

.performer-thumb-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 2rem;
  font-weight: 700;
  color: var(--muted-foreground, #888);
  background: linear-gradient(135deg, #4a4a4a, #1a1a1a);
}

.performer-meta {
  margin-top: 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
}

.performer-name {
  font-weight: 600;
  font-size: 0.95rem;
}

.performer-sub {
  color: var(--muted-foreground, #888);
  font-size: 0.8125rem;
}

.performer-role {
  text-transform: capitalize;
}
</style>
