/**
 * Artist drill-down for the party guest page.
 *
 * Searching itself happens in the MediaSearch component; this loads the
 * tracks to offer when a guest picks an artist from the search results.
 */

import api from "@/plugins/api";
import type { Artist, Track } from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import { ref } from "vue";
import { toast } from "vue-sonner";

export function useGuestArtistTracks() {
  const selectedArtist = ref<Artist | null>(null);
  const artistTracks = ref<Track[]>([]);
  const loadingArtistTracks = ref(false);

  const selectArtist = async (artist: Artist) => {
    selectedArtist.value = artist;
    loadingArtistTracks.value = true;
    artistTracks.value = [];

    try {
      const providerMapping = artist.provider_mappings?.[0];
      if (!providerMapping) {
        throw new Error("No provider mapping found for artist");
      }

      const tracks = await api.getArtistTracks(
        providerMapping.item_id,
        providerMapping.provider_instance,
      );
      artistTracks.value = tracks;
    } catch (error) {
      console.error("Failed to fetch artist tracks:", error);
      toast.error($t("providers.party.guest_page.load_artist_tracks_failed"));
      selectedArtist.value = null;
    } finally {
      loadingArtistTracks.value = false;
    }
  };

  const clearArtistSelection = () => {
    selectedArtist.value = null;
    artistTracks.value = [];
  };

  return {
    selectedArtist,
    artistTracks,
    loadingArtistTracks,
    selectArtist,
    clearArtistSelection,
  };
}
