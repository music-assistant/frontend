<template>
  <Alert
    v-if="!dismissed"
    role="note"
    class="flex items-center gap-3 rounded-(--radius-xl) py-3 pr-3 pl-4 max-md:flex-col max-md:items-start [&>svg]:size-5 [&>svg]:translate-y-0"
    data-testid="community-banner"
  >
    <UsersRound class="shrink-0" aria-hidden="true" />
    <div class="min-w-0 flex-1">
      <AlertTitle>
        {{ $t("settings.catalog.community.banner_title") }}
      </AlertTitle>
      <AlertDescription>
        {{ $t("settings.catalog.community.banner_description") }}
      </AlertDescription>
    </div>
    <div class="flex shrink-0 flex-wrap gap-2">
      <Button
        size="sm"
        data-testid="community-banner-enable"
        @click="emit('enable')"
      >
        {{ $t("settings.catalog.community.banner_enable") }}
      </Button>
      <Button
        variant="ghost"
        size="sm"
        data-testid="community-banner-dismiss"
        @click="dismiss"
      >
        {{ $t("settings.catalog.community.banner_dismiss") }}
      </Button>
    </div>
  </Alert>
</template>

<script setup lang="ts">
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  setUserPreference,
  useUserPreferences,
} from "@/composables/userPreferences";
import { COMMUNITY_BANNER_DISMISSED_PREFERENCE } from "@/helpers/community_catalog";
import { $t } from "@/plugins/i18n";
import { UsersRound } from "@lucide/vue";

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
