<template>
  <section class="space-y-3" data-testid="community-installed">
    <CatalogSectionHeading :title="$t('settings.catalog.community.title')">
      <Button
        variant="outline"
        size="sm"
        :loading="refreshing"
        data-testid="community-refresh"
        @click="emit('refresh')"
      >
        <RefreshCw v-if="!refreshing" class="size-4" aria-hidden="true" />
        {{ $t("settings.catalog.community.refresh") }}
      </Button>
    </CatalogSectionHeading>

    <ItemGroup v-if="rows.length" class="gap-2">
      <Item
        v-for="{
          provider,
          stateLabel,
          problem,
          stateText,
          reasonUrl,
          summary,
        } in rows"
        :key="provider.domain"
        variant="outline"
        class="rounded-(--radius-xl)"
        data-testid="community-installed-row"
        :data-domain="provider.domain"
      >
        <ItemMedia>
          <CatalogIcon
            :domain="provider.domain"
            :icon="provider.icon"
            :size="40"
          />
        </ItemMedia>
        <ItemContent>
          <ItemTitle class="flex flex-wrap items-center gap-2">
            {{ provider.manifest.name }}
            <Badge
              v-if="stateLabel"
              :variant="problem ? 'destructive' : 'outline'"
              data-testid="community-installed-state"
            >
              {{ $t(stateLabel) }}
            </Badge>
          </ItemTitle>
          <ItemDescription>{{ summary }}</ItemDescription>
          <ItemDescription
            v-if="provider.state === CommunityProviderState.WITHDRAWN"
          >
            {{ $t("settings.catalog.community.withdrawn_hint") }}
          </ItemDescription>
          <ItemDescription
            v-if="stateText"
            :class="{ 'text-destructive': problem }"
            data-testid="community-installed-reason"
          >
            {{ stateText }}
            <a
              v-if="reasonUrl"
              :href="reasonUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="text-primary no-underline hover:underline"
              data-testid="community-installed-reason-link"
              >{{ $t("settings.catalog.community.reason_link") }}</a
            >
          </ItemDescription>
        </ItemContent>
        <ItemActions>
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
        </ItemActions>
      </Item>
    </ItemGroup>
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
import CatalogIcon from "@/components/settings/catalog/CatalogIcon.vue";
import CatalogSectionHeading from "@/components/settings/catalog/CatalogSectionHeading.vue";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import {
  getCommunityStateLabel,
  getCommunityStateText,
  isCommunityProblem,
} from "@/helpers/community_catalog";
import { getCatalogType } from "@/helpers/provider_catalog";
import { getExternalLinkUrl } from "@/helpers/utils";
import {
  type CommunityProvider,
  CommunityProviderState,
} from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import { RefreshCw, Trash2 } from "@lucide/vue";
import { computed } from "vue";

interface Props {
  // the installed ones, running or not
  providers: CommunityProvider[];
  refreshing: boolean;
  // the domains being removed
  removing: ReadonlySet<string>;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: "refresh"): void;
  (e: "remove", provider: CommunityProvider): void;
}>();

const rows = computed(() =>
  props.providers.map((provider) => ({
    provider,
    stateLabel: getCommunityStateLabel(provider),
    problem: isCommunityProblem(provider),
    stateText: getCommunityStateText(provider),
    reasonUrl: getExternalLinkUrl(provider.reason_url),
    summary: getSummary(provider),
  })),
);

// what it is and which version is installed
function getSummary(provider: CommunityProvider): string {
  const type = getCatalogType(provider.manifest.type);
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
