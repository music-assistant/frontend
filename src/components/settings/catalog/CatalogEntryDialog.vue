<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent
      class="max-h-[calc(100dvh-2rem)] gap-0 overflow-y-auto p-0 sm:max-w-[560px]"
      data-testid="catalog-detail"
    >
      <DialogHeader class="gap-4 p-6 pr-12 text-left">
        <div class="flex items-center gap-4">
          <ProviderIcon :domain="entry.manifest.domain" :size="64" />
          <div class="min-w-0">
            <DialogTitle class="text-xl leading-tight">
              {{ entry.manifest.name }}
            </DialogTitle>
            <p class="m-0 mt-1 text-sm text-muted-foreground">
              {{ typeLabel }}
            </p>
          </div>
        </div>
        <div
          v-if="community || isSetUp || showStageBadge"
          class="flex flex-wrap items-center gap-1.5"
        >
          <Badge v-if="community" variant="secondary">
            {{ $t("settings.provider_community") }}
          </Badge>
          <ProviderStageBadge :stage="entry.manifest.stage" />
          <Badge
            v-if="isSetUp"
            variant="outline"
            class="gap-1"
            data-testid="catalog-detail-added"
          >
            <Check class="size-3" aria-hidden="true" />
            {{ $t("settings.catalog.added") }}
          </Badge>
        </div>
        <DialogDescription class="leading-relaxed">
          {{ entry.manifest.description }}
        </DialogDescription>
      </DialogHeader>

      <div
        class="space-y-1 px-6 pb-6 text-xs text-muted-foreground [&_a]:text-primary [&_a]:hover:underline"
      >
        <i18n-t
          v-if="maintainers.length"
          keypath="settings.catalog.created_by"
          tag="p"
          scope="global"
          class="m-0"
          data-testid="catalog-detail-maintainers"
        >
          <template #maintainers>
            <template v-for="(handle, index) in maintainers" :key="handle">
              <span v-if="index > 0">, </span>
              <a
                :href="getMaintainerProfileUrl(handle)"
                target="_blank"
                rel="noopener noreferrer"
                >{{ handle }}</a
              >
            </template>
          </template>
        </i18n-t>
        <p v-else class="m-0" data-testid="catalog-detail-maintainers">
          {{ $t("settings.catalog.created_by_team") }}
        </p>
        <!-- eslint-disable vue/no-v-html -- markdownToHtml sanitizes with DOMPurify -->
        <div
          v-if="entry.manifest.credits.length"
          data-testid="catalog-detail-credits"
          v-html="creditsHtml"
        ></div>
        <!-- eslint-enable vue/no-v-html -->
      </div>

      <div
        class="flex flex-wrap items-center gap-3 border-t bg-muted/20 px-6 py-4"
      >
        <Button
          v-if="entry.canAdd"
          data-testid="catalog-detail-add"
          @click="emit('add')"
        >
          <Plus class="size-4" />
          {{ $t("settings.catalog.add") }}
        </Button>
        <Button
          v-if="isSetUp"
          as-child
          :variant="entry.canAdd ? 'outline' : 'default'"
          data-testid="catalog-detail-manage"
        >
          <RouterLink :to="manageRoute" class="no-underline">
            <Settings2 class="size-4" />
            {{ $t("settings.catalog.manage") }}
          </RouterLink>
        </Button>
        <Button
          v-if="documentationUrl"
          as="a"
          variant="outline"
          :href="documentationUrl"
          target="_blank"
          rel="noopener noreferrer"
          data-testid="catalog-detail-documentation"
        >
          <BookOpen class="size-4" />
          {{ $t("settings.documentation") }}
        </Button>
        <Button
          as="a"
          variant="outline"
          :href="helpUrl"
          target="_blank"
          rel="noopener noreferrer"
          data-testid="catalog-detail-help"
        >
          <LifeBuoy class="size-4" />
          {{ $t("settings.provider_get_help") }}
        </Button>
        <Button
          as="a"
          variant="outline"
          :href="FEATURE_REQUESTS_URL"
          target="_blank"
          rel="noopener noreferrer"
          data-testid="catalog-detail-request"
        >
          <MessageSquarePlus class="size-4" />
          {{ $t("settings.catalog.request_change") }}
        </Button>
      </div>
    </DialogContent>
  </Dialog>
</template>

<script setup lang="ts">
import ProviderIcon from "@/components/ProviderIcon.vue";
import ProviderStageBadge from "@/components/settings/providers/ProviderStageBadge.vue";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useCatalogEntryDetails } from "@/composables/settings/catalog/useCatalogEntryDetails";
import {
  type CatalogEntry,
  FEATURE_REQUESTS_URL,
  getMaintainerProfileUrl,
} from "@/helpers/provider_catalog";
import {
  getProviderHelpUrl,
  shouldShowStageBadge,
} from "@/helpers/provider_config";
import { getExternalLinkUrl, markdownToHtml } from "@/helpers/utils";
import { $t } from "@/plugins/i18n";
import {
  BookOpen,
  Check,
  LifeBuoy,
  MessageSquarePlus,
  Plus,
  Settings2,
} from "@lucide/vue";
import { computed } from "vue";
import { RouterLink } from "vue-router";

interface Props {
  open: boolean;
  entry: CatalogEntry;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: "update:open", value: boolean): void;
  (e: "add"): void;
}>();

const { typeLabel, community, maintainers, isSetUp, manageRoute } =
  useCatalogEntryDetails(() => props.entry);

const showStageBadge = computed(() =>
  shouldShowStageBadge(props.entry.manifest.stage),
);

const documentationUrl = computed(() =>
  getExternalLinkUrl(props.entry.manifest.documentation),
);

const helpUrl = computed(() => getProviderHelpUrl(props.entry.manifest));

const creditsHtml = computed(() =>
  markdownToHtml(
    `**${$t("settings.provider_credits")}**: ` +
      props.entry.manifest.credits.join(" / "),
  ),
);
</script>
