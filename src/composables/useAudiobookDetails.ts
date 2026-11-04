import { useDetailItemUpdates } from "@/composables/useDetailItemUpdates";
import { api } from "@/plugins/api";
import {
  EventType,
  MediaType,
  type Audiobook,
  type EventMessage,
  type PlaylogUpdate,
} from "@/plugins/api/interfaces";
import { store } from "@/plugins/store";
import { onScopeDispose, ref, watch } from "vue";

export interface AudiobookDetailsRoute {
  itemId: string;
  provider: string;
}

/** Loads the route's audiobook and keeps its personal state in step with server events. */
export function useAudiobookDetails(route: () => AudiobookDetailsRoute) {
  const itemDetails = ref<Audiobook>();
  let loadRequest = 0;
  let playState:
    Pick<Audiobook, "uri" | "fully_played" | "resume_position_ms"> | undefined;

  watch(
    () => [route().itemId, route().provider],
    async ([itemId, provider]) => {
      const request = ++loadRequest;
      itemDetails.value = undefined;
      playState = undefined;
      if (!itemId) return;
      const audiobook = await api.getAudiobook(itemId, provider);
      if (request !== loadRequest) return;
      applyAudiobookResponse(audiobook);
    },
    { immediate: true },
  );

  useDetailItemUpdates(itemDetails, { onUpdate: applyPlayState });

  const unsubPlaylog = api.subscribe(
    EventType.PLAYLOG_UPDATED,
    (evt: EventMessage) => {
      const update = evt.data as PlaylogUpdate | undefined;
      if (!update || update.media_type !== MediaType.AUDIOBOOK) return;
      if (update.userid && update.userid !== store.currentUser?.user_id) return;
      const { itemId, provider } = route();
      const routeUri = `${provider}://${MediaType.AUDIOBOOK}/${itemId}`;
      if (update.uri !== itemDetails.value?.uri && update.uri !== routeUri)
        return;
      playState = {
        uri: update.uri,
        fully_played: update.fully_played,
        resume_position_ms: update.seconds_played * 1000,
      };
      applyPlayState();
    },
  );
  onScopeDispose(() => {
    ++loadRequest;
    unsubPlaylog();
  });

  return { itemDetails };

  function applyAudiobookResponse(audiobook: Audiobook) {
    itemDetails.value = audiobook;
    if (playState?.uri !== audiobook.uri) {
      playState = {
        uri: audiobook.uri,
        fully_played: audiobook.fully_played,
        resume_position_ms: audiobook.resume_position_ms,
      };
    }
    applyPlayState();
  }

  function applyPlayState() {
    const audiobook = itemDetails.value;
    if (!audiobook || playState?.uri !== audiobook.uri) return;
    itemDetails.value = {
      ...audiobook,
      fully_played: playState.fully_played,
      resume_position_ms: playState.resume_position_ms,
    };
  }
}
