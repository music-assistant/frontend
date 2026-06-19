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
      :count="displayedRecordings.length"
      color="transparent"
    />
    <v-divider />

    <RecordingsFilter
      v-model="query"
      :committed="committed"
      :count="displayedRecordings.length"
      :performer-name="committedKind === 'performer' ? performerName : ''"
      :term="committedKind === 'text' ? committedTerm : ''"
      class="recordings-filter"
      @commit="commitFilter"
      @edit="editFilter"
      @clear="clearFilter"
    />
    <div v-if="displayedRecordings.length" class="recordings-list">
      <WorkRecordingCard
        v-for="r in displayedRecordings"
        :key="r.item_id"
        :recording="r"
        :performer-lookup="performerNameLookup"
        @play-recording="playRecording"
        @play-movement="playMovement"
        @menu-recording="onMenuRecording"
        @menu-movement="onMenuMovement"
      />
    </div>
    <p v-else-if="!committed" class="recordings-empty">
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
import RecordingsFilter from "@/views/classical/components/RecordingsFilter.vue";
import WorkRecordingCard from "@/views/classical/components/WorkRecordingCard.vue";
import { openMovementMenu, openRecordingMenu } from "@/views/classical/menu";
import { normalizeForFilter } from "@/helpers/utils";
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

// Recordings filter state. `query` is the live input text; `committed` swaps
// the input for the status banner. A commit is either user-driven (Enter, kind
// "text") or a performer-context arrival (filterByArtistId, kind "performer").
const query = ref("");
const committed = ref(false);
const committedKind = ref<"text" | "performer" | null>(null);
const committedTerm = ref("");
const performerArtistId = ref<string | null>(null);

const performerLookup = computed(() => makePerformerLookup(performers.value));

// Names-only map for the recording card's display credits.
const performerNameLookup = computed<Record<string, string>>(() => {
  const out: Record<string, string> = {};
  for (const id in performerLookup.value)
    out[id] = performerLookup.value[id].name;
  return out;
});

const performerName = computed(() =>
  performerArtistId.value
    ? (performerLookup.value[performerArtistId.value]?.name ?? "")
    : "",
);

// Every piece of text the card can surface for a recording, folded for
// case-insensitive, diacritic-blind substring matching. Memoised so typing
// against a heavily-recorded work doesn't rebuild it per keystroke.
const recordingHaystack = (r: ClassicalRecording): string => {
  const parts: string[] = [];
  if (r.conductor) parts.push(r.conductor);
  if (r.orchestra) parts.push(r.orchestra);
  for (const id of r.performer_ids ?? [])
    parts.push(performerNameLookup.value[id] ?? "");
  for (const c of r.credits ?? [])
    parts.push(performerNameLookup.value[c.artist_id] ?? "");
  if (r.source_album) parts.push(r.source_album);
  if (r.year != null) parts.push(String(r.year));
  return normalizeForFilter(parts.join(" "));
};

const searchable = computed(() =>
  recordings.value.map((r) => ({ r, haystack: recordingHaystack(r) })),
);

const matchesArtist = (r: ClassicalRecording, id: string): boolean =>
  r.conductor_id === id ||
  r.orchestra_id === id ||
  (r.performer_ids?.includes(id) ?? false) ||
  (r.credits?.some((c) => c.artist_id === id) ?? false);

const displayedRecordings = computed(() => {
  if (
    committed.value &&
    committedKind.value === "performer" &&
    performerArtistId.value
  )
    return recordings.value.filter((r) =>
      matchesArtist(r, performerArtistId.value!),
    );
  const raw =
    committed.value && committedKind.value === "text"
      ? committedTerm.value
      : query.value;
  const term = normalizeForFilter(raw.trim());
  if (!term) return recordings.value;
  return searchable.value
    .filter((s) => s.haystack.includes(term))
    .map((s) => s.r);
});

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

const resetFilter = () => {
  query.value = "";
  committed.value = false;
  committedKind.value = null;
  committedTerm.value = "";
  performerArtistId.value = null;
};

const load = async (id: string) => {
  loading.value = true;
  resetFilter();
  work.value = await getWork(id);
  recordings.value = await getWorkRecordings(id);
  if (performers.value.length === 0) {
    performers.value = await getPerformers();
  }
  composer.value = work.value
    ? await getComposer(work.value.composer_id)
    : undefined;
  loading.value = false;
};

watch(
  () => props.id,
  (id) => load(id),
  { immediate: true },
);

// A performer-context arrival pre-commits the filter to that performer. Only
// truthy values drive this: clearing the param (Show all / banner edit) must
// not clobber the local input state those handlers set themselves.
watch(
  () => props.filterByArtistId,
  (id) => {
    if (!id) return;
    performerArtistId.value = id;
    committedKind.value = "performer";
    committed.value = true;
    committedTerm.value = "";
    query.value = "";
  },
  { immediate: true },
);

const dropArtistParam = () => {
  if (props.filterByArtistId)
    router.replace({ path: `/classical/works/${props.id}` });
};

const commitFilter = () => {
  const term = query.value.trim();
  if (!term) return;
  committedTerm.value = term;
  committedKind.value = "text";
  committed.value = true;
};

// Banner → editable input, pre-filled with the active term so it can be tweaked.
const editFilter = () => {
  if (committedKind.value === "performer") {
    query.value = performerName.value;
    dropArtistParam();
  } else {
    query.value = committedTerm.value;
  }
  committed.value = false;
  committedKind.value = null;
  committedTerm.value = "";
  performerArtistId.value = null;
};

const clearFilter = () => {
  dropArtistParam();
  resetFilter();
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

.recordings-filter {
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
