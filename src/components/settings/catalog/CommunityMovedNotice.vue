<template>
  <div v-if="providers.length" class="flex flex-col gap-3">
    <Alert
      v-for="provider in providers"
      :key="provider.domain"
      variant="info"
      role="note"
      data-testid="community-moved"
      :data-domain="provider.domain"
    >
      <Info />
      <AlertTitle>
        {{
          $t("settings.catalog.community.moved_title", {
            name: provider.manifest.name,
          })
        }}
      </AlertTitle>
      <AlertDescription>
        <p class="m-0">{{ $t("settings.catalog.community.moved_message") }}</p>
        <div class="mt-2 flex flex-wrap gap-2">
          <Button
            as-child
            variant="outline"
            size="sm"
            data-testid="community-moved-details"
          >
            <RouterLink
              :to="getCatalogDetailRoute(provider.domain)"
              class="no-underline"
            >
              {{ $t("details") }}
            </RouterLink>
          </Button>
          <Button
            variant="ghost"
            size="sm"
            data-testid="community-moved-dismiss"
            @click="emit('dismiss', provider)"
          >
            {{ $t("settings.catalog.community.dismiss") }}
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  </div>
</template>

<script setup lang="ts">
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { getCatalogDetailRoute } from "@/helpers/provider_catalog";
import type { CommunityProvider } from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import { Info } from "@lucide/vue";
import { RouterLink } from "vue-router";

interface Props {
  // the installed ones with the notice that they moved to the community catalog
  providers: CommunityProvider[];
}

defineProps<Props>();

const emit = defineEmits<{
  (e: "dismiss", provider: CommunityProvider): void;
}>();
</script>
