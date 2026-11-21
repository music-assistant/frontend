<template>
  <section class="space-y-3" data-testid="community-installed">
    <CatalogSectionHeading :title="$t('settings.catalog.community.title')">
      <Button
        v-if="updateCount > 1"
        size="sm"
        :loading="updatingAll"
        data-testid="community-update-all"
        @click="emit('update-all')"
      >
        <Download v-if="!updatingAll" class="size-4" aria-hidden="true" />
        {{ $t("settings.catalog.community.update_all") }}
      </Button>
    </CatalogSectionHeading>

    <CatalogGrid v-if="rows.length">
      <CatalogBannerCard
        v-for="{
          provider,
          stateLabel,
          problem,
          stateText,
          reasonUrl,
          summary,
          update,
          retry,
        } in rows"
        :key="provider.domain"
        :domain="provider.domain"
        :icon="provider.icon"
        :name="provider.manifest.name"
        data-testid="community-installed-card"
        :data-domain="provider.domain"
      >
        <template v-if="stateLabel" #badges>
          <Badge
            :variant="problem ? 'destructive' : 'outline'"
            data-testid="community-installed-state"
          >
            {{ $t(stateLabel) }}
          </Badge>
        </template>
        <div class="mt-0.5 flex flex-col gap-1 text-sm text-muted-foreground">
          <p class="m-0 text-xs">{{ summary }}</p>
          <p v-if="update" class="m-0" data-testid="community-installed-update">
            {{
              $t("settings.catalog.community.update_available", {
                version: provider.latest_version,
              })
            }}
          </p>
          <p
            v-if="provider.state === CommunityProviderState.RESTART_REQUIRED"
            class="m-0"
            data-testid="community-installed-restart"
          >
            {{
              $t("settings.catalog.community.restart_hint", {
                version: provider.pending_version,
              })
            }}
          </p>
          <p v-if="retry" class="m-0" data-testid="community-installed-failed">
            {{
              $t("settings.catalog.community.failed_version", {
                version: provider.failed_version,
              })
            }}
          </p>
          <p
            v-if="provider.state === CommunityProviderState.WITHDRAWN"
            class="m-0"
          >
            {{ $t("settings.catalog.community.withdrawn_hint") }}
          </p>
          <p
            v-if="stateText"
            class="m-0"
            :class="{ 'text-destructive': problem }"
            data-testid="community-installed-reason"
          >
            {{ stateText }}
          </p>
          <!-- a reason may end without a full stop, so its link gets a line of its own -->
          <p v-if="stateText && reasonUrl" class="m-0">
            <a
              :href="reasonUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="text-primary no-underline hover:underline"
              data-testid="community-installed-reason-link"
              >{{ $t("settings.catalog.community.reason_link") }}</a
            >
          </p>
        </div>
        <template #footer>
          <div class="ml-auto flex flex-wrap justify-end gap-2">
            <Button
              v-if="update || retry"
              size="sm"
              :variant="update ? 'default' : 'outline'"
              :loading="isUpdating(provider.domain)"
              :aria-label="
                $t(
                  update
                    ? 'settings.catalog.community.update_named'
                    : 'settings.catalog.community.retry_version_named',
                  { name: provider.manifest.name },
                )
              "
              data-testid="community-update"
              @click="emit('update', provider)"
            >
              <template v-if="isUpdating(provider.domain)">
                {{ $t("settings.catalog.community.updating") }}
              </template>
              <template v-else-if="update">
                <Download class="size-4" aria-hidden="true" />
                {{ $t("settings.catalog.community.update") }}
              </template>
              <template v-else>
                <RotateCcw class="size-4" aria-hidden="true" />
                {{ $t("settings.catalog.try_again") }}
              </template>
            </Button>
            <Button
              variant="outline"
              size="sm"
              :loading="removing.has(provider.domain)"
              :aria-label="
                $t('settings.catalog.community.remove_named', {
                  name: provider.manifest.name,
                })
              "
              data-testid="community-remove"
              @click="emit('remove', provider)"
            >
              <Trash2
                v-if="!removing.has(provider.domain)"
                class="size-4"
                aria-hidden="true"
              />
              {{ $t("settings.catalog.community.remove") }}
            </Button>
          </div>
        </template>
      </CatalogBannerCard>
    </CatalogGrid>
    <p
      v-else
      class="m-0 text-sm text-muted-foreground"
      data-testid="community-installed-empty"
    >
      {{ $t("settings.catalog.community.installed_empty") }}
    </p>
  </section>
</template>

<script setup lang="ts">
import CatalogBannerCard from "@/components/settings/catalog/CatalogBannerCard.vue";
import CatalogGrid from "@/components/settings/catalog/CatalogGrid.vue";
import CatalogSectionHeading from "@/components/settings/catalog/CatalogSectionHeading.vue";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  canRetryCommunityVersion,
  getCommunityLinkUrl,
  getCommunityStateLabel,
  getCommunityStateText,
  hasCommunityUpdate,
  isCommunityProblem,
} from "@/helpers/community_catalog";
import { getManifestCatalogType } from "@/helpers/provider_catalog";
import {
  type CommunityProvider,
  CommunityProviderState,
} from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import { Download, RotateCcw, Trash2 } from "@lucide/vue";
import { computed } from "vue";

interface Props {
  // the installed ones, running or not
  providers: CommunityProvider[];
  // the domains being removed
  removing: ReadonlySet<string>;
  // whether one is being updated, on its own or with all the others
  isUpdating: (domain: string) => boolean;
  updatingAll: boolean;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: "remove", provider: CommunityProvider): void;
  (e: "update", provider: CommunityProvider): void;
  (e: "update-all"): void;
}>();

const rows = computed(() =>
  props.providers.map((provider) => ({
    provider,
    stateLabel: getCommunityStateLabel(provider),
    problem: isCommunityProblem(provider),
    stateText: getCommunityStateText(provider),
    reasonUrl: getCommunityLinkUrl(provider.reason_url),
    summary: getSummary(provider),
    update: hasCommunityUpdate(provider),
    retry: canRetryCommunityVersion(provider),
  })),
);

const updateCount = computed(
  () => rows.value.filter((row) => row.update).length,
);

// what it is and which version is installed
function getSummary(provider: CommunityProvider): string {
  const type = getManifestCatalogType(provider.manifest);
  return [
    type ? $t(type.itemLabel) : "",
    provider.installed_version
      ? $t("settings.catalog.community.version", {
          version: provider.installed_version,
        })
      : "",
  ]
    .filter(Boolean)
    .join(" · ");
}
</script>
