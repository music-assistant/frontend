<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-[520px]">
      <DialogHeader>
        <DialogTitle>{{ $t("merge_genres") }}</DialogTitle>
      </DialogHeader>
      <div class="space-y-4">
        <p class="text-sm text-muted-foreground">
          {{ $t("merge_genres_description") }}
        </p>
        <p class="text-sm font-medium text-destructive">
          {{ $t("merge_genres_warning", [genreNames.join(", ")]) }}
        </p>
        <Popover v-model:open="popoverOpen">
          <PopoverTrigger as-child>
            <Button
              variant="outline"
              role="combobox"
              :aria-expanded="popoverOpen"
              class="w-full justify-between"
            >
              {{ selectedGenreName || t("select_target_genre") }}
              <ChevronsUpDown class="ml-2 h-4 w-4 shrink-0 opacity-50" />
            </Button>
          </PopoverTrigger>
          <PopoverContent class="w-[--reka-popover-trigger-width] p-0">
            <Command>
              <CommandInput :placeholder="t('search')" />
              <CommandList class="max-h-[250px] overflow-y-auto">
                <CommandEmpty>{{ t("no_content") }}</CommandEmpty>
                <CommandGroup>
                  <CommandItem
                    v-for="genre in availableGenres"
                    :key="genre.item_id"
                    :value="genre.item_id"
                    @select="selectGenre(genre)"
                  >
                    {{
                      getGenreDisplayName(
                        genre.name,
                        genre.translation_key,
                        t,
                        te,
                      )
                    }}
                    <Check
                      v-if="selectedTargetId === genre.item_id"
                      class="ml-auto h-4 w-4"
                    />
                  </CommandItem>
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>
      <DialogFooter>
        <Button variant="outline" @click="open = false">
          {{ $t("cancel") }}
        </Button>
        <Button
          variant="destructive"
          :disabled="!selectedTargetId || loading"
          @click="handleMerge"
        >
          {{ $t("merge_genres") }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { getGenreDisplayName } from "@/helpers/utils";
import { api } from "@/plugins/api";
import type { Genre } from "@/plugins/api/interfaces";
import { eventbus, type MergeGenreDialogEvent } from "@/plugins/eventbus";
import { store } from "@/plugins/store";
import { Check, ChevronsUpDown } from "lucide-vue-next";
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import { toast } from "vue-sonner";

const { t, te } = useI18n();
const router = useRouter();

const open = ref(false);
const popoverOpen = ref(false);
const loading = ref(false);
const genreIds = ref<string[]>([]);
const genreNames = ref<string[]>([]);
const allGenres = ref<Genre[]>([]);
const selectedTargetId = ref<string | null>(null);

const availableGenres = computed(() =>
  allGenres.value.filter((g) => !genreIds.value.includes(g.item_id)),
);

const selectedGenreName = computed(() => {
  if (!selectedTargetId.value) return "";
  const genre = allGenres.value.find(
    (g) => g.item_id === selectedTargetId.value,
  );
  if (!genre) return "";
  return getGenreDisplayName(genre.name, genre.translation_key, t, te);
});

const selectGenre = (genre: Genre) => {
  selectedTargetId.value = genre.item_id;
  popoverOpen.value = false;
};

const handleMerge = async () => {
  if (!selectedTargetId.value || loading.value) return;
  loading.value = true;
  try {
    const mergedGenre = await api.mergeGenres(
      genreIds.value,
      selectedTargetId.value,
    );
    open.value = false;
    toast.success(t("merge_genres_success"));
    router.push({
      name: "genre",
      params: {
        itemId: mergedGenre.item_id,
        provider: mergedGenre.provider,
      },
    });
  } catch {
    toast.error(t("merge_genres_failed"));
  } finally {
    loading.value = false;
  }
};

const reset = () => {
  genreIds.value = [];
  genreNames.value = [];
  allGenres.value = [];
  selectedTargetId.value = null;
  loading.value = false;
  popoverOpen.value = false;
};

watch(open, (v) => {
  store.dialogActive = v;
});

onMounted(() => {
  eventbus.on("mergeGenreDialog", async (evt: MergeGenreDialogEvent) => {
    reset();
    genreIds.value = evt.genreIds;
    genreNames.value = evt.genreNames;
    allGenres.value = await api.getLibraryGenres(
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      undefined,
      false,
    );
    open.value = true;
  });
});

onBeforeUnmount(() => {
  eventbus.off("mergeGenreDialog");
});
</script>
