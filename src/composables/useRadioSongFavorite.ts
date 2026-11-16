import { clearFavorite, subscribeOwnFavorites } from "@/helpers/favorites";
import {
  matchesRadioSong,
  radioSong,
  radioSongLabel,
} from "@/helpers/radio_song";
import { getArtistsString } from "@/helpers/utils";
import api from "@/plugins/api";
import { MediaType, type Track } from "@/plugins/api/interfaces";
import { eventbus } from "@/plugins/eventbus";
import { $t } from "@/plugins/i18n";
import { store } from "@/plugins/store";
import { toast } from "vue-sonner";
import { computed, effectScope, ref, watch } from "vue";

// a few library hits to find the exact title and artist among
const LIBRARY_MATCH_LIMIT = 5;

/**
 * The signed-in user's like of the song a radio station plays on the active
 * player, with the actions on it.
 *
 * Shared by every surface showing it, so a like from the full screen player is
 * reflected on the player bar behind it.
 */
export function useRadioSongFavorite() {
  // an effect scope of its own: the watcher outlives whichever component
  // happened to ask for it first
  shared ??= effectScope(true).run(createRadioSongFavorite)!;
  return shared;
}

let shared: ReturnType<typeof createRadioSongFavorite> | undefined;

function createRadioSongFavorite() {
  const song = computed(() =>
    radioSong(
      store.curQueueItem?.media_item,
      store.activePlayer?.current_media,
    ),
  );
  const songLabel = computed(() => song.value && radioSongLabel(song.value));

  // the song's track once it is a favorite: what the heart shows and what a
  // removal acts on
  const track = ref<Track>();
  // a like or nothing: the song has no dislike to show
  const favorite = computed(() => (track.value?.favorite ? true : null));

  watch(
    songLabel,
    () => {
      track.value = undefined;
      void findLibraryFavorite();
    },
    { immediate: true },
  );

  subscribeOwnFavorites((update) => {
    if (update.media_type !== MediaType.TRACK || !song.value) return;
    if (track.value?.uri === update.uri) track.value.favorite = update.favorite;
    // a like made elsewhere, or the library track behind a like made here
    else if (update.favorite) void findLibraryFavorite();
  });

  // the library only: a change of song must never search the music providers
  async function findLibraryFavorite() {
    const current = song.value;
    if (!current) return;
    const label = songLabel.value;
    const tracks = await api.getLibraryTracks(
      true,
      `${current.artist} - ${current.title}`,
      LIBRARY_MATCH_LIMIT,
    );
    const found = tracks.find((candidate) =>
      matchesRadioSong(candidate, current),
    );
    // the song may have changed while the library answered
    if (found && songLabel.value === label) track.value = found;
  }

  const like = async () => {
    const label = songLabel.value;
    const found = await findSong();
    if (!found) return;
    await api.addItemToFavorites(found);
    if (songLabel.value === label) track.value = { ...found, favorite: true };
    toast.success(
      $t("favorites_song_added", {
        name: radioSongLabel({
          artist: getArtistsString(found.artists),
          title: found.name,
        }),
      }),
    );
  };

  const unlike = async () => {
    if (track.value && (await clearFavorite(track.value))) {
      track.value.favorite = null;
    }
  };

  const addToPlaylist = async () => {
    const found = await findSong();
    if (found) eventbus.emit("playlistdialog", { items: [found] });
  };

  // searches the music providers, so it runs only on the user's request
  async function findSong(): Promise<Track | undefined> {
    const current = song.value;
    if (!current) return undefined;
    const found = await api.getTrackByName(current.title, current.artist);
    if (!found) {
      toast.error(
        $t("radio_song_not_found", { name: radioSongLabel(current) }),
      );
    }
    return found ?? undefined;
  }

  return { songLabel, favorite, like, unlike, addToPlaylist };
}
