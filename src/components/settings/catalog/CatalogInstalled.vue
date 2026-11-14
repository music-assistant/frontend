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
      <ItemGroup class="gap-2">
        <!-- a source shared with the user is listed, but its settings are not
             the user's to open -->
        <Item
          v-for="item in group.items"
          :key="item.config.instance_id"
          as-child
          variant="outline"
          class="rounded-(--radius-xl)"
          :class="{
            'hover:bg-accent/50': item.manageable,
            'opacity-60': !item.config.enabled,
          }"
        >
          <component
            :is="item.manageable ? RouterLink : 'div'"
            :to="item.manageable ? getInstanceSettingsRoute(item.config) : null"
            class="text-inherit no-underline"
            data-testid="catalog-installed-row"
          >
            <ItemMedia>
              <ProviderIcon :domain="item.config.domain" :size="40" />
            </ItemMedia>
            <ItemContent>
              <ItemTitle class="flex flex-wrap items-center gap-2">
                {{ item.name }}
                <Badge v-if="!item.config.enabled" variant="outline">
                  {{ $t("settings.provider_status_disabled") }}
                </Badge>
              </ItemTitle>
              <ItemDescription v-if="subtitle(item)">
                {{ subtitle(item) }}
              </ItemDescription>
            </ItemContent>
            <ItemActions v-if="item.manageable">
              <ChevronRight
                class="size-4 text-muted-foreground"
                aria-hidden="true"
              />
            </ItemActions>
          </component>
        </Item>
      </ItemGroup>
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
import ProviderIcon from "@/components/ProviderIcon.vue";
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
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import {
  getInstanceSettingsRoute,
  getTypeSettingsRoute,
  type InstalledGroup,
  type InstalledProvider,
} from "@/helpers/provider_catalog";
import { api } from "@/plugins/api";
import { $t } from "@/plugins/i18n";
import { ChevronRight, PackageOpen } from "@lucide/vue";
import { RouterLink } from "vue-router";

interface Props {
  groups: InstalledGroup[];
}

defineProps<Props>();

// an instance with a name of its own also says what it is
const subtitle = (item: InstalledProvider) => {
  const providerName = api.providerManifests[item.config.domain]?.name;
  return providerName && providerName !== item.name ? providerName : "";
};
</script>
