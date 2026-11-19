import { clearFavorite, subscribeOwnFavorites } from "@/helpers/favorites";
import { radioSong, radioSongLabel } from "@/helpers/radio_song";
import { getArtistsString } from "@/helpers/utils";
import api from "@/plugins/api";
import { MediaType, type Track } from "@/plugins/api/interfaces";
import { eventbus } from "@/plugins/eventbus";
import { $t } from "@/plugins/i18n";
import { store } from "@/plugins/store";
import { toast } from "vue-sonner";
import { computed, effectScope, ref, watch } from "vue";

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

  // the song's track as the library holds it: what the heart shows and what a
  // removal acts on
  const track = ref<Track>();
  // a like or nothing: the song has no dislike to show
  const favorite = computed(() => (track.value?.favorite ? true : null));

  watch(
    () => [songLabel.value, store.activePlayer?.player_id],
    () => {
      track.value = undefined;
      void findLibraryTrack();
    },
    { immediate: true },
  );

  // a like or unlike of the song here or elsewhere
  subscribeOwnFavorites((update) => {
    if (update.media_type === MediaType.TRACK && song.value) {
      void findLibraryTrack();
    }
  });

  // the library only: a change of song must never search the music providers
  async function findLibraryTrack() {
    const playerId = store.activePlayer?.player_id;
    if (!song.value || !playerId) return;
    const label = songLabel.value;
    // it runs in the background on every song change, so a failure only leaves
    // the heart without a state
    const found = await api
      .getCurrentlyPlayingTrack(playerId, true, { suppressGlobalError: true })
      .catch(() => null);
    // the song may have changed while the server answered
    if (songLabel.value === label) track.value = found ?? undefined;
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
    const playerId = store.activePlayer?.player_id;
    if (!current || !playerId) return undefined;
    const found = await api.getCurrentlyPlayingTrack(playerId);
    if (!found) {
      toast.error(
        $t("radio_song_not_found", { name: radioSongLabel(current) }),
      );
    }
    return found ?? undefined;
  }

  return { songLabel, favorite, like, unlike, addToPlaylist };
}
