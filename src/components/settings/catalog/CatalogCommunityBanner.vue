<template>
  <section
    v-if="!dismissed"
    class="flex items-center gap-6 rounded-(--radius-xl) border border-dashed border-violet-500/40 bg-violet-500/5 p-6 max-md:flex-col max-md:items-stretch max-md:gap-4 max-md:p-5"
    data-testid="community-banner"
  >
    <div class="min-w-0 flex-1 space-y-1">
      <h2 class="m-0 text-lg font-semibold">
        {{ $t("settings.catalog.community.banner_title") }}
      </h2>
      <p class="m-0 text-sm leading-relaxed text-muted-foreground">
        {{ $t("settings.catalog.community.banner_description") }}
      </p>
    </div>
    <div class="flex shrink-0 flex-wrap gap-2">
      <Button
        class="max-md:flex-1"
        data-testid="community-banner-enable"
        @click="emit('enable')"
      >
        {{ $t("settings.catalog.community.banner_enable") }}
      </Button>
      <Button
        variant="ghost"
        class="max-md:flex-1"
        data-testid="community-banner-dismiss"
        @click="dismiss"
      >
        {{ $t("settings.catalog.community.banner_dismiss") }}
      </Button>
    </div>
  </section>
</template>

<script setup lang="ts">
import { Button } from "@/components/ui/button";
import {
  setUserPreference,
  useUserPreferences,
} from "@/composables/userPreferences";
import { COMMUNITY_BANNER_DISMISSED_PREFERENCE } from "@/helpers/community_catalog";
import { $t } from "@/plugins/i18n";

const emit = defineEmits<{
  (e: "enable"): void;
}>();

// kept on the user's profile, so it stays away on every device
const dismissed = useUserPreferences().getPreference(
  COMMUNITY_BANNER_DISMISSED_PREFERENCE,
  false,
);

const dismiss = () => {
  // the api reports a failed save itself, and the banner then comes back
  void setUserPreference(COMMUNITY_BANNER_DISMISSED_PREFERENCE, true);
};
</script>
