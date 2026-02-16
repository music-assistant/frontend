<template>
  <Container variant="default">
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
          <Button
            v-if="canPromoteAlias(alias)"
            variant="ghost"
            size="icon-sm"
            :title="$t('promote_alias')"
            :disabled="unlinkInProgress"
            @click="confirmPromoteAlias(alias)"
          >
            <ArrowUpFromLine :size="20" />
          </Button>
          <Button
            v-if="canDeleteAlias(alias)"
            variant="ghost"
            size="icon-sm"
            :title="$t('delete_alias')"
            :disabled="unlinkInProgress"
            @click="confirmDeleteAlias(alias)"
          >
            <Trash2 :size="20" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            :title="$t('unlink_alias')"
            :disabled="unlinkInProgress"
            @click="unlinkAlias(alias)"
          >
            <Unlink :size="20" />
          </Button>
        </template>
      </ListItem>
    </v-list>
  </Container>

  <LinkAliasDialog
    v-model="showLinkDialog"
    :genre-item-id="genre.item_id"
    :linked-alias-ids="linkedAliasIds"
    @linked="emit('reload')"
  />

  <CreateAliasDialog
    v-model="showCreateDialog"
    :genre-item-id="genre.item_id"
    @created="emit('reload')"
  />

  <DeleteAliasDialog
    v-model="showDeleteDialog"
    :alias="aliasToDelete"
    @deleted="emit('reload')"
  />

  <PromoteAliasDialog v-model="showPromoteDialog" :alias="aliasToPromote" />

  <AliasPopoverDialog
    v-model="showPopover"
    :chips="linkedGenreChips"
    :genre-uri="genre.uri"
  />
</template>

<script setup lang="ts">
import Container from "@/components/Container.vue";
import AliasPopoverDialog from "@/components/genre/AliasPopoverDialog.vue";
import CreateAliasDialog from "@/components/genre/CreateAliasDialog.vue";
import DeleteAliasDialog from "@/components/genre/DeleteAliasDialog.vue";
import LinkAliasDialog from "@/components/genre/LinkAliasDialog.vue";
import PromoteAliasDialog from "@/components/genre/PromoteAliasDialog.vue";
import ListItem from "@/components/ListItem.vue";
import Toolbar, { ToolBarMenuItem } from "@/components/Toolbar.vue";
import { Button } from "@/components/ui/button";
import { formatAliasName } from "@/helpers/utils";
import { api } from "@/plugins/api";
import { Genre, GenreAlias } from "@/plugins/api/interfaces";
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { toast } from "vue-sonner";
import {
  Tags,
  Plus,
  Unlink,
  Link,
  Trash2,
  ArrowUpFromLine,
  ChevronUp,
  ChevronDown,
} from "lucide-vue-next";

interface Props {
  genre: Genre;
  existingGenreNames: Set<string>;
}

const props = defineProps<Props>();
const emit = defineEmits<{ reload: [] }>();

const { t } = useI18n();

const aliasSectionExpanded = ref(false);
const unlinkInProgress = ref(false);
const showLinkDialog = ref(false);
const showCreateDialog = ref(false);
const showDeleteDialog = ref(false);
const showPromoteDialog = ref(false);
const showPopover = ref(false);
const aliasToDelete = ref<GenreAlias | null>(null);
const aliasToPromote = ref<GenreAlias | null>(null);

const isSelfAlias = (alias: GenreAlias): boolean => {
  return props.existingGenreNames.has(alias.name.toLowerCase());
};

const canPromoteAlias = (alias: GenreAlias): boolean => !isSelfAlias(alias);
const canDeleteAlias = (alias: GenreAlias): boolean => !isSelfAlias(alias);

const aliases = computed(() => {
  const genreName = props.genre.name?.toLowerCase();
  return (props.genre.genre_aliases || [])
    .filter((alias) => alias.name.toLowerCase() !== genreName)
    .sort((a, b) => a.name.localeCompare(b.name));
});

const linkedAliasIds = computed(() =>
  aliases.value.map((alias) => alias.item_id),
);

const mappedAliasesTitle = computed(
  () => `${t("mapped_aliases")} (${aliases.value.length})`,
);

const linkedGenreChips = computed(() => {
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

const confirmDeleteAlias = (alias: GenreAlias) => {
  aliasToDelete.value = alias;
  showDeleteDialog.value = true;
};

const confirmPromoteAlias = (alias: GenreAlias) => {
  aliasToPromote.value = alias;
  showPromoteDialog.value = true;
};

const unlinkAlias = async (alias: GenreAlias) => {
  if (unlinkInProgress.value) return;

  unlinkInProgress.value = true;
  try {
    await api.removeAliasFromGenre(props.genre.item_id, alias.item_id);
    emit("reload");
  } catch (error) {
    toast.error(t("unlink_alias_failed"));
  } finally {
    unlinkInProgress.value = false;
  }
};

const toggleAliasSection = () => {
  aliasSectionExpanded.value = !aliasSectionExpanded.value;
};
</script>
