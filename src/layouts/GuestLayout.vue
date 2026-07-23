<template>
  <div class="bg-background flex h-dvh flex-col overflow-hidden">
    <header
      class="guest-layout-header grid shrink-0 grid-cols-[1fr_auto_1fr] items-center border-b"
    >
      <MusicQuizHostControlsMenu
        v-if="showHostControls"
        class="justify-self-start"
        @open-host-panel="returnToHostPanel"
      />
      <div v-else />
      <img
        :src="logoSrc"
        alt="Music Assistant"
        class="h-6 w-auto justify-self-center opacity-85"
      />
      <div class="justify-self-end">
        <DropdownMenu>
          <DropdownMenuTrigger as-child>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              class="rounded-full"
              :aria-label="$t('guest.menu_label')"
            >
              <Avatar class="size-8">
                <AvatarFallback
                  class="bg-primary text-primary-foreground text-xs font-medium"
                >
                  <UserRound
                    v-if="isGuestSession"
                    class="size-4"
                    aria-hidden="true"
                  />
                  <span v-else>{{ userInitial }}</span>
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" class="w-56">
            <DropdownMenuLabel>{{ menuLabel }}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <template v-if="isGuestSession">
              <DropdownMenuSub>
                <DropdownMenuSubTrigger>
                  <Palette class="mr-2 size-4" />
                  {{ $t("settings.theme.label") }}
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent>
                  <DropdownMenuRadioGroup
                    :model-value="themePreference"
                    @update:model-value="handleThemePreference"
                  >
                    <DropdownMenuRadioItem
                      v-for="preference in THEME_PREFERENCES"
                      :key="preference"
                      :value="preference"
                    >
                      {{ $t(`settings.theme.options.${preference}`) }}
                    </DropdownMenuRadioItem>
                  </DropdownMenuRadioGroup>
                </DropdownMenuSubContent>
              </DropdownMenuSub>
              <DropdownMenuSeparator />
              <DropdownMenuItem @click="leaveGuestSession">
                <LogOut class="size-4" />
                {{ $t("guest.leave") }}
              </DropdownMenuItem>
            </template>
            <DropdownMenuItem v-else @click="returnToApp">
              <ArrowLeft class="size-4" />
              {{ $t("guest.return_to_app") }}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
    <main class="min-h-0 flex-1 overflow-y-auto">
      <router-view />
    </main>
  </div>
</template>

<script setup lang="ts">
import MusicQuizHostControlsMenu from "@/components/music-quiz/MusicQuizHostControlsMenu.vue";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  guestEntryStateKey,
  useGuestEntryResolver,
} from "@/composables/guest/useGuestEntryResolver";
import {
  isThemePreference,
  THEME_PREFERENCES,
  useThemePreference,
} from "@/composables/useThemePreference";
import { authManager } from "@/plugins/auth";
import { $t } from "@/plugins/i18n";
import { store } from "@/plugins/store";
import { ArrowLeft, LogOut, Palette, UserRound } from "@lucide/vue";
import { computed, provide } from "vue";
import { useRoute, useRouter } from "vue-router";
import { useTheme } from "vuetify";

const { state } = useGuestEntryResolver();
provide(guestEntryStateKey, state);

const router = useRouter();
const route = useRoute();
const isGuestSession = authManager.isGuestAccessSession();
const showHostControls = computed(
  () => !isGuestSession && route.name === "guest-quiz",
);
const menuLabel = computed(() =>
  isGuestSession
    ? $t("guest.access_label")
    : store.currentUser?.display_name ||
      store.currentUser?.username ||
      "Music Assistant",
);
const userInitial = computed(() => menuLabel.value.charAt(0).toUpperCase());

const { themePreference, setGuestThemePreference } = useThemePreference();
const theme = useTheme();
const logoSrc = computed(() =>
  theme.current.value.dark
    ? new URL("@/assets/logo/logo.svg", import.meta.url).href
    : new URL("@/assets/logo/logo-dark.svg", import.meta.url).href,
);

function handleThemePreference(value: unknown): void {
  if (isThemePreference(value)) setGuestThemePreference(value);
}

function leaveGuestSession(): void {
  authManager.leaveGuestSession();
}

function returnToApp(): void {
  void router.push({ name: "discover" });
}

function returnToHostPanel(): void {
  void router.push({ name: "music-quiz" });
}
</script>

<style scoped>
.guest-layout-header {
  height: calc(3rem + env(safe-area-inset-top, 0px));
  padding: env(safe-area-inset-top, 0px)
    calc(0.5rem + env(safe-area-inset-right, 0px)) 0
    calc(0.5rem + env(safe-area-inset-left, 0px));
}
</style>
