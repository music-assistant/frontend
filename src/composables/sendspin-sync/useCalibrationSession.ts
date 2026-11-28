/**
 * Drives the server side of a calibration run.
 *
 * The server holds one session at a time: it takes the chosen speakers over,
 * starts the chirp track on a single uninterrupted stream, and makes one speaker
 * at a time audible. This composable is the only place that talks to it, so the
 * view never has to know the command names or the order they have to come in.
 *
 * The session gives the speakers back once nothing has driven it for a few
 * minutes, so a phone that is still there says so with a keep-alive well inside
 * that window.
 *
 * A command can fail in three ways, and they are kept apart because they call for
 * different things from the user. The server can refuse it, with a reason of its
 * own that is shown as it is. The server can be out of reach for a moment, which
 * a phone carried into a far room is all the time, and which costs nothing but
 * another tap. Or the session can be gone, which is the only one of the three
 * that ends the run.
 */

import api from "@/plugins/api";
import { ApiCommandError } from "@/plugins/api/errors";
import type {
  CalibrationApplyResult,
  CalibrationPlayer,
  CalibrationSessionState,
} from "@/plugins/api/interfaces";
import { computed, onScopeDispose, ref } from "vue";

/**
 * How often the server is told this client is still there.
 *
 * The server allows 180 seconds, so a phone can miss several of these in a row —
 * a room with no signal, say — before the speakers are given back.
 */
const KEEPALIVE_MS = 30_000;

/** How long a command that never reached the server waits before its one retry. */
const RETRY_DELAY_MS = 1_500;

/** Why the run cannot continue against the server. */
export type SessionLoss = "expired";

/**
 * Why the last command did nothing, while the session itself goes on.
 *
 * `message` is the server's own reason for a refusal, in the user's language.
 */
export type SessionProblem =
  { kind: "refused"; message: string } | { kind: "unreachable" };

export function useCalibrationSession() {
  const players = ref<CalibrationPlayer[]>([]);
  const state = ref<CalibrationSessionState | null>(null);
  const lost = ref<SessionLoss | null>(null);
  const problem = ref<SessionProblem | null>(null);
  /**
   * Whether the session the server holds was started from here.
   *
   * A page that merely found a session running shows it, and may end it when
   * asked to, but must not end it by being closed: that session is somebody's
   * walk in progress on another device.
   */
  const owned = ref(false);

  let keepalive: ReturnType<typeof setInterval> | null = null;
  // Counts the stops asked for, so a start can tell one came in while it waited.
  let stops = 0;
  // Counted rather than flagged: a keep-alive overlapping a user action must not
  // clear the flag while the other command is still in flight.
  const inFlight = ref(0);
  const busy = computed(() => inFlight.value > 0);

  onScopeDispose(() => {
    void stop();
  });

  /** The Sendspin speakers a session can be run against. */
  async function loadPlayers(): Promise<boolean> {
    const eligible = await send<CalibrationPlayer[]>(
      "sendspin/calibration/eligible_players",
      undefined,
      { retry: true },
    );
    if (!eligible) return false;
    players.value = eligible;
    return true;
  }

  /** Read the session the server is running, if there is one. */
  async function refresh(): Promise<CalibrationSessionState | null> {
    const current = await send<CalibrationSessionState | null>(
      "sendspin/calibration/session",
      undefined,
      { retry: true },
    );
    state.value = current ?? null;
    if (!state.value) owned.value = false;
    return state.value;
  }

  /**
   * Take the given speakers over and start the chirp track.
   *
   * `force` takes over speakers that are busy with the user's own content, which
   * the caller is expected to have warned about first.
   */
  async function start(playerIds: string[], force = false): Promise<boolean> {
    const stopsBefore = stops;
    const started = await send<CalibrationSessionState>(
      "sendspin/calibration/start_session",
      { player_ids: playerIds, force },
    );
    if (!started) return false;

    state.value = started;
    owned.value = true;
    lost.value = null;
    if (stops !== stopsBefore) {
      // The page was left while the server was still taking the speakers. That
      // stop found nothing to end, so the session it missed is ended here.
      await stop();
      return false;
    }
    startKeepalive();
    return true;
  }

  /** Make one speaker of the session audible, leaving the stream running. */
  async function solo(playerId: string): Promise<boolean> {
    // Safe to send twice: soloing the speaker that is already soloed changes
    // nothing on the audio path.
    const soloed = await send<CalibrationSessionState>(
      "sendspin/calibration/solo_player",
      { player_id: playerId },
      { retry: true },
    );
    if (!soloed) return false;

    state.value = soloed;
    return true;
  }

  /**
   * Hand the measured offsets over, and return the delay worked out per speaker.
   *
   * The offsets are relative: the phone measures every speaker against a shared,
   * arbitrary baseline, so only the differences between them carry meaning. The
   * server normalises them against the delays the speakers already carry, which
   * is what makes re-running calibration converge instead of drift.
   *
   * Every speaker gets a delay; the split says which of them the server was able
   * to write, and the two halves do not mean the same thing. An `applied` figure
   * is absolute and already in place. A `manual` figure is an increment: the
   * device is still applying a delay of its own, which this run measured but the
   * server will not guess at, so the number has to be added to it rather than
   * written over it.
   *
   * Never sent twice on its own: the server folds in the delays the speakers
   * carry, so a second apply of the same readings would correct the correction.
   */
  async function apply(
    offsetsMs: Record<string, number>,
  ): Promise<CalibrationApplyResult | null> {
    const result = await send<CalibrationApplyResult>(
      "sendspin/calibration/apply_measurements",
      { offsets_ms: offsetsMs },
    );
    return result ?? null;
  }

  /**
   * End the session and give every speaker back.
   *
   * Only a session started from here is ended, unless `adopted` says the user
   * asked for the one found running to be ended.
   *
   * Returns false when there was a session to end and the server could not be
   * told to end it. The session is kept in that case, so the next stop asks the
   * server again rather than answering for speakers it still holds.
   */
  async function stop(adopted = false): Promise<boolean> {
    stops++;
    stopKeepalive();
    if (!state.value) return true;
    if (!owned.value && !adopted) return true;
    // Never thrown: this also runs as the page goes away, with nobody to catch
    // it. The answer says whether the server was told, because until it is the
    // speakers stay held and the user must not be told otherwise.
    try {
      await api.sendCommand("sendspin/calibration/stop_session", undefined, {
        suppressGlobalError: true,
      });
    } catch (error) {
      console.error("[Sendspin Sync] stop_session failed", error);
      return false;
    }
    state.value = null;
    owned.value = false;
    return true;
  }

  /** Clear the fault from a run that has been thrown away. */
  function reset(): void {
    lost.value = null;
    problem.value = null;
    if (!owned.value) return;
    state.value = null;
    owned.value = false;
  }

  /**
   * Send one command, reporting why it did nothing rather than throwing.
   *
   * Returns `undefined` on failure, with `problem` saying why — or `lost` when
   * the failure is that the session this page was driving no longer exists.
   *
   * `retry` sends a command that never reached the server once more. Only for
   * commands that are safe to land twice.
   */
  async function send<Result>(
    command: string,
    args?: Record<string, unknown>,
    options: { retry?: boolean; quiet?: boolean } = {},
  ): Promise<Result | undefined> {
    inFlight.value++;
    try {
      for (let attempt = 0; ; attempt++) {
        try {
          const result = await api.sendCommand<Result>(command, args, {
            suppressGlobalError: true,
          });
          if (!options.quiet) problem.value = null;
          return result;
        } catch (error) {
          console.error(`[Sendspin Sync] ${command} failed`, error);
          if (error instanceof ApiCommandError) {
            await reportRefusal(error, options.quiet ?? false);
            return undefined;
          }
          if (options.retry && attempt === 0) {
            await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS));
            continue;
          }
          if (!options.quiet) problem.value = { kind: "unreachable" };
          return undefined;
        }
      }
    } finally {
      inFlight.value--;
    }
  }

  /**
   * Take in a command the server answered with a refusal.
   *
   * A refusal while the server no longer holds the session this page was driving
   * is an expiry, and that is what the user is told. Anything else is the
   * server's own reason, which is the only account of what went wrong there is.
   */
  async function reportRefusal(
    error: ApiCommandError,
    quiet: boolean,
  ): Promise<void> {
    if (owned.value && (await sessionGone())) {
      lost.value = "expired";
      state.value = null;
      owned.value = false;
      stopKeepalive();
      return;
    }
    if (!quiet) problem.value = { kind: "refused", message: error.message };
  }

  /** Whether the server has stopped holding a session at all. */
  async function sessionGone(): Promise<boolean> {
    try {
      const current = await api.sendCommand<CalibrationSessionState | null>(
        "sendspin/calibration/session",
        undefined,
        { suppressGlobalError: true },
      );
      return !current;
    } catch {
      // The server could not be asked, so this is not an expiry.
      return false;
    }
  }

  function startKeepalive(): void {
    stopKeepalive();
    keepalive = setInterval(() => void keepAlive(), KEEPALIVE_MS);
  }

  function stopKeepalive(): void {
    if (keepalive === null) return;
    clearInterval(keepalive);
    keepalive = null;
  }

  /**
   * Tell the server this client is still there.
   *
   * Quiet about everything but an expiry: one that did not get through says
   * nothing about the run, and the next one is half a minute away.
   */
  async function keepAlive(): Promise<void> {
    await send<CalibrationSessionState>(
      "sendspin/calibration/keep_alive",
      undefined,
      {
        quiet: true,
      },
    );
  }

  return {
    players,
    state,
    lost,
    problem,
    owned,
    busy,
    loadPlayers,
    refresh,
    start,
    solo,
    apply,
    stop,
    reset,
  };
}
