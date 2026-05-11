<template>
  <section v-if="artistItem">
    <InfoHeader :item="artistItem" />
    <Toolbar
      :title="$t('works_performed')"
      :count="works.length"
      color="transparent"
    />
    <v-divider />

    <ul v-if="works.length" class="performer-works-list">
      <li v-for="w in works" :key="w.item_id" class="performer-work-row">
        <router-link :to="workLink(w.item_id)" class="performer-work-link">
          <span class="performer-work-composer">{{ w.composer }}</span>
          <span class="performer-work-title">
            {{ w.name }}
            <span v-if="w.catalog_number" class="performer-work-meta">
              [{{ w.catalog_number }}]
            </span>
          </span>
        </router-link>
        <span class="meta-recordings">
          {{ w.recording_count }}
          {{
            w.recording_count === 1
              ? $t("classical_recording")
              : $t("classical_recordings_lower")
          }}
        </span>
        <ClassicalRowActions
          :favorite="workFavorites[w.item_id] ?? false"
          @toggle-favorite="
            workFavorites[w.item_id] = !workFavorites[w.item_id]
          "
          @play="onPlayWork(w)"
          @menu="(e: Event) => onMenuWork(w, e)"
        />
      </li>
    </ul>
    <p v-else class="performer-works-empty">
      {{ $t("classical_no_works_for_performer") }}
    </p>
  </section>
  <section v-else-if="!loading" class="performer-not-found">
    <p>{{ $t("classical_performer_not_found") }}</p>
    <router-link to="/classical/performers">
      {{ $t("classical_back_to_performers") }}
    </router-link>
  </section>
</template>

<script setup lang="ts">
import InfoHeader from "@/components/InfoHeader.vue";
import Toolbar from "@/components/Toolbar.vue";
import { type Artist } from "@/plugins/api/interfaces";
import {
  getComposer,
  getPerformer,
  getPerformerWorks,
  getPerformers,
  getWorkRecordings,
  makePerformerLookup,
  synthesiseArtist,
  type ClassicalComposer,
  type ClassicalPerformer,
  type ClassicalWorkSummary,
} from "@/services/classical";
import ClassicalRowActions from "@/views/classical/components/ClassicalRowActions.vue";
import { openRecordingMenu } from "@/views/classical/menu";
import { computed, reactive, ref, watch } from "vue";
import { useRouter } from "vue-router";

defineOptions({ name: "PerformerDetail" });

const props = defineProps<{ id: string }>();

const router = useRouter();

const performer = ref<ClassicalPerformer | undefined>();
const works = ref<ClassicalWorkSummary[]>([]);
const allPerformers = ref<ClassicalPerformer[]>([]);
const composerCache = reactive<Record<string, ClassicalComposer>>({});
const loading = ref(true);

const performerLookup = computed(() =>
  makePerformerLookup(allPerformers.value),
);

const artistItem = computed<Artist | undefined>(() => {
  const p = performer.value;
  if (!p) return undefined;
  return synthesiseArtist({
    id: p.item_id,
    name: p.name,
    fanart_url: p.fanart_url,
    thumbnail_url: p.thumbnail_url,
    logo_url: p.logo_url,
    biography: p.biography,
  });
});

// Open the Work detail page with this performer pre-applied as the
// contextual filter so the recordings list defaults to ones they appear on.
const workLink = (workId: string) => ({
  path: `/classical/works/${workId}`,
  query: { filterByArtistId: props.id },
});

const workFavorites = reactive<Record<string, boolean>>({});

const onPlayWork = (_w: ClassicalWorkSummary) => {
  // TODO: play_work command pre-filtered to this performer.
};

// A "Works performed" row really points at this performer's recording(s) of
// the work, so reuse the recording menu rather than rolling a parallel work
// menu. Pick the first matching recording when there are multiple — opening
// the menu against a multi-recording row gives the user the standard menu
// scoped to the most recent recording they have.
const onMenuWork = async (w: ClassicalWorkSummary, evt: Event) => {
  if (!performer.value) return;
  if (!composerCache[w.composer_id]) {
    const c = await getComposer(w.composer_id);
    if (c) composerCache[w.composer_id] = c;
  }
  const recordings = await getWorkRecordings(
    w.item_id,
    performer.value.item_id,
  );
  const recording = recordings[0];
  if (!recording) return;
  openRecordingMenu(
    recording,
    {
      router,
      work: w,
      composer: composerCache[w.composer_id],
      performerLookup: performerLookup.value,
    },
    evt,
  );
};

const load = async (id: string) => {
  loading.value = true;
  performer.value = await getPerformer(id);
  works.value = await getPerformerWorks(id);
  if (allPerformers.value.length === 0) {
    allPerformers.value = await getPerformers();
  }
  loading.value = false;
};

watch(
  () => props.id,
  (id) => load(id),
  { immediate: true },
);
</script>

<style scoped>
.performer-works-list {
  list-style: none;
  margin: 0;
  padding: 0 1rem;
  display: flex;
  flex-direction: column;
}

.performer-work-row {
  padding: 0.5rem 0;
  border-bottom: 1px solid var(--border, rgba(255, 255, 255, 0.06));
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.performer-work-row:last-child {
  border-bottom: 0;
}

.performer-work-link {
  display: flex;
  flex-direction: column;
  color: inherit;
  text-decoration: none;
  flex: 1;
  min-width: 0;
}

.performer-work-link:hover .performer-work-title {
  text-decoration: underline;
}

.performer-work-composer {
  font-size: 0.8rem;
  color: var(--muted-foreground, #aaa);
}

.performer-work-title {
  font-weight: 600;
  font-size: 0.95rem;
}

.meta,
.meta-recordings,
.performer-work-meta {
  color: var(--muted-foreground, #888);
  font-size: 0.875rem;
}

.meta-recordings {
  white-space: nowrap;
}

.performer-work-meta {
  font-variant-numeric: tabular-nums;
  margin-left: 0.4rem;
}

.performer-works-empty,
.performer-not-found {
  padding: 1rem;
}
</style>
