import { useRegisterSW } from "virtual:pwa-register/vue";

type PwaUpdateState = ReturnType<typeof useRegisterSW>;

let pwaUpdateState: PwaUpdateState | undefined;

/**
 * Share the single service-worker registration between update surfaces.
 *
 * Calling useRegisterSW more than once would create independent refs and
 * registrations, so keep the plugin state at module scope and hand the same
 * instance to every consumer.
 */
export function usePwaUpdate(): PwaUpdateState {
  pwaUpdateState ??= useRegisterSW();
  return pwaUpdateState;
}
