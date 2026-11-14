<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent
      class="max-h-[calc(100dvh-2rem)] gap-0 overflow-y-auto p-0 sm:max-w-[560px]"
      data-testid="catalog-detail"
    >
      <DialogHeader class="gap-4 p-6 pr-12 text-left">
        <div class="flex items-center gap-4">
          <CatalogIcon
            :domain="entry.manifest.domain"
            :icon="entry.community?.icon"
            :size="64"
          />
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
        <!-- what a community manifest says is shown as text, never as markup -->
        <p
          v-if="credits && community"
          class="m-0"
          data-testid="catalog-detail-credits"
        >
          <strong>{{ $t("settings.provider_credits") }}:</strong>
          {{ credits }}
        </p>
        <!-- eslint-disable vue/no-v-html -- markdownToHtml sanitizes with DOMPurify -->
        <div
          v-else-if="credits"
          data-testid="catalog-detail-credits"
          v-html="creditsHtml"
        ></div>
        <!-- eslint-enable vue/no-v-html -->
        <p v-if="versionText" class="m-0" data-testid="catalog-detail-version">
          {{ versionText }}
        </p>
        <p v-if="updateText" class="m-0" data-testid="catalog-detail-update">
          {{ updateText }}
        </p>
      </div>

      <div
        class="flex flex-wrap items-center gap-3 border-t bg-muted/20 px-6 py-4"
      >
        <Button
          v-if="entry.canAdd"
          :loading="installing"
          data-testid="catalog-detail-add"
          @click="emit('add')"
        >
          <template v-if="installing">
            {{ $t("settings.catalog.community.installing") }}
          </template>
          <template v-else>
            <Plus class="size-4" />
            {{ $t("settings.catalog.add") }}
          </template>
        </Button>
        <Button
          v-if="updateText"
          variant="outline"
          :loading="updating"
          data-testid="catalog-detail-update-button"
          @click="emit('update')"
        >
          <template v-if="updating">
            {{ $t("settings.catalog.community.updating") }}
          </template>
          <template v-else>
            <Download class="size-4" />
            {{ $t("settings.catalog.community.update") }}
          </template>
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
          v-if="repositoryUrl"
          as="a"
          variant="outline"
          :href="repositoryUrl"
          target="_blank"
          rel="noopener noreferrer"
          data-testid="catalog-detail-repository"
        >
          <FolderGit2 class="size-4" />
          {{ $t("settings.catalog.community.source_code") }}
        </Button>
        <!-- a change to one from the community is for its maintainer -->
        <Button
          v-if="!entry.community"
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
import CatalogIcon from "@/components/settings/catalog/CatalogIcon.vue";
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
import { useCanonicalLocale } from "@/composables/useCanonicalLocale";
import {
  formatCatalogDate,
  getCommunityLinkUrl,
  hasCommunityUpdate,
  isCommunityInstalled,
} from "@/helpers/community_catalog";
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
  Download,
  FolderGit2,
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
  // whether it is being installed from the community catalog
  installing?: boolean;
  // whether it is being updated from the community catalog
  updating?: boolean;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: "update:open", value: boolean): void;
  (e: "add"): void;
  (e: "update"): void;
}>();

const {
  typeLabel,
  community,
  maintainers,
  isSetUp,
  manageRoute,
  repositoryUrl,
} = useCatalogEntryDetails(() => props.entry);

const locale = useCanonicalLocale();

const showStageBadge = computed(() =>
  shouldShowStageBadge(props.entry.manifest.stage),
);

const documentationUrl = computed(() =>
  community.value
    ? getCommunityLinkUrl(props.entry.manifest.documentation)
    : getExternalLinkUrl(props.entry.manifest.documentation),
);

const helpUrl = computed(() =>
  getProviderHelpUrl(props.entry.manifest, repositoryUrl.value),
);

// the version installed, else the one the community catalog offers and when it
// was released
const versionText = computed(() => {
  const provider = props.entry.community;
  if (!provider) return "";
  if (isCommunityInstalled(provider)) {
    return provider.installed_version
      ? $t("settings.catalog.community.version", {
          version: provider.installed_version,
        })
      : "";
  }
  const version = provider.latest_version;
  if (!version) return "";
  const date = provider.released
    ? formatCatalogDate(provider.released, locale.value)
    : "";
  return date
    ? $t("settings.catalog.community.version_released", { version, date })
    : $t("settings.catalog.community.version", { version });
});

// the version on offer for one installed with an update, and when it was released
const updateText = computed(() => {
  const provider = props.entry.community;
  if (!provider || !hasCommunityUpdate(provider)) return "";
  const version = provider.latest_version;
  const date = provider.released
    ? formatCatalogDate(provider.released, locale.value)
    : "";
  return date
    ? $t("settings.catalog.community.update_released", { version, date })
    : $t("settings.catalog.community.update_available", { version });
});

const credits = computed(() => props.entry.manifest.credits.join(" / "));

const creditsHtml = computed(() =>
  markdownToHtml(`**${$t("settings.provider_credits")}**: ${credits.value}`),
);
</script>
