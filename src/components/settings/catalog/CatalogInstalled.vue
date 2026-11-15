<template>
  <div v-if="groups.length" class="space-y-8">
    <section
      v-for="group in groups"
      :key="group.type.type"
      class="space-y-3"
      data-testid="catalog-installed-group"
      :data-type="group.type.type"
    >
      <CatalogSectionHeading
        :title="$t(group.type.label)"
        :link-label="$t(group.type.manageLabel)"
        :link-to="getTypeSettingsRoute(group.type.type)"
      />
      <!-- a source shared with the user is listed, but its settings are not
           the user's to open -->
      <CatalogGrid>
        <CatalogBannerCard
          v-for="item in group.items"
          :key="item.config.instance_id"
          :domain="item.config.domain"
          :name="item.name"
          :to="
            item.manageable ? getInstanceSettingsRoute(item.config) : undefined
          "
          :class="{ 'opacity-60': !item.config.enabled }"
          data-testid="catalog-installed-card"
          :data-domain="item.config.domain"
        >
          <template v-if="!item.config.enabled" #badges>
            <Badge variant="outline">
              {{ $t("settings.provider_status_disabled") }}
            </Badge>
          </template>
          <p
            v-if="subtitle(item)"
            class="m-0 mt-0.5 text-xs text-muted-foreground"
          >
            {{ subtitle(item) }}
          </p>
          <p
            class="m-0 mt-2 line-clamp-2 text-sm leading-5 text-muted-foreground"
          >
            {{ description(item) }}
          </p>
        </CatalogBannerCard>
      </CatalogGrid>
    </section>
  </div>

  <Empty
    v-else
    class="rounded-(--radius-xl) border"
    data-testid="catalog-installed-empty"
  >
    <EmptyHeader>
      <EmptyMedia variant="icon">
        <PackageOpen />
      </EmptyMedia>
      <EmptyTitle>{{
        $t("settings.catalog.installed_empty_title")
      }}</EmptyTitle>
      <EmptyDescription>
        {{ $t("settings.catalog.installed_empty") }}
      </EmptyDescription>
    </EmptyHeader>
  </Empty>
</template>

<script setup lang="ts">
import CatalogBannerCard from "@/components/settings/catalog/CatalogBannerCard.vue";
import CatalogGrid from "@/components/settings/catalog/CatalogGrid.vue";
import CatalogSectionHeading from "@/components/settings/catalog/CatalogSectionHeading.vue";
import { Badge } from "@/components/ui/badge";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  getInstanceSettingsRoute,
  getTypeSettingsRoute,
  type InstalledGroup,
  type InstalledProvider,
} from "@/helpers/provider_catalog";
import { api } from "@/plugins/api";
import { $t } from "@/plugins/i18n";
import { PackageOpen } from "@lucide/vue";

interface Props {
  groups: InstalledGroup[];
}

defineProps<Props>();

// an instance with a name of its own also says what it is
const subtitle = (item: InstalledProvider) => {
  const providerName = api.providerManifests[item.config.domain]?.name;
  return providerName && providerName !== item.name ? providerName : "";
};

const description = (item: InstalledProvider) =>
  api.providerManifests[item.config.domain]?.description ?? "";
</script>
