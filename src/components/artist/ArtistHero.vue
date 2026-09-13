<template>
  <DetailHero
    class="artist-hero"
    :class="{ 'artist-hero--phone': isPhone }"
    :item="item"
    :backdrop="backdrop"
    :height="440"
    :phone-height="340"
    @edit-rows="emit('edit-rows')"
  >
    <template #toolbar-append>
      <button
        v-if="item && canEditLibrary"
        type="button"
        class="artist-hero__fav"
        :class="{ 'artist-hero__fav--on': item.favorite }"
        :aria-label="favoriteButtonLabel"
        :aria-pressed="item.favorite ? 'true' : 'false'"
        :title="favoriteButtonLabel"
        @click="api.toggleFavorite(item)"
      >
        <IconHeartFilled v-if="item.favorite" :size="20" />
        <IconHeart v-else :stroke-width="2" :size="20" />
      </button>
    </template>

    <template v-if="item" #main>
      <img
        v-if="artistLogo"
        class="artist-hero__logo"
        :src="artistLogo"
        alt=""
      />
      <h1 :class="artistLogo ? 'sr-only' : 'artist-hero__name'">
        {{ item.name }}
      </h1>

      <div class="artist-hero__actions">
        <DetailHeroPlayButton :item="item" />
        <DetailHeroButton
          v-if="api.supportsPlayMediaShuffle"
          :icon="Shuffle"
          :label="$t('shuffle')"
          :icon-only="isPhone"
          :disabled="!store.activePlayer"
          @click="api.playMedia(item, undefined, { shuffle: true })"
        />
        <DetailHeroButton
          v-if="radioRelevant(item)"
          :icon="Radio"
          :label="$t('artist_radio')"
          :icon-only="isPhone"
          :disabled="!radioSupported(item)"
          @click="gotoRadio(item)"
        />
      </div>
    </template>

    <template v-if="item" #aside>
      <div v-if="chipsShown" class="artist-hero__chips">
        <span class="artist-hero__chip">
          <template v-for="(provider, index) in providers" :key="provider.id">
            <span v-if="index > 0" class="artist-hero__chip-sep">·</span>
            <ProviderIcon :domain="provider.domain" :size="14" />
            {{ provider.name }}
          </template>
        </span>
      </div>
      <DetailHeroGenres :item="item" />
      <div v-if="artistKind" class="artist-hero__kind">{{ artistKind }}</div>
    </template>
  </DetailHero>
</template>

<script setup lang="ts">
import DetailHero from "@/components/details/DetailHero.vue";
import DetailHeroButton from "@/components/details/DetailHeroButton.vue";
import DetailHeroGenres from "@/components/details/DetailHeroGenres.vue";
import DetailHeroPlayButton from "@/components/details/DetailHeroPlayButton.vue";
import ProviderIcon from "@/components/ProviderIcon.vue";
import { gotoRadio, radioRelevant, radioSupported } from "@/helpers/radio";
import { getImageThumbForItem } from "@/helpers/utils";
import { api } from "@/plugins/api";
import {
  ArtistType,
  ImageType,
  Scope,
  type Artist,
} from "@/plugins/api/interfaces";
import { authManager } from "@/plugins/auth";
import { isPhoneSizedScreen } from "@/plugins/breakpoint";
import { $t } from "@/plugins/i18n";
import { store } from "@/plugins/store";
import { Radio, Shuffle } from "@lucide/vue";
import { IconHeart, IconHeartFilled } from "@tabler/icons-vue";
import { computed } from "vue";

export interface Props {
  item?: Artist;
}
const props = defineProps<Props>();

const emit = defineEmits<{
  (e: "edit-rows"): void;
}>();

const isPhone = computed(() => isPhoneSizedScreen());

// wide art (fanart, then landscape) suits the hero; a square thumb is the
// last resort. No size is passed, so the server serves the original image.
const backdrop = computed(() => {
  if (!props.item) return undefined;
  return (
    getImageThumbForItem(props.item, ImageType.FANART) ||
    getImageThumbForItem(props.item, ImageType.LANDSCAPE) ||
    getImageThumbForItem(props.item, ImageType.THUMB)
  );
});

const artistLogo = computed(() =>
  props.item ? getImageThumbForItem(props.item, ImageType.LOGO) : undefined,
);

// one entry per provider instance the artist is mapped to
const providers = computed(() => {
  const seen = new Set<string>();
  const entries: Array<{ id: string; domain: string; name: string }> = [];
  for (const mapping of props.item?.provider_mappings || []) {
    if (seen.has(mapping.provider_instance)) continue;
    seen.add(mapping.provider_instance);
    entries.push({
      id: mapping.provider_instance,
      domain: mapping.provider_domain,
      name:
        api.getProvider(mapping.provider_instance)?.name ||
        api.getProviderManifest(mapping.provider_domain)?.name ||
        mapping.provider_instance,
    });
  }
  return entries;
});

const chipsShown = computed(() => providers.value.length > 0);

// what kind of artist this is: the MusicBrainz entity type when known, else
// the role of an audiobook artist
const artistKind = computed(() => {
  const item = props.item;
  if (!item) return "";
  const entityType = item.metadata?.artist_entity_type;
  if (entityType) return $t(`artist_entity_type.${entityType.toLowerCase()}`);
  if (item.artist_type === ArtistType.AUTHOR) return $t("author");
  if (item.artist_type === ArtistType.NARRATOR) return $t("narrator");
  return "";
});

const favoriteButtonLabel = computed(() =>
  props.item?.favorite ? $t("favorites_remove") : $t("favorites_add"),
);
// favouring an item changes the library
const canEditLibrary = computed(() =>
  authManager.hasScope(Scope.LIBRARY_WRITE),
);
</script>

<style scoped>
.artist-hero__fav {
  margin-right: 8px;
  align-items: center;
  background: rgba(0, 0, 0, 0.35);
  border: 0;
  border-radius: 8px;
  color: currentColor;
  cursor: pointer;
  display: inline-flex;
  height: 40px;
  justify-content: center;
  padding: 0;
  width: 40px;
}
.artist-hero__fav--on {
  color: rgb(var(--v-theme-primary));
}
.artist-hero__fav:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: 2px;
}

.artist-hero__chips {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 8px;
}
.artist-hero__chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 22px;
  padding: 0 8px;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.45);
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
}
.artist-hero__chip-sep {
  opacity: 0.4;
}
.artist-hero__logo {
  height: 80px;
  width: auto;
  max-width: 100%;
  object-fit: contain;
  object-position: left;
}
.artist-hero__name {
  margin: 0;
  font-size: 48px;
  font-weight: 500;
  letter-spacing: -1.2px;
  line-height: 1.05;
  text-shadow: 0 2px 12px rgba(0, 0, 0, 0.5);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
.artist-hero__kind {
  font-size: 13px;
  color: rgba(255, 255, 255, 0.7);
  text-shadow: 0 1px 6px rgba(0, 0, 0, 0.5);
}

.artist-hero__actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.artist-hero--phone .artist-hero__chips {
  justify-content: flex-start;
}
.artist-hero--phone .artist-hero__name {
  font-size: 34px;
  letter-spacing: -0.8px;
}
.artist-hero--phone .artist-hero__logo {
  height: 56px;
}
.artist-hero--phone .artist-hero__actions {
  gap: 10px;
}
</style>
