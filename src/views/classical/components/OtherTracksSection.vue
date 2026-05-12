<template>
  <section v-if="tracks.length" class="other-tracks-section">
    <Toolbar :title="sectionTitle" color="transparent">
      <template #append>
        <div class="sort-control">
          <label class="sort-label">{{ $t("classical_sort_label") }}</label>
          <select v-model="sortKey" class="sort-select">
            <option value="name">{{ $t("classical_sort_name") }}</option>
            <option value="year">{{ $t("classical_sort_year_newest") }}</option>
            <option value="date_added">{{ $t("classical_sort_date_added") }}</option>
          </select>
        </div>
      </template>
    </Toolbar>
    <v-divider />
    <ul class="other-tracks-list">
      <li
        v-for="t in sortedTracks"
        :key="t.item_id"
        class="other-track-row"
        @click="$emit('play-track', t)"
        @contextmenu.prevent="$emit('menu-track', t, $event)"
      >
        <div class="other-track-main">
          <span class="other-track-title">{{ t.name }}</span>
          <router-link
            :to="`/albums/library/${t.album_id}`"
            class="other-track-album"
            @click.stop
          >
            {{ t.album }}
          </router-link>
        </div>
        <span class="other-track-duration">
          {{ formatDuration(t.duration_seconds) }}
        </span>
        <ClassicalRowActions
          :in-library="true"
          :favorite="favorites[t.item_id] ?? false"
          @toggle-favorite="favorites[t.item_id] = !favorites[t.item_id]"
          @play="$emit('play-track', t)"
          @menu="(e: Event) => $emit('menu-track', t, e)"
        />
      </li>
    </ul>
  </section>
</template>

<script setup lang="ts">
import Toolbar from "@/components/Toolbar.vue";
import { formatDuration } from "@/helpers/utils";
import type { ClassicalOtherTrack } from "@/services/classical";
import ClassicalRowActions from "@/views/classical/components/ClassicalRowActions.vue";
import { computed, reactive, ref } from "vue";
import { useI18n } from "vue-i18n";

defineOptions({ name: "OtherTracksSection" });

const props = defineProps<{
  tracks: ClassicalOtherTrack[];
}>();

const { t } = useI18n();

const sectionTitle = computed(
  () => `${t("classical_other_tracks")} (${props.tracks.length})`,
);

defineEmits<{
  (e: "play-track", track: ClassicalOtherTrack): void;
  (e: "menu-track", track: ClassicalOtherTrack, evt: Event): void;
}>();

type SortKey = "name" | "year" | "date_added";
const sortKey = ref<SortKey>("name");

const favorites = reactive<Record<string, boolean>>({});

const collator = new Intl.Collator(undefined, { numeric: true });

const sortedTracks = computed(() => {
  const list = [...props.tracks];
  switch (sortKey.value) {
    case "year":
      return list.sort((a, b) => {
        const ay = a.year ?? -Infinity;
        const by = b.year ?? -Infinity;
        return by - ay || collator.compare(a.name, b.name);
      });
    case "date_added":
      return list.sort((a, b) => b.timestamp_added - a.timestamp_added);
    case "name":
    default:
      return list.sort((a, b) => collator.compare(a.name, b.name));
  }
});
</script>

<style scoped>
.other-tracks-section {
  margin-top: 1rem;
}

.sort-control {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  font-size: 0.85rem;
}

.sort-label {
  color: var(--muted-foreground, #aaa);
}

.sort-select {
  background: transparent;
  color: inherit;
  border: 1px solid var(--border, rgba(255, 255, 255, 0.12));
  border-radius: 4px;
  padding: 0.15rem 0.35rem;
  font: inherit;
  font-size: 0.85rem;
}

.other-tracks-list {
  list-style: none;
  margin: 0;
  padding: 0 1rem;
  display: flex;
  flex-direction: column;
}

.other-track-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.5rem 0.25rem;
  cursor: pointer;
  border-bottom: 1px solid var(--border, rgba(255, 255, 255, 0.06));
}

.other-track-row:last-child {
  border-bottom: 0;
}

.other-track-row:hover {
  background: var(--muted, rgba(255, 255, 255, 0.04));
}

.other-track-main {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
}

.other-track-title {
  font-weight: 500;
  font-size: 0.95rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.other-track-album {
  font-size: 0.8rem;
  color: var(--muted-foreground, #888);
  text-decoration: none;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.other-track-album:hover {
  text-decoration: underline;
}

.other-track-duration {
  color: var(--muted-foreground, #888);
  font-size: 0.85rem;
  font-variant-numeric: tabular-nums;
  white-space: nowrap;
}
</style>
