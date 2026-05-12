<template>
  <section v-if="artistItem">
    <InfoHeader :item="artistItem" />
    <Toolbar :title="$t('works')" :count="works.length" color="transparent" />
    <v-divider />

    <ul v-if="works.length" class="composer-works-list">
      <li v-for="w in works" :key="w.item_id" class="composer-work-row">
        <router-link
          :to="`/classical/works/${w.item_id}`"
          class="composer-work-link"
        >
          {{ w.name }}
        </router-link>
        <span v-if="w.catalog_number" class="meta"
          >· {{ w.catalog_number }}</span
        >
        <span v-if="w.work_type" class="meta">· {{ w.work_type }}</span>
        <span class="meta">
          ·
          {{ w.recording_count }}
          {{
            w.recording_count === 1
              ? $t("classical_recording")
              : $t("classical_recordings_lower")
          }}
        </span>
      </li>
    </ul>
    <p v-else class="composer-works-empty">
      {{ $t("classical_no_works_for_composer") }}
    </p>

    <OtherTracksSection
      :tracks="otherTracks"
      @play-track="onPlayOtherTrack"
      @menu-track="onMenuOtherTrack"
    />
  </section>
  <section v-else-if="!loading" class="composer-not-found">
    <p>{{ $t("classical_composer_not_found") }}</p>
    <router-link to="/classical/composers">
      {{ $t("classical_back_to_composers") }}
    </router-link>
  </section>
</template>

<script setup lang="ts">
import InfoHeader from "@/components/InfoHeader.vue";
import Toolbar from "@/components/Toolbar.vue";
import { type Artist } from "@/plugins/api/interfaces";
import {
  getComposer,
  getComposerWorks,
  getOtherTracksForArtist,
  getPerformers,
  makePerformerLookup,
  synthesiseArtist,
  type ClassicalComposer,
  type ClassicalOtherTrack,
  type ClassicalPerformer,
  type ClassicalWorkSummary,
} from "@/services/classical";
import OtherTracksSection from "@/views/classical/components/OtherTracksSection.vue";
import { openOtherTrackMenu } from "@/views/classical/menu";
import { computed, ref, watch } from "vue";
import { useRouter } from "vue-router";

defineOptions({ name: "ComposerDetail" });

const props = defineProps<{ id: string }>();

const router = useRouter();

const composer = ref<ClassicalComposer | undefined>();
const works = ref<ClassicalWorkSummary[]>([]);
const otherTracks = ref<ClassicalOtherTrack[]>([]);
const performers = ref<ClassicalPerformer[]>([]);
const loading = ref(true);

const performerLookup = computed(() => makePerformerLookup(performers.value));

const artistItem = computed<Artist | undefined>(() => {
  const c = composer.value;
  if (!c) return undefined;
  return synthesiseArtist({
    id: c.item_id,
    name: c.name,
    fanart_url: c.fanart_url,
    thumbnail_url: c.thumbnail_url,
    logo_url: c.logo_url,
    biography: c.biography,
  });
});

const load = async (id: string) => {
  loading.value = true;
  composer.value = await getComposer(id);
  const list = await getComposerWorks(id);
  // Sort by catalog number so Op./BWV/K. order is preserved; empty catalogs last.
  works.value = [...list].sort((a, b) => {
    const ac = a.catalog_number || "";
    const bc = b.catalog_number || "";
    if (!ac && !bc) return 0;
    if (!ac) return 1;
    if (!bc) return -1;
    return ac.localeCompare(bc, undefined, { numeric: true });
  });
  otherTracks.value = await getOtherTracksForArtist(id, "composer");
  if (performers.value.length === 0) {
    performers.value = await getPerformers();
  }
  loading.value = false;
};

watch(
  () => props.id,
  (id) => load(id),
  { immediate: true },
);

const onPlayOtherTrack = (_t: ClassicalOtherTrack) => {
  // TODO: play_media on the track URI once tracks are real records.
};

const onMenuOtherTrack = (t: ClassicalOtherTrack, evt: Event) => {
  openOtherTrackMenu(
    t,
    {
      router,
      composer: composer.value,
      performerLookup: performerLookup.value,
    },
    evt,
  );
};
</script>

<style scoped>
.composer-works-list {
  list-style: none;
  margin: 0;
  padding: 0 1rem;
  display: flex;
  flex-direction: column;
}

.composer-work-row {
  padding: 0.5rem 0;
  border-bottom: 1px solid var(--border, rgba(255, 255, 255, 0.06));
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 0.4rem;
}

.composer-work-row:last-child {
  border-bottom: 0;
}

.composer-work-link {
  font-weight: 600;
  color: inherit;
  text-decoration: none;
}

.composer-work-link:hover {
  text-decoration: underline;
}

.meta {
  color: var(--muted-foreground, #888);
  font-size: 0.875rem;
}

.composer-works-empty,
.composer-not-found {
  padding: 1rem;
}
</style>
