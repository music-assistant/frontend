<template>
  <CommunityMovedNotice :providers="movedHere" @dismiss="dismissNotice" />
</template>

<script setup lang="ts">
import CommunityMovedNotice from "@/components/settings/catalog/CommunityMovedNotice.vue";
import { useCommunityCatalog } from "@/composables/settings/catalog/useCommunityCatalog";
import { providerListType } from "@/helpers/settings_pages";
import { computed } from "vue";

interface Props {
  // the lists of providers the settings page shows, or undefined when it lists
  // every type
  types?: readonly string[];
}

const props = defineProps<Props>();

const { moved, dismissNotice } = useCommunityCatalog();

// what moved to the community catalog is told on the page listing it
const movedHere = computed(() =>
  moved.value.filter(
    ({ manifest }) =>
      !props.types ||
      props.types.includes(providerListType(manifest.type, manifest.features)),
  ),
);
</script>
