<template>
  <p
    v-for="hint in hints"
    :key="`${hint.artistId}-${hint.providerInstance}`"
    class="text-xs text-muted-foreground"
    data-testid="rotation-library-hint"
  >
    {{
      $t(
        "rotation.library_hint.text",
        {
          artist: hint.artistName,
          in_library: hint.inLibrary,
          total: hint.total,
        },
        hint.total,
      )
    }}
    <RouterLink
      :to="listingRoute(hint)"
      class="underline underline-offset-2 hover:text-foreground"
    >
      {{ $t("rotation.library_hint.link", { provider: hint.providerName }) }}
    </RouterLink>
  </p>
</template>

<script setup lang="ts">
import {
  useRotationLibraryHints,
  type LibraryHint,
} from "@/composables/rotation/useRotationLibraryHints";
import type { RotationStep } from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import { RouterLink, type RouteLocationRaw } from "vue-router";

const props = defineProps<{
  step: RotationStep;
  // the step works on albums taken from the library
  albumsFromLibrary: boolean;
}>();

const { hints } = useRotationLibraryHints(
  () => props.step,
  () => props.albumsFromLibrary,
);

/** The artist's album listing, opened on the provider's catalog. */
function listingRoute(hint: LibraryHint): RouteLocationRaw {
  return {
    name: "artistlisting",
    params: { provider: "library", itemId: hint.artistId, listing: "albums" },
    query: { source: hint.providerInstance },
  };
}
</script>
