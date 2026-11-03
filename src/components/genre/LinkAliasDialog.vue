<template>
  <Dialog v-model:open="model">
    <DialogContent
      class="sm:max-w-[520px]"
      @pointer-down-outside="(e: Event) => e.preventDefault()"
      @interact-outside="(e: Event) => e.preventDefault()"
    >
      <DialogHeader>
        <DialogTitle>{{ $t("link_alias") }}</DialogTitle>
      </DialogHeader>
      <Combobox
        v-model="selectedAlias"
        open-on-click
        ignore-filter
        reset-model-value-on-clear
      >
        <ComboboxAnchor>
          <ComboboxInput
            v-model="aliasSearch"
            :display-value="displayAlias"
            :placeholder="$t('link_alias')"
            :aria-label="$t('link_alias')"
          />
          <Spinner v-if="aliasLoading" />
          <ComboboxCancel
            v-if="selectedAlias || aliasSearch"
            :aria-label="$t('clear')"
            @click="aliasSearch = ''"
          />
          <ComboboxTrigger :aria-label="$t('tooltip.open_options')" />
        </ComboboxAnchor>
        <ComboboxList>
          <ComboboxEmpty>{{ emptyText }}</ComboboxEmpty>
          <ComboboxItem
            v-for="alias in availableAliases"
            :key="alias"
            :value="alias"
            :text-value="formatAliasName(alias)"
          >
            {{ formatAliasName(alias) }}
            <ComboboxItemIndicator />
          </ComboboxItem>
        </ComboboxList>
      </Combobox>
      <DialogFooter>
        <Button variant="outline" @click="model = false">
          {{ $t("cancel") }}
        </Button>
        <Button :disabled="!selectedAlias || loading" @click="linkAlias">
          {{ $t("link_alias") }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { Button } from "@/components/ui/button";
import {
  Combobox,
  ComboboxAnchor,
  ComboboxCancel,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxItemIndicator,
  ComboboxList,
  ComboboxTrigger,
} from "@/components/ui/combobox";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { rankedAliases } from "@/helpers/genre";
import { formatAliasName } from "@/helpers/utils";
import { api } from "@/plugins/api";
import { SortField } from "@/plugins/api/interfaces";
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { toast } from "vue-sonner";

const SEARCH_THROTTLE_MS = 400;
const SEARCH_RESULT_LIMIT = 25;

interface Props {
  genreItemId: string;
  currentAliases: string[];
}

const props = defineProps<Props>();
const model = defineModel<boolean>();
const emit = defineEmits<{ linked: [] }>();

const { t } = useI18n();
const aliasSearch = ref("");
const aliasLoading = ref(false);
const loading = ref(false);
const aliasOptions = ref<string[]>([]);
const selectedAlias = ref<string | null>(null);
const searchThrottle = ref<number | undefined>();

const displayAlias = (alias: string | null) =>
  alias ? formatAliasName(alias) : "";

const availableAliases = computed(() => {
  const current = new Set(props.currentAliases.map((a) => a.toLowerCase()));
  return aliasOptions.value.filter((a) => !current.has(a.toLowerCase()));
});

const emptyText = computed(() => {
  if (!aliasSearch.value) return t("link_alias_search_hint");
  if (aliasLoading.value) return t("searching");
  return t("no_content");
});

watch(
  () => aliasSearch.value,
  (search) => {
    clearTimeout(searchThrottle.value);
    if (!search) {
      aliasOptions.value = [];
      aliasLoading.value = false;
      selectedAlias.value = null;
      return;
    }
    aliasLoading.value = true;
    searchThrottle.value = window.setTimeout(async () => {
      try {
        const genres = await api.getLibraryGenres({
          search,
          limit: SEARCH_RESULT_LIMIT,
          offset: 0,
          sort_field: SortField.NAME,
          summary: false,
        });
        if (search !== aliasSearch.value) return;
        aliasOptions.value = rankedAliases(genres, search);
      } finally {
        if (search === aliasSearch.value) aliasLoading.value = false;
      }
    }, SEARCH_THROTTLE_MS);
  },
);

onBeforeUnmount(() => {
  clearTimeout(searchThrottle.value);
});

const linkAlias = async () => {
  if (!selectedAlias.value || loading.value) return;

  loading.value = true;
  try {
    await api.addGenreAlias(props.genreItemId, selectedAlias.value);
    toast.success(t("alias_linked_successfully"));
    selectedAlias.value = null;
    aliasSearch.value = "";
    model.value = false;
    emit("linked");
  } catch (error) {
    toast.error(t("link_alias_failed"));
  } finally {
    loading.value = false;
  }
};
</script>
