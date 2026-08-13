<template>
  <!-- styled as a search input, but it only triggers the command palette -->
  <InputGroup
    class="bg-background/75 cursor-pointer shadow-sm backdrop-blur-md"
    @click="open"
  >
    <InputGroupInput
      readonly
      class="cursor-pointer"
      :placeholder="$t('search')"
      :aria-label="$t('search')"
      @keydown.enter="open"
    />
    <InputGroupAddon>
      <Search />
    </InputGroupAddon>
    <InputGroupAddon align="inline-end">
      <Kbd>{{ commandCenterHotkeyLabel }}</Kbd>
    </InputGroupAddon>
  </InputGroup>
</template>

<script setup lang="ts">
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Kbd } from "@/components/ui/kbd";
import {
  commandCenterHotkeyLabel,
  useCommandCenter,
} from "@/composables/useCommandCenter";
import { Search } from "@lucide/vue";

const { open } = useCommandCenter();
</script>
