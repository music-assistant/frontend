<template>
  <section>
    <InfoHeader :item="itemDetails" :active-provider="provider" />

    <div v-if="loadingRows" class="rows-loading">
      <v-progress-linear color="accent" height="4" indeterminate rounded />
    </div>

    <div class="overview-container">
      <div v-for="row in displayRows" :key="row.title" class="overview-row">
        <WidgetRow
          :widget-row="row"
          :show-provider-on-cover="true"
          :show-action-icon="true"
        />
      </div>
    </div>

    <Container v-if="itemDetails && isAdmin" variant="default">
      <Toolbar
        :title="mappedAliasesTitle"
        :menu-items="aliasToolbarMenuItems"
        @title-clicked="toggleAliasSection"
      />
      <v-divider />
      <v-list v-if="aliasSectionExpanded">
        <ListItem v-for="alias in aliases" :key="alias.uri">
          <template #prepend>
            <Tags :size="20" />
          </template>
          <template #title>{{ formatAliasName(alias.name) }}</template>
          <template #subtitle>
            <span style="opacity: 0.6">{{ alias.uri }}</span>
          </template>
          <template #append>
            <v-btn
              v-if="canPromoteAlias(alias)"
              variant="text"
              :title="$t('promote_alias')"
              :disabled="aliasOperationInProgress"
              @click="confirmPromoteAlias(alias)"
            >
              <ArrowUpFromLine :size="20" />
            </v-btn>
            <v-btn
              v-if="canDeleteAlias(alias)"
              variant="text"
              :title="$t('delete_alias')"
              :disabled="aliasOperationInProgress"
              @click="confirmDeleteAlias(alias)"
            >
              <Trash2 :size="20" />
            </v-btn>
            <v-btn
              variant="text"
              :title="$t('unlink_alias')"
              :disabled="aliasOperationInProgress"
              :loading="aliasOperationInProgress"
              @click="unlinkAlias(alias)"
            >
              <Unlink :size="20" />
            </v-btn>
          </template>
        </ListItem>
      </v-list>
    </Container>

    <v-dialog v-model="showLinkDialog" max-width="520">
      <v-card>
        <Toolbar :title="$t('link_alias')" />
        <v-divider />
        <v-card-text>
          <v-autocomplete
            v-model="selectedAlias"
            v-model:search="aliasSearch"
            :items="availableAliases"
            :item-title="(alias: GenreAlias) => formatAliasName(alias.name)"
            return-object
            clearable
            hide-details
            :label="$t('link_alias')"
            :loading="aliasLoading"
          />
          <v-card-actions>
            <v-spacer />
            <v-btn variant="outlined" @click="showLinkDialog = false">
              {{ $t("cancel") }}
            </v-btn>
            <v-btn
              color="primary"
              variant="flat"
              :disabled="!selectedAlias || aliasOperationInProgress"
              :loading="aliasOperationInProgress"
              @click="linkAlias"
            >
              {{ $t("link_alias") }}
            </v-btn>
          </v-card-actions>
        </v-card-text>
      </v-card>
    </v-dialog>

    <v-dialog v-model="showCreateDialog" max-width="520">
      <v-card>
        <Toolbar :title="$t('add_alias')" />
        <v-divider />
        <v-card-text>
          <v-text-field
            v-model="newAliasName"
            hide-details
            variant="outlined"
            :label="$t('add_alias')"
          />
          <v-card-actions>
            <v-spacer />
            <v-btn variant="outlined" @click="showCreateDialog = false">
              {{ $t("cancel") }}
            </v-btn>
            <v-btn
              color="primary"
              variant="flat"
              :disabled="!newAliasName || aliasOperationInProgress"
              :loading="aliasOperationInProgress"
              @click="createAndLinkAlias"
            >
              {{ $t("add_alias") }}
            </v-btn>
          </v-card-actions>
        </v-card-text>
      </v-card>
    </v-dialog>

    <v-dialog v-model="showDeleteAliasDialog" max-width="520">
      <v-card>
        <Toolbar :title="$t('delete_alias')" />
        <v-divider />
        <v-card-text>
          <p>
            {{
              $t("confirm_delete_alias", [
                aliasToDelete?.name || "",
                (aliasToDelete?.genres || []).length,
              ])
            }}
          </p>
          <v-card-actions>
            <v-spacer />
            <v-btn variant="outlined" @click="showDeleteAliasDialog = false">
              {{ $t("cancel") }}
            </v-btn>
            <v-btn
              color="error"
              variant="flat"
              :disabled="aliasOperationInProgress"
              :loading="aliasOperationInProgress"
              @click="deleteAlias"
            >
              {{ $t("delete") }}
            </v-btn>
          </v-card-actions>
        </v-card-text>
      </v-card>
    </v-dialog>

    <v-dialog v-model="showPromoteAliasDialog" max-width="520">
      <v-card>
        <Toolbar :title="$t('promote_alias')" />
        <v-divider />
        <v-card-text>
          <p>{{ $t("confirm_promote_alias", [aliasToPromote?.name || ""]) }}</p>
          <v-card-actions>
            <v-spacer />
            <v-btn variant="outlined" @click="showPromoteAliasDialog = false">
              {{ $t("cancel") }}
            </v-btn>
            <v-btn
              color="primary"
              variant="flat"
              :disabled="aliasOperationInProgress"
              :loading="aliasOperationInProgress"
              @click="promoteAlias"
            >
              {{ $t("promote") }}
            </v-btn>
          </v-card-actions>
        </v-card-text>
      </v-card>
    </v-dialog>

    <v-dialog v-model="showAliasPopover" max-width="720">
      <v-card>
        <Toolbar :title="$t('aliases')" />
        <v-divider />
        <v-card-text>
          <div class="alias-popover-chips">
            <v-chip
              v-for="chip in linkedGenreChips"
              :key="chip.key"
              class="cursor-pointer"
              @click="handleAliasPopoverChipClick(chip)"
            >
              {{ formatAliasName(chip.label) }}
            </v-chip>
          </div>
          <v-card-actions>
            <v-spacer />
            <v-btn variant="outlined" @click="showAliasPopover = false">
              {{ $t("close") }}
            </v-btn>
          </v-card-actions>
        </v-card-text>
      </v-card>
    </v-dialog>
  </section>
</template>

<script setup lang="ts">
import Container from "@/components/Container.vue";
import InfoHeader from "@/components/InfoHeader.vue";
import ListItem from "@/components/ListItem.vue";
import Toolbar, { ToolBarMenuItem } from "@/components/Toolbar.vue";
import WidgetRow from "@/components/WidgetRow.vue";
import { handleMediaItemClick, getGenreDisplayName } from "@/helpers/utils";
import { api } from "@/plugins/api";
import {
  EventMessage,
  EventType,
  Genre,
  GenreAlias,
  MediaItemTypeOrItemMapping,
  MediaType,
  MediaItemType,
} from "@/plugins/api/interfaces";
import { authManager } from "@/plugins/auth";
import {
  computed,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
  type Component,
} from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import { useDisplay } from "vuetify";
import {
  Tag,
  Tags,
  Plus,
  Unlink,
  Link,
  Trash2,
  ArrowUpFromLine,
  ChevronUp,
  ChevronDown,
} from "lucide-vue-next";

// Constants
const SEARCH_THROTTLE_MS = 400;
const SEARCH_RESULT_LIMIT = 25;

export interface Props {
  itemId: string;
  provider: string;
}
const props = defineProps<Props>();
const itemDetails = ref<Genre>();
const loading = ref(false);
const loadingRows = ref(false);
const overviewRows = ref<
  Array<{
    title: string;
    items: MediaItemTypeOrItemMapping[];
    icon?: string | Component;
    action?: () => void;
  }>
>([]);

const aliasSearch = ref("");
const aliasLoading = ref(false);
const aliasOperationInProgress = ref(false);
const aliasOptions = ref<GenreAlias[]>([]);
const selectedAlias = ref<GenreAlias | null>(null);
const newAliasName = ref("");
const aliasSearchThrottle = ref<number | undefined>();
const aliasSectionExpanded = ref(false);
const showLinkDialog = ref(false);
const showCreateDialog = ref(false);
const showAliasPopover = ref(false);
const showDeleteAliasDialog = ref(false);
const aliasToDelete = ref<GenreAlias | null>(null);
const showPromoteAliasDialog = ref(false);
const aliasToPromote = ref<GenreAlias | null>(null);
const existingGenreNames = ref<Set<string>>(new Set());

const { t, te } = useI18n();
const router = useRouter();
const display = useDisplay();

const formatAliasName = (name: string) =>
  name ? name.replace(/(^|\s)\S/g, (match) => match.toUpperCase()) : "";

const isAdmin = computed(() => authManager.isAdmin());

// Self-alias check: alias name matches an existing genre name
const isSelfAlias = (alias: GenreAlias): boolean => {
  return existingGenreNames.value.has(alias.name.toLowerCase());
};

// Hide promote button if a genre with this alias name already exists
const canPromoteAlias = (alias: GenreAlias): boolean => {
  return !isSelfAlias(alias);
};

// Hide delete button for self-aliases (backend will reject deletion)
const canDeleteAlias = (alias: GenreAlias): boolean => {
  return !isSelfAlias(alias);
};

const aliases = computed(() => {
  if (!itemDetails.value) return [];
  const genreName = itemDetails.value.name?.toLowerCase();
  return (itemDetails.value.genre_aliases || [])
    .filter((alias) => alias.name.toLowerCase() !== genreName)
    .sort((a, b) => a.name.localeCompare(b.name));
});
const mappedAliasesTitle = computed(
  () => `${t("mapped_aliases")} (${aliases.value.length})`,
);
const linkedGenreChips = computed(() => {
  if (!itemDetails.value) return [];
  const chips = aliases.value.map((alias) => ({
    key: alias.item_id,
    aliasId: alias.item_id,
    label: alias.name,
  }));
  const seen = new Set<string>();
  return chips.filter((chip) => {
    if (!chip.key || seen.has(chip.key)) return false;
    seen.add(chip.key);
    return true;
  });
});
const maxAliasChips = computed(() => {
  if (display.xs.value) return 2;
  if (display.sm.value) return 3;
  if (display.md.value) return 4;
  if (display.lg.value) return 6;
  return 8;
});
const visibleLinkedGenreChips = computed(() =>
  linkedGenreChips.value.slice(0, maxAliasChips.value),
);
const aliasOverflowCount = computed(() =>
  Math.max(0, linkedGenreChips.value.length - maxAliasChips.value),
);
const availableAliases = computed(() => {
  const linkedIds = new Set(aliases.value.map((alias) => alias.item_id));
  return aliasOptions.value.filter((alias) => !linkedIds.has(alias.item_id));
});

const aliasToolbarMenuItems = computed<ToolBarMenuItem[]>(() => [
  {
    label: "link_alias",
    icon: Link,
    action: () => {
      showLinkDialog.value = true;
    },
  },
  {
    label: "add_alias",
    icon: Plus,
    action: () => {
      showCreateDialog.value = true;
    },
  },
  {
    label: "tooltip.collapse_expand",
    icon: aliasSectionExpanded.value ? ChevronUp : ChevronDown,
    action: toggleAliasSection,
    overflowAllowed: false,
  },
]);

const displayRows = computed(() =>
  overviewRows.value.filter((row) => row.items?.length),
);

const handleAliasPopoverChipClick = (chip: {
  key: string;
  aliasId: string;
  label: string;
}) => {
  openLinkedGenre(chip);
  showAliasPopover.value = false;
};

const loadItemDetails = async () => {
  loading.value = true;
  itemDetails.value = await api.getGenre(props.itemId, props.provider);
  // Fetch all genre names to prevent promoting aliases that already exist as genres
  const allGenres = await api.getLibraryGenres();
  existingGenreNames.value = new Set(
    allGenres.map((g) => g.name.toLowerCase()),
  );
  loading.value = false;
};

const loadOverviewRows = async () => {
  if (!itemDetails.value) return;
  loadingRows.value = true;

  try {
    // Get genre overview - returns RecommendationFolder[] from backend
    const recommendationFolders = await api.getGenreOverviewRows(
      itemDetails.value.item_id,
      itemDetails.value.provider,
    );

    // Convert RecommendationFolder[] to internal row format
    if (recommendationFolders && recommendationFolders.length > 0) {
      overviewRows.value = recommendationFolders.map((folder) => {
        return {
          title: getGenreDisplayName(
            folder.name || "",
            folder.translation_key,
            t,
            te,
          ),
          items: folder.items || [],
          icon: iconMap[folder.media_type],
          action: () => {
            if (!itemDetails.value) return;
            const routeName = folderIdToRoute[folder.item_id];
            if (routeName) {
              router.push({
                name: routeName,
                query: { genre_ids: itemDetails.value.item_id },
              });
            }
          },
        };
      });
    } else {
      overviewRows.value = [];
    }
  } catch (error) {
    console.error("Failed to load genre overview:", error);
    overviewRows.value = [];
  }

  // Fallback: if no overview rows returned, try loading radio base tracks
  if (overviewRows.value.length === 0) {
    try {
      const tracks = await api.getGenreRadioBaseTracks(
        itemDetails.value.item_id,
        itemDetails.value.provider,
      );
      overviewRows.value = [
        {
          title: t("tracks"),
          items: tracks,
          icon: iconMap[MediaType.TRACK],
        },
      ];
    } catch (error) {
      console.error("Failed to load genre radio base tracks:", error);
      overviewRows.value = [];
    }
  }

  loadingRows.value = false;
};

watch(
  () => props.itemId,
  (val) => {
    if (val) loadItemDetails();
  },
  { immediate: true },
);

watch(
  () => itemDetails.value?.uri,
  () => {
    loadOverviewRows();
  },
);

watch(
  () => aliasSearch.value,
  () => {
    if (!isAdmin.value) return;
    clearTimeout(aliasSearchThrottle.value);
    aliasSearchThrottle.value = window.setTimeout(async () => {
      if (!aliasSearch.value) {
        aliasOptions.value = [];
        return;
      }
      aliasLoading.value = true;
      try {
        aliasOptions.value = await api.getLibraryAliases(
          undefined,
          aliasSearch.value,
          SEARCH_RESULT_LIMIT,
          0,
          "name",
        );
      } finally {
        aliasLoading.value = false;
      }
    }, SEARCH_THROTTLE_MS);
  },
);

onMounted(() => {
  const unsub = api.subscribe(
    EventType.MEDIA_ITEM_UPDATED,
    (evt: EventMessage) => {
      const updatedItem = evt.data as MediaItemType;
      if (itemDetails.value?.uri == updatedItem.uri) {
        itemDetails.value = updatedItem as Genre;
      }
    },
  );
  onBeforeUnmount(() => {
    // Clean up API subscription
    unsub();
    // Clean up search throttle timer to prevent memory leaks
    clearTimeout(aliasSearchThrottle.value);
  });
});

const linkAlias = async () => {
  if (
    !itemDetails.value ||
    !selectedAlias.value ||
    aliasOperationInProgress.value
  )
    return;

  aliasOperationInProgress.value = true;
  try {
    await api.addAliasToGenre(
      itemDetails.value.item_id,
      selectedAlias.value.item_id,
    );
    selectedAlias.value = null;
    aliasSearch.value = "";
    showLinkDialog.value = false;
    await loadItemDetails();
  } catch (error) {
    console.error("Failed to link alias:", error);
    // TODO: Show error notification to user
  } finally {
    aliasOperationInProgress.value = false;
  }
};

const createAndLinkAlias = async () => {
  if (
    !itemDetails.value ||
    !newAliasName.value ||
    aliasOperationInProgress.value
  )
    return;

  aliasOperationInProgress.value = true;
  try {
    const created = await api.addAliasToLibrary(
      {
        item_id: "0",
        provider: "library",
        name: newAliasName.value,
        sort_name: newAliasName.value,
        provider_mappings: [],
        favorite: false,
      } as any,
      true,
    );
    await api.addAliasToGenre(itemDetails.value.item_id, created.item_id);
    newAliasName.value = "";
    showCreateDialog.value = false;
    await loadItemDetails();
  } catch (error) {
    console.error("Failed to create and link alias:", error);
    // TODO: Show error notification to user
  } finally {
    aliasOperationInProgress.value = false;
  }
};

const unlinkAlias = async (alias: GenreAlias) => {
  if (!itemDetails.value || !isAdmin.value || aliasOperationInProgress.value)
    return;

  aliasOperationInProgress.value = true;
  try {
    await api.removeAliasFromGenre(itemDetails.value.item_id, alias.item_id);
    await loadItemDetails();
  } catch (error) {
    console.error("Failed to unlink alias:", error);
  } finally {
    aliasOperationInProgress.value = false;
  }
};

const confirmDeleteAlias = (alias: GenreAlias) => {
  aliasToDelete.value = alias;
  showDeleteAliasDialog.value = true;
};

const deleteAlias = async () => {
  if (!aliasToDelete.value || aliasOperationInProgress.value) return;

  aliasOperationInProgress.value = true;
  try {
    await api.removeAliasFromLibrary(aliasToDelete.value.item_id);
    showDeleteAliasDialog.value = false;
    aliasToDelete.value = null;
    await loadItemDetails();
  } catch (error) {
    console.error("Failed to delete alias:", error);
  } finally {
    aliasOperationInProgress.value = false;
  }
};

const confirmPromoteAlias = (alias: GenreAlias) => {
  aliasToPromote.value = alias;
  showPromoteAliasDialog.value = true;
};

const promoteAlias = async () => {
  if (!aliasToPromote.value || aliasOperationInProgress.value) return;

  aliasOperationInProgress.value = true;
  try {
    const newGenre = await api.promoteAliasToGenre(
      aliasToPromote.value.item_id,
    );
    showPromoteAliasDialog.value = false;
    aliasToPromote.value = null;
    router.push({
      name: "genre",
      params: {
        itemId: newGenre.item_id,
        provider: newGenre.provider,
      },
    });
  } catch (error) {
    console.error("Failed to promote alias:", error);
  } finally {
    aliasOperationInProgress.value = false;
  }
};

const openLinkedGenre = async function (chip: {
  aliasId: string;
  label: string;
}) {
  if (!chip.label) return;
  const matches = await api.getLibraryGenres(
    undefined,
    chip.label,
    SEARCH_RESULT_LIMIT,
    0,
    "name",
    "library",
    undefined,
  );
  const target = matches.find(
    (genre) =>
      genre.name.toLowerCase() === chip.label.toLowerCase() &&
      genre.uri !== itemDetails.value?.uri,
  );
  if (target) {
    handleMediaItemClick(target, 0, 0);
  }
};

const toggleAliasSection = function () {
  aliasSectionExpanded.value = !aliasSectionExpanded.value;
};

// Icon mapping for different media types
const iconMap: Record<MediaType, string | Component> = {
  [MediaType.TRACK]: "mdi-music-note",
  [MediaType.ALBUM]: "mdi-album",
  [MediaType.ARTIST]: "mdi-account-music",
  [MediaType.PLAYLIST]: "mdi-playlist-music",
  [MediaType.RADIO]: "mdi-radio",
  [MediaType.AUDIOBOOK]: "mdi-book-music",
  [MediaType.PODCAST]: "mdi-podcast",
  [MediaType.GENRE]: Tag,
  [MediaType.GENRE_ALIAS]: Tags,
  [MediaType.PODCAST_EPISODE]: "mdi-podcast",
  [MediaType.FOLDER]: "mdi-folder",
  [MediaType.UNKNOWN]: "mdi-help-circle-outline",
};

// Map recommendation folder item_ids to library route names
const folderIdToRoute: Record<string, string> = {
  genre_artist: "artists",
  genre_album: "albums",
  genre_track: "tracks",
  genre_playlist: "playlists",
  genre_radio: "radios",
};
</script>

<style scoped>
.alias-header {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.alias-chips {
  display: flex;
  flex-wrap: nowrap;
  gap: 8px;
  overflow: hidden;
  align-items: center;
}

.alias-chip {
  flex: 0 0 auto;
  white-space: nowrap;
}

.alias-overflow {
  cursor: default;
}

.alias-popover-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.rows-loading {
  margin: 20px 0;
}

.overview-row {
  margin-top: 10px;
}

.overview-container {
  padding: 0 16px 16px 16px;
}
</style>
