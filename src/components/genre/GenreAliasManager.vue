<template>
  <Container variant="default">
    <Toolbar
      :title="mappedAliasesTitle"
      :menu-items="aliasToolbarMenuItems"
      @title-clicked="toggleAliasSection"
    />
    <v-divider />
    <v-list v-if="aliasSectionExpanded">
      <ListItem v-for="alias in aliases" :key="alias">
        <template #prepend>
          <Route :size="20" />
        </template>
        <template #title>{{ formatAliasName(alias) }}</template>
        <template #append>
          <Button
            v-if="canPromoteAlias(alias)"
            variant="ghost"
            size="icon-sm"
            :title="$t('promote_alias')"
            :disabled="operationInProgress"
            @click="confirmPromoteAlias(alias)"
          >
            <ArrowUpFromLine :size="20" />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            :title="$t('remove_alias')"
            :disabled="operationInProgress"
            @click="confirmRemoveAlias(alias)"
          >
            <Trash2 :size="20" />
          </Button>
        </template>
      </ListItem>
    </v-list>
  </Container>

  <LinkAliasDialog
    v-model="showLinkDialog"
    :genre-item-id="genre.item_id"
    :current-aliases="genre.genre_aliases || []"
    @linked="emit('reload')"
  />

  <CreateAliasDialog
    v-model="showCreateDialog"
    :genre-item-id="genre.item_id"
    @created="emit('reload')"
  />

  <RemoveAliasDialog
    v-model="showRemoveDialog"
    :alias="aliasToRemove"
    :genre-item-id="genre.item_id"
    @removed="emit('reload')"
  />

  <PromoteAliasDialog
    v-model="showPromoteDialog"
    :alias="aliasToPromote"
    :genre-item-id="genre.item_id"
  />
</template>

<script setup lang="ts">
import Container from "@/components/Container.vue";
import CreateAliasDialog from "@/components/genre/CreateAliasDialog.vue";
import LinkAliasDialog from "@/components/genre/LinkAliasDialog.vue";
import RemoveAliasDialog from "@/components/genre/RemoveAliasDialog.vue";
import PromoteAliasDialog from "@/components/genre/PromoteAliasDialog.vue";
import ListItem from "@/components/ListItem.vue";
import Toolbar, { ToolBarMenuItem } from "@/components/Toolbar.vue";
import { Button } from "@/components/ui/button";
import { formatAliasName } from "@/helpers/utils";
import { Genre } from "@/plugins/api/interfaces";
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import {
  Route,
  Plus,
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
const operationInProgress = ref(false);
const showLinkDialog = ref(false);
const showCreateDialog = ref(false);
const showRemoveDialog = ref(false);
const showPromoteDialog = ref(false);
const aliasToRemove = ref<string | null>(null);
const aliasToPromote = ref<string | null>(null);

const canPromoteAlias = (alias: string): boolean => {
  return !props.existingGenreNames.has(alias.toLowerCase());
};

const aliases = computed(() => {
  const genreName = props.genre.name?.toLowerCase();
  return (props.genre.genre_aliases || [])
    .filter((alias) => alias.toLowerCase() !== genreName)
    .sort((a, b) => a.localeCompare(b));
});

const mappedAliasesTitle = computed(
  () => `${t("mapped_aliases")} (${aliases.value.length})`,
);

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

const confirmRemoveAlias = (alias: string) => {
  aliasToRemove.value = alias;
  showRemoveDialog.value = true;
};

const confirmPromoteAlias = (alias: string) => {
  aliasToPromote.value = alias;
  showPromoteDialog.value = true;
};

const toggleAliasSection = () => {
  aliasSectionExpanded.value = !aliasSectionExpanded.value;
};
</script>
