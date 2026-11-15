<template>
  <CommunityMovedNotice :providers="movedHere" @dismiss="dismissNotice" />
</template>

<script setup lang="ts">
import CommunityMovedNotice from "@/components/settings/catalog/CommunityMovedNotice.vue";
import { useCommunityCatalog } from "@/composables/settings/catalog/useCommunityCatalog";
import { computed } from "vue";

interface Props {
  // the type of the settings page, or undefined when it lists every type
  type?: string;
}

const props = defineProps<Props>();

const { moved, dismissNotice } = useCommunityCatalog();

// what moved to the community catalog is told on the page of its type
const movedHere = computed(() =>
  moved.value.filter(
    (provider) => !props.type || provider.manifest.type === props.type,
  ),
);
</script>
