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
      <div class="relative">
        <Command v-model:search-term="aliasSearch" class="border rounded-lg">
          <CommandInput
            :placeholder="$t('link_alias')"
          />
          <CommandList>
            <CommandEmpty v-if="!aliasLoading">
              {{ aliasSearch ? $t("no_content") : $t("link_alias") }}
            </CommandEmpty>
            <CommandEmpty v-else>
              <Spinner class="mx-auto size-5" />
            </CommandEmpty>
            <CommandItem
              v-for="alias in availableAliases"
              :key="alias"
              :value="alias"
              @select="selectedAlias = alias"
            >
              {{ formatAliasName(alias) }}
            </CommandItem>
          </CommandList>
        </Command>
        <div v-if="selectedAlias" class="mt-2">
          <Badge variant="secondary" class="text-sm">
            {{ formatAliasName(selectedAlias) }}
            <button class="ml-1 hover:text-foreground" @click="selectedAlias = null">
              <X class="size-3" />
            </button>
          </Badge>
        </div>
      </div>
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { formatAliasName } from "@/helpers/utils";
import { api } from "@/plugins/api";
import { X } from "lucide-vue-next";
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

const availableAliases = computed(() => {
  const current = new Set(props.currentAliases.map((a) => a.toLowerCase()));
  return aliasOptions.value.filter((a) => !current.has(a.toLowerCase()));
});

watch(
  () => aliasSearch.value,
  () => {
    clearTimeout(searchThrottle.value);
    searchThrottle.value = window.setTimeout(async () => {
      if (!aliasSearch.value) {
        aliasOptions.value = [];
        return;
      }
      aliasLoading.value = true;
      try {
        const genres = await api.getLibraryGenres({
          search: aliasSearch.value,
          limit: SEARCH_RESULT_LIMIT,
          offset: 0,
          order_by: "name",
        });
        const allAliases = new Set<string>();
        for (const genre of genres) {
          for (const alias of genre.genre_aliases || []) {
            allAliases.add(alias);
          }
        }
        aliasOptions.value = [...allAliases].sort((a, b) => a.localeCompare(b));
      } finally {
        aliasLoading.value = false;
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
