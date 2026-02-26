<template>
  <Dialog v-model:open="open">
    <DialogContent class="sm:max-w-[520px]">
      <DialogHeader>
        <DialogTitle>{{ $t("link_to_genre_title") }}</DialogTitle>
      </DialogHeader>
      <div class="space-y-4">
        <p class="text-sm text-muted-foreground">
          {{ $t("link_to_genre_description") }}
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
                    v-for="genre in allGenres"
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
        <Button :disabled="!selectedTargetId || loading" @click="handleLink">
          {{ $t("link_to_genre") }}
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
import type { Genre, MediaItemType } from "@/plugins/api/interfaces";
import { eventbus, type LinkGenreDialogEvent } from "@/plugins/eventbus";
import { store } from "@/plugins/store";
import { Check, ChevronsUpDown } from "lucide-vue-next";
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useI18n } from "vue-i18n";
import { toast } from "vue-sonner";

const { t, te } = useI18n();

const open = ref(false);
const popoverOpen = ref(false);
const loading = ref(false);
const items = ref<MediaItemType[]>([]);
const allGenres = ref<Genre[]>([]);
const selectedTargetId = ref<string | null>(null);

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

const handleLink = async () => {
  if (!selectedTargetId.value || loading.value) return;
  loading.value = true;
  try {
    for (const item of items.value) {
      await api.addGenreMediaMapping(
        selectedTargetId.value,
        item.media_type,
        item.item_id,
      );
    }
    open.value = false;
    toast.success(t("link_to_genre_success"));
  } catch {
    toast.error(t("link_to_genre_failed"));
  } finally {
    loading.value = false;
  }
};

const reset = () => {
  items.value = [];
  allGenres.value = [];
  selectedTargetId.value = null;
  loading.value = false;
  popoverOpen.value = false;
};

watch(open, (v) => {
  store.dialogActive = v;
});

onMounted(() => {
  eventbus.on("linkGenreDialog", async (evt: LinkGenreDialogEvent) => {
    reset();
    items.value = evt.items;
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
  eventbus.off("linkGenreDialog");
});
</script>
