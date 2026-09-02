<script setup lang="ts">
import {
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
} from "@/components/ui/dropdown-menu";
import { useSidebar } from "@/components/ui/sidebar";
import { store } from "@/plugins/store";
import { PanelLeft, PanelLeftClose } from "@lucide/vue";

const { isMobile, setOpen, setOpenMobile } = useSidebar();

const handleCustomizeSidebar = () => {
  store.navMenuEditMode = !store.navMenuEditMode;
};

const handleCollapseSidebar = () => {
  if (isMobile.value) setOpenMobile(false);
  else setOpen(false);
};
</script>

<template>
  <DropdownMenuSub>
    <DropdownMenuSubTrigger>
      <PanelLeft class="size-[18px]" />
      {{ $t("sidebar.title") }}
    </DropdownMenuSubTrigger>
    <DropdownMenuSubContent class="min-w-52">
      <DropdownMenuItem @click="handleCustomizeSidebar">
        <PanelLeft class="size-[18px]" />
        {{
          $t(store.navMenuEditMode ? "menu_edit_disable" : "customize_sidebar")
        }}
      </DropdownMenuItem>
      <DropdownMenuItem @click="handleCollapseSidebar">
        <PanelLeftClose class="size-[18px]" />
        {{ $t("collapse_sidebar") }}
      </DropdownMenuItem>
    </DropdownMenuSubContent>
  </DropdownMenuSub>
</template>
