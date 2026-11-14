<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent class="sm:max-w-[520px]" data-testid="community-note">
      <DialogHeader>
        <DialogTitle>
          {{ $t("settings.catalog.community.note_title", { name }) }}
        </DialogTitle>
      </DialogHeader>
      <div
        class="space-y-3 text-sm text-muted-foreground [&_a]:text-primary [&_a]:hover:underline"
      >
        <p class="m-0">{{ maintainedBy }}</p>
        <i18n-t
          keypath="settings.catalog.community.note_help"
          tag="p"
          scope="global"
          class="m-0"
        >
          <template #link>
            <a
              :href="helpUrl"
              target="_blank"
              rel="noopener noreferrer"
              data-testid="community-note-help"
              >{{ $t("settings.provider_get_help") }}</a
            >
          </template>
        </i18n-t>
      </div>
      <DialogFooter>
        <Button variant="outline" @click="emit('update:open', false)">
          {{ $t("cancel") }}
        </Button>
        <Button data-testid="community-note-continue" @click="emit('continue')">
          {{ $t("settings.catalog.community.continue") }}
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
import { useCatalogEntryDetails } from "@/composables/settings/catalog/useCatalogEntryDetails";
import type { CatalogEntry } from "@/helpers/provider_catalog";
import { getProviderHelpUrl } from "@/helpers/provider_config";
import { $t } from "@/plugins/i18n";
import { computed } from "vue";

interface Props {
  open: boolean;
  // an entry from the community catalog
  entry: CatalogEntry;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: "update:open", value: boolean): void;
  (e: "continue"): void;
}>();

const { maintainers, repositoryUrl } = useCatalogEntryDetails(
  () => props.entry,
);

const name = computed(() => props.entry.manifest.name);

const maintainedBy = computed(() =>
  maintainers.value.length
    ? $t("settings.catalog.community.note_maintainers", {
        name: name.value,
        maintainers: maintainers.value.join(", "),
      })
    : $t("settings.catalog.community.note_no_maintainers", {
        name: name.value,
      }),
);

const helpUrl = computed(() =>
  getProviderHelpUrl(props.entry.manifest, repositoryUrl.value),
);
</script>
