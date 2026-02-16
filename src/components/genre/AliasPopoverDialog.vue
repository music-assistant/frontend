<template>
  <Dialog v-model:open="model">
    <DialogContent class="sm:max-w-[720px]">
      <DialogHeader>
        <DialogTitle>{{ $t("aliases") }}</DialogTitle>
      </DialogHeader>
      <div class="alias-popover-chips">
        <v-chip
          v-for="chip in chips"
          :key="chip.key"
          class="cursor-pointer"
          @click="handleChipClick(chip)"
        >
          {{ formatAliasName(chip.label) }}
        </v-chip>
      </div>
      <DialogFooter>
        <Button variant="outline" @click="model = false">
          {{ $t("close") }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatAliasName, handleMediaItemClick } from "@/helpers/utils";
import { api } from "@/plugins/api";

const SEARCH_RESULT_LIMIT = 25;

interface AliasChip {
  key: string;
  aliasId: string;
  label: string;
}

interface Props {
  chips: AliasChip[];
  genreUri: string;
}

const props = defineProps<Props>();
const model = defineModel<boolean>();

const handleChipClick = async (chip: AliasChip) => {
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
      genre.uri !== props.genreUri,
  );
  if (target) {
    handleMediaItemClick(target, 0, 0);
  }
  model.value = false;
};
</script>

<style scoped>
.alias-popover-chips {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}
</style>
