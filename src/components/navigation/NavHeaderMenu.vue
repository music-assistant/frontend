<script setup lang="ts">
import AppLogo from "@/components/AppLogo.vue";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { copyToClipboard, openLinkInNewTab } from "@/helpers/utils";
import { api } from "@/plugins/api";
import { useSidebar } from "@/components/ui/sidebar";
import { store } from "@/plugins/store";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  BookOpen,
  Bug,
  Code2,
  Copy,
  EllipsisVertical,
  Info,
  LifeBuoy,
  RefreshCw,
  RotateCcw,
  ServerCog,
  Settings,
  Users,
} from "@lucide/vue";
import { computed, ref } from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";
import { toast } from "vue-sonner";
import NavLanguageMenu from "./NavLanguageMenu.vue";
import NavKeyboardShortcuts from "./NavKeyboardShortcuts.vue";
import NavSidebarMenu from "./NavSidebarMenu.vue";
import NavThemeMenu from "./NavThemeMenu.vue";

const { t } = useI18n();
const isEditMode = computed(() => store.navMenuEditMode);
const currentVersion = computed(
  () => store.serverInfo?.server_version || "0.0.0",
);
const releaseNotesUrl = computed(() =>
  currentVersion.value
    ? "https://github.com/music-assistant/server/releases/tag/" +
      encodeURIComponent(currentVersion.value)
    : "https://github.com/music-assistant/server/releases",
);
const isDevelopment = import.meta.env.DEV;
const buildMode = import.meta.env.MODE;
const developerInfoOpen = ref(false);
const browserInfo =
  typeof navigator === "undefined" ? "—" : navigator.userAgent;

const router = useRouter();
const { isMobile, setOpenMobile } = useSidebar();
const handleSettings = () => router.push({ name: "settings" });

const openHelpLink = (url: string) => {
  setOpenMobile(false);
  openLinkInNewTab(url);
};

const handleAbout = () => {
  setOpenMobile(false);
  router.push({ name: "aboutsettings" });
};

const handleDeveloperApiDocs = () => {
  const baseUrl =
    api.serverInfo.value?.base_url ||
    api.serverInfo.value?.internal_url ||
    window.location.origin;
  openHelpLink(`${baseUrl.replace(/\/$/, "")}/api-docs`);
};

const handleDiagnostics = () => {
  setOpenMobile(false);
  router.push({ name: "diagnostics" });
};

const resetLocalUi = () => {
  [
    "frontend.settings.theme",
    "frontend.settings.language",
    "frontend.settings.force_mobile_layout",
    "frontend.settings.web_player_enabled",
  ].forEach((key) => localStorage.removeItem(key));
  setOpenMobile(false);
  window.location.reload();
};

const reloadApplication = () => {
  setOpenMobile(false);
  window.location.reload();
};

const copyVersion = async () => {
  if (!currentVersion.value) return;
  const copied = await copyToClipboard(currentVersion.value);
  if (copied) {
    toast.success(t("settings.version_copied"));
  } else {
    toast.error(t("settings.version_copy_failed"));
  }
};
</script>

<template>
  <DropdownMenu>
    <DropdownMenuTrigger as-child>
      <Button
        variant="ghost"
        size="icon-lg"
        class="sidebar-header-menu data-[state=open]:bg-sidebar-active data-[state=open]:text-sidebar-accent-foreground mr-0 mt-0 mb-0"
        :aria-label="$t('settings.open_menu')"
        @click.stop
      >
        <EllipsisVertical />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent
      :class="[
        'z-[100001] min-w-56 rounded-lg',
        isEditMode ? 'min-w-64' : 'min-w-56',
      ]"
      :side="isMobile ? 'bottom' : 'bottom'"
      :side-offset="isMobile ? 4 : 15"
      align="start"
    >
      <DropdownMenuLabel class="p-0 font-normal">
        <div class="flex items-center gap-3 px-2 py-2 text-left">
          <AppLogo :size="32" />
          <div class="min-w-0">
            <div class="truncate text-sm font-semibold">Music Assistant</div>
            <button
              type="button"
              class="group flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              :aria-label="$t('settings.copy_version')"
              :title="$t('settings.copy_version')"
              @click.stop="copyVersion"
            >
              <span>v{{ currentVersion }}</span>
              <Copy
                class="size-3 opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
                aria-hidden="true"
              />
            </button>
            <a
              :href="releaseNotesUrl"
              target="_blank"
              rel="noopener noreferrer"
              class="text-primary text-xs hover:underline"
              @click.stop
            >
              {{ $t("settings.release_notes") }}
            </a>
          </div>
        </div>
      </DropdownMenuLabel>
      <DropdownMenuSeparator />
      <DropdownMenuItem @click="handleSettings">
        <Settings class="size-4" />
        {{ $t("settings.settings") }}
      </DropdownMenuItem>
      <DropdownMenuSeparator />
      <NavSidebarMenu />
      <DropdownMenuSeparator />
      <NavThemeMenu />
      <NavLanguageMenu />
      <DropdownMenuSeparator />
      <NavKeyboardShortcuts />
      <DropdownMenuSeparator />
      <DropdownMenuSub>
        <DropdownMenuSubTrigger>
          <LifeBuoy class="size-4" />
          {{ $t("tooltip.help") }}
        </DropdownMenuSubTrigger>
        <DropdownMenuSubContent>
          <DropdownMenuItem
            @click="openHelpLink('https://music-assistant.io/')"
          >
            <BookOpen class="size-4" />
            {{ $t("settings.documentation") }}
          </DropdownMenuItem>
          <DropdownMenuItem
            @click="openHelpLink('https://beta.music-assistant.io/')"
          >
            <BookOpen class="size-4" />
            {{ $t("settings.beta_documentation") }}
          </DropdownMenuItem>
          <DropdownMenuItem
            @click="
              openHelpLink(
                'https://github.com/music-assistant/support/discussions/categories/feature-requests-and-ideas',
              )
            "
          >
            <Info class="size-4" />
            {{ $t("settings.feature_requests") }}
          </DropdownMenuItem>
          <DropdownMenuItem
            @click="
              openHelpLink('https://github.com/music-assistant/support/issues')
            "
          >
            <Bug class="size-4" />
            {{ $t("settings.report_issue") }}
          </DropdownMenuItem>
          <DropdownMenuItem
            @click="openHelpLink('https://discord.gg/kaVm8hGpne')"
          >
            <Users class="size-4" />
            {{ $t("settings.community") }}
          </DropdownMenuItem>
          <DropdownMenuItem
            @click="
              openHelpLink(
                'https://github.com/music-assistant/support/discussions/categories/q-a',
              )
            "
          >
            <LifeBuoy class="size-4" />
            {{ $t("settings.troubleshooting") }}
          </DropdownMenuItem>
        </DropdownMenuSubContent>
      </DropdownMenuSub>
      <DropdownMenuSub v-if="isDevelopment">
        <DropdownMenuSubTrigger>
          <Code2 class="size-4" />
          {{ $t("settings.developer") }}
        </DropdownMenuSubTrigger>
        <DropdownMenuSubContent>
          <DropdownMenuItem @click="handleDeveloperApiDocs">
            <Code2 class="size-4" />
            {{ $t("settings.api_docs") }}
          </DropdownMenuItem>
          <DropdownMenuItem @click="handleDiagnostics">
            <ServerCog class="size-4" />
            {{ $t("settings.diagnostics") }}
          </DropdownMenuItem>
          <DropdownMenuItem @click="developerInfoOpen = true">
            <Info class="size-4" />
            {{ $t("settings.version_environment") }}
          </DropdownMenuItem>
          <DropdownMenuItem @click="resetLocalUi">
            <RotateCcw class="size-4" />
            {{ $t("settings.reset_local_ui") }}
          </DropdownMenuItem>
          <DropdownMenuItem @click="reloadApplication">
            <RefreshCw class="size-4" />
            {{ $t("settings.reload_application") }}
          </DropdownMenuItem>
        </DropdownMenuSubContent>
      </DropdownMenuSub>
      <DropdownMenuItem @click="handleAbout">
        <Info class="size-4" />
        {{ $t("settings.about") }}
      </DropdownMenuItem>
    </DropdownMenuContent>
  </DropdownMenu>

  <Dialog v-model:open="developerInfoOpen">
    <DialogContent class="max-w-lg">
      <DialogHeader>
        <DialogTitle>{{ $t("settings.version_environment") }}</DialogTitle>
        <DialogDescription>
          {{ $t("settings.version_environment_description") }}
        </DialogDescription>
      </DialogHeader>
      <dl class="grid gap-3 text-sm">
        <div class="grid grid-cols-[minmax(0,9rem)_1fr] gap-3">
          <dt class="text-muted-foreground">{{ $t("settings.build_mode") }}</dt>
          <dd>{{ buildMode }}</dd>
        </div>
        <div class="grid grid-cols-[minmax(0,9rem)_1fr] gap-3">
          <dt class="text-muted-foreground">
            {{ $t("settings.server_version") }}
          </dt>
          <dd>{{ currentVersion }}</dd>
        </div>
        <div class="grid grid-cols-[minmax(0,9rem)_1fr] gap-3">
          <dt class="text-muted-foreground">
            {{ $t("settings.connection_status") }}
          </dt>
          <dd>{{ api.transportState.value }}</dd>
        </div>
        <div class="grid grid-cols-[minmax(0,9rem)_1fr] gap-3">
          <dt class="text-muted-foreground">{{ $t("settings.browser") }}</dt>
          <dd class="break-all">{{ browserInfo }}</dd>
        </div>
      </dl>
    </DialogContent>
  </Dialog>
</template>

<style scoped>
.sidebar-header-menu {
  color: hsl(var(--sidebar-foreground));
  margin: 0 4px 8px 0;
}
</style>
