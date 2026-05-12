<template>
  <section v-if="work">
    <!-- The work has no artwork of its own; the header borrows the composer's
         fanart/thumb. Title/catalog/work-type/year/composer-link follow. -->
    <InfoHeader v-if="artistItem" :item="artistItem" />

    <div class="work-meta-row">
      <router-link
        :to="`/classical/composers/${work.composer_id}`"
        class="work-composer-link"
      >
        {{ work.composer }}
      </router-link>
      <span v-if="work.catalog_number" class="work-meta-sep"
        >· {{ work.catalog_number }}</span
      >
      <span v-if="work.work_type" class="work-meta-sep"
        >· {{ formatWorkType(work.work_type) }}</span
      >
      <span v-if="work.year_composed" class="work-meta-sep"
        >· {{ work.year_composed }}</span
      >
    </div>

    <Toolbar
      :title="$t('recordings')"
      :count="recordings.length"
      color="transparent"
    />
    <v-divider />

    <ContextualFilterBanner
      v-if="filterByArtistId"
      :count="recordings.length"
      :performer-name="filterPerformerName"
      class="recordings-filter-banner"
      @clear="clearFilter"
    />
    <div v-if="recordings.length" class="recordings-list">
      <WorkRecordingCard
        v-for="r in recordings"
        :key="r.item_id"
        :recording="r"
        :performer-lookup="performerNameLookup"
        @play-recording="playRecording"
        @play-movement="playMovement"
        @menu-recording="onMenuRecording"
        @menu-movement="onMenuMovement"
      />
    </div>
    <p v-else class="recordings-empty">
      {{ $t("classical_no_recordings_match") }}
    </p>

    <template v-if="work.arrangement_of?.length">
      <Toolbar :title="$t('related_works')" color="transparent" />
      <v-divider />
      <ul class="related-list">
        <li v-for="r in work.arrangement_of" :key="r.item_id">
          {{ $t("classical_arrangement_of") }}
          <router-link :to="`/classical/works/${r.item_id}`">
            {{ r.composer }} — {{ r.name }}
          </router-link>
        </li>
      </ul>
    </template>
  </section>
  <section v-else-if="!loading" class="work-not-found">
    <p>{{ $t("classical_work_not_found") }}</p>
    <router-link to="/classical/works">
      {{ $t("classical_back_to_works") }}
    </router-link>
  </section>
</template>

<script setup lang="ts">
import InfoHeader from "@/components/InfoHeader.vue";
import Toolbar from "@/components/Toolbar.vue";
import { type Artist } from "@/plugins/api/interfaces";
import {
  getComposer,
  getPerformers,
  getWork,
  getWorkRecordings,
  makePerformerLookup,
  synthesiseArtist,
  type ClassicalComposer,
  type ClassicalPerformer,
  type ClassicalRecording,
  type ClassicalRecordingMovement,
  type ClassicalWorkSummary,
} from "@/services/classical";
import ContextualFilterBanner from "@/views/classical/components/ContextualFilterBanner.vue";
import WorkRecordingCard from "@/views/classical/components/WorkRecordingCard.vue";
import { openMovementMenu, openRecordingMenu } from "@/views/classical/menu";
import { computed, ref, watch } from "vue";
import { useRouter } from "vue-router";

defineOptions({ name: "WorkDetail" });

const props = defineProps<{
  id: string;
  filterByArtistId?: string;
}>();

const router = useRouter();

const work = ref<ClassicalWorkSummary | undefined>();
const composer = ref<ClassicalComposer | undefined>();
const recordings = ref<ClassicalRecording[]>([]);
const performers = ref<ClassicalPerformer[]>([]);
const loading = ref(true);

const filterByArtistId = computed(() => props.filterByArtistId || null);

const performerLookup = computed(() => makePerformerLookup(performers.value));

// Names-only map for the recording card's display credits.
const performerNameLookup = computed<Record<string, string>>(() => {
  const out: Record<string, string> = {};
  for (const id in performerLookup.value)
    out[id] = performerLookup.value[id].name;
  return out;
});

const filterPerformerName = computed(() =>
  filterByArtistId.value
    ? (performerLookup.value[filterByArtistId.value]?.name ?? "")
    : "",
);

const artistItem = computed<Artist | undefined>(() => {
  const w = work.value;
  if (!w) return undefined;
  const c = composer.value;
  return synthesiseArtist({
    id: w.item_id,
    name: w.name,
    uri: `library://work/${w.item_id}`,
    fanart_url: c?.fanart_url,
    thumbnail_url: c?.thumbnail_url,
    // Skip the composer's logo so the InfoHeader name slot shows the work title.
    logo_url: null,
    biography: w.description ?? null,
  });
});

const load = async (id: string, filter: string | null) => {
  loading.value = true;
  work.value = await getWork(id);
  recordings.value = await getWorkRecordings(id, filter ?? undefined);
  if (performers.value.length === 0) {
    performers.value = await getPerformers();
  }
  composer.value = work.value
    ? await getComposer(work.value.composer_id)
    : undefined;
  loading.value = false;
};

watch(
  () => [props.id, filterByArtistId.value] as const,
  ([id, filter]) => load(id, filter),
  { immediate: true },
);

const clearFilter = () => {
  router.replace({ path: `/classical/works/${props.id}` });
};

const playRecording = (_r: ClassicalRecording) => {
  // TODO: queue all movements gapless via play_work.
};

const playMovement = (_m: ClassicalRecordingMovement) => {
  // TODO: play a single movement.
};

const menuContext = () => ({
  router,
  work: work.value!,
  composer: composer.value,
  performerLookup: performerLookup.value,
});

const onMenuRecording = (r: ClassicalRecording, evt: Event) => {
  if (!work.value) return;
  openRecordingMenu(r, menuContext(), evt);
};

const onMenuMovement = (
  m: ClassicalRecordingMovement,
  r: ClassicalRecording,
  evt: Event,
) => {
  if (!work.value) return;
  openMovementMenu(m, r, menuContext(), evt);
};

const formatWorkType = (raw: string) => {
  if (!raw) return "";
  return raw
    .split("_")
    .map((w) => w[0]?.toUpperCase() + w.slice(1))
    .join(" ");
};
</script>

<style scoped>
.work-meta-row {
  padding: 0.6rem 1rem 0;
  display: flex;
  flex-wrap: wrap;
  gap: 0.4rem;
  font-size: 0.95rem;
  color: var(--muted-foreground, #aaa);
}

.work-composer-link {
  font-family: var(--font-classical-serif);
  font-optical-sizing: auto;
  font-weight: 600;
  font-size: 1.05rem;
  color: inherit;
  text-decoration: none;
}

.work-composer-link:hover {
  text-decoration: underline;
}

.recordings-filter-banner {
  margin: 0.5rem 1rem 0;
}

.recordings-list {
  display: flex;
  flex-direction: column;
  padding: 0.25rem 1rem 0;
}

.recordings-empty {
  padding: 1rem;
  color: var(--muted-foreground, #888);
}

.related-list {
  list-style: none;
  margin: 0;
  padding: 0.5rem 1rem;
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.work-not-found {
  padding: 1rem;
}
</style>
