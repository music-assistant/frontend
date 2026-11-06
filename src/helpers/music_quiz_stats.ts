import { canonicalizeLocale, i18n } from "@/plugins/i18n";

/**
 * Game stats for the Music Quiz end screen and reveal: fastest answers,
 * awards and a player's own numbers.
 *
 * The host state lists every round's answers keyed by each player's private
 * id, while names only appear in the public player list. Multiple-choice
 * rounds score correct answers by speed, so every correct answer in a round
 * has its own points value; that is what ties an id to a name.
 */

export interface MusicQuizStatsAnswer {
  player_id: string;
  answered_at: number;
  is_correct: boolean;
  points: number;
}

/** The parts of a host round the stats read; timeline rounds have no `answers`. */
export interface MusicQuizStatsRound {
  round_index: number;
  started_at: number | null;
  duration?: number | null;
  answers?: Record<string, MusicQuizStatsAnswer>;
}

export interface MusicQuizStatsPlayer {
  name: string;
  /** Multiple-choice answers carry `correct` and `points`; timeline ones don't. */
  last_answer?: object;
}

export interface MusicQuizFastestAnswer {
  name: string;
  /** Seconds from the start of the round, or null when unknown. */
  seconds: number | null;
}

export type MusicQuizAwardKind =
  "fastest" | "most_correct" | "streak" | "closest_call";

export interface MusicQuizAward {
  kind: MusicQuizAwardKind;
  names: string[];
  /** Seconds for fastest/closest call, a count for most correct/streak. */
  value: number;
}

export interface MusicQuizPersonalRound {
  round_index: number;
  correct: boolean;
  seconds: number | null;
}

export interface MusicQuizPersonalStats {
  correct: number;
  rounds: number;
  fastestSeconds: number | null;
}

/** The player's last answer when it is a correct multiple-choice one. */
function correctPoints(player: MusicQuizStatsPlayer): number | null {
  const answer = player.last_answer as
    { correct?: unknown; points?: unknown } | undefined;
  return answer?.correct === true && typeof answer.points === "number"
    ? answer.points
    : null;
}

/** A streak only counts as an award from this many correct rounds in a row. */
const MIN_STREAK = 2;

export function getRoundAnswers(
  round: MusicQuizStatsRound,
): MusicQuizStatsAnswer[] {
  return Object.values(round.answers ?? {});
}

/** Seconds a player took to answer, from the start of the round. */
export function getAnswerSeconds(
  round: Pick<MusicQuizStatsRound, "started_at">,
  answeredAt: number,
): number | null {
  if (round.started_at == null) return null;
  return Math.max(0, answeredAt - round.started_at);
}

/**
 * Tie this round's correct answers to player names through their unique
 * points. Call it while the round is the revealed one, as `last_answer` only
 * describes the current round.
 */
export function matchCorrectAnswerNames(
  round: MusicQuizStatsRound,
  players: MusicQuizStatsPlayer[],
): Record<string, string> {
  const nameByPoints = new Map<number, string>();
  const duplicatePoints = new Set<number>();
  for (const player of players) {
    const points = correctPoints(player);
    if (points === null) continue;
    if (nameByPoints.has(points)) duplicatePoints.add(points);
    nameByPoints.set(points, player.name);
  }

  const names: Record<string, string> = {};
  for (const answer of getRoundAnswers(round)) {
    if (!answer.is_correct || duplicatePoints.has(answer.points)) continue;
    const name = nameByPoints.get(answer.points);
    if (name) names[answer.player_id] = name;
  }
  return names;
}

/** The quickest correct answer of a round, if its player is known. */
export function getRoundFastest(
  round: MusicQuizStatsRound,
  nameById: Record<string, string>,
): MusicQuizFastestAnswer | null {
  const fastest = getRoundAnswers(round)
    .filter((answer) => answer.is_correct)
    .sort((a, b) => a.answered_at - b.answered_at)[0];
  const name = fastest && nameById[fastest.player_id];
  if (!fastest || !name) return null;
  return { name, seconds: getAnswerSeconds(round, fastest.answered_at) };
}

/**
 * The fastest correct player from public data alone (a TV without host
 * access): speed scoring gives them the most points. No time is known.
 */
export function getPublicRoundFastest(
  players: MusicQuizStatsPlayer[],
): MusicQuizFastestAnswer | null {
  let best: { name: string; points: number } | null = null;
  for (const player of players) {
    const points = correctPoints(player);
    if (points === null) continue;
    if (!best || points > best.points) best = { name: player.name, points };
  }
  return best ? { name: best.name, seconds: null } : null;
}

function topEntries(scores: Map<string, number>, highest: boolean) {
  let best: number | null = null;
  for (const value of scores.values()) {
    if (best === null || (highest ? value > best : value < best)) best = value;
  }
  if (best === null) return null;
  const names = [...scores.entries()]
    .filter(([, value]) => value === best)
    .map(([name]) => name);
  return { names, value: best };
}

/**
 * Awards over every finished round. `answerDuration` is the game's answer
 * window, used for the closest call (the correct answer given with the
 * least time to spare).
 */
export function getGameAwards(
  rounds: MusicQuizStatsRound[],
  nameById: Record<string, string>,
  answerDuration: number,
): MusicQuizAward[] {
  const playedRounds = rounds
    .filter((round) => round.answers && round.started_at != null)
    .sort((a, b) => a.round_index - b.round_index);

  const fastest = new Map<string, number>();
  const spare = new Map<string, number>();
  const correctCount = new Map<string, number>();
  const bestStreak = new Map<string, number>();
  const currentStreak = new Map<string, number>();
  // A correct answer with no known name could change who has most correct or
  // the longest streak, so those two are only given when every one is known.
  let unmatchedCorrect = false;
  // The quickest unnamed answer, and the one with least time to spare: if
  // either beats every named one, that award would name the wrong player.
  let unmatchedFastest = Infinity;
  let unmatchedSpare = Infinity;

  for (const round of playedRounds) {
    const window =
      round.duration && round.duration > 0
        ? Math.min(answerDuration, round.duration)
        : answerDuration;
    const correctNames = new Set<string>();

    for (const answer of getRoundAnswers(round)) {
      if (!answer.is_correct) continue;
      const name = nameById[answer.player_id];
      const seconds = getAnswerSeconds(round, answer.answered_at) ?? 0;
      if (!name) {
        unmatchedCorrect = true;
        unmatchedFastest = Math.min(unmatchedFastest, seconds);
        unmatchedSpare = Math.min(unmatchedSpare, window - seconds);
        continue;
      }
      correctNames.add(name);
      fastest.set(name, Math.min(fastest.get(name) ?? Infinity, seconds));
      spare.set(name, Math.min(spare.get(name) ?? Infinity, window - seconds));
      correctCount.set(name, (correctCount.get(name) ?? 0) + 1);
    }

    for (const name of new Set([...currentStreak.keys(), ...correctNames])) {
      const streak = correctNames.has(name)
        ? (currentStreak.get(name) ?? 0) + 1
        : 0;
      currentStreak.set(name, streak);
      bestStreak.set(name, Math.max(bestStreak.get(name) ?? 0, streak));
    }
  }

  const awards: MusicQuizAward[] = [];
  const fastestTop = topEntries(fastest, false);
  if (fastestTop && fastestTop.value <= unmatchedFastest) {
    awards.push({ kind: "fastest", ...fastestTop });
  }
  const mostCorrect = unmatchedCorrect ? null : topEntries(correctCount, true);
  if (mostCorrect) awards.push({ kind: "most_correct", ...mostCorrect });
  const streak = unmatchedCorrect ? null : topEntries(bestStreak, true);
  if (streak && streak.value >= MIN_STREAK) {
    awards.push({ kind: "streak", ...streak });
  }
  const closest = topEntries(spare, false);
  if (closest && closest.value <= unmatchedSpare) {
    awards.push({
      kind: "closest_call",
      names: closest.names,
      value: Math.max(0, closest.value),
    });
  }
  return awards;
}

export function getPersonalStats(
  rounds: MusicQuizPersonalRound[],
): MusicQuizPersonalStats {
  const correctRounds = rounds.filter((round) => round.correct);
  const times = correctRounds
    .map((round) => round.seconds)
    .filter((seconds): seconds is number => seconds !== null);
  return {
    correct: correctRounds.length,
    rounds: rounds.length,
    fastestSeconds: times.length ? Math.min(...times) : null,
  };
}

/** "2.1s" style answer time. */
export interface MusicQuizRoundResultCount {
  correct: number;
  /** Players taking part in the round; later joiners start next round. */
  total: number;
}

function isCorrectAnswer(answer: object | undefined): boolean {
  if (!answer) return false;
  // Timeline answers mark the placement; multiple-choice ones the answer.
  const result =
    "placement" in answer ? (answer.placement as object | undefined) : answer;
  return (result as { correct?: unknown } | undefined)?.correct === true;
}

/**
 * How many of a round's players got it right, read at the reveal from the
 * public player list (each player's last answer is that round's).
 */
export function getRoundResultCount(
  players: Array<MusicQuizStatsPlayer & { active_from_round: number }>,
  roundIndex: number,
): MusicQuizRoundResultCount {
  const inRound = players.filter(
    (player) => player.active_from_round <= roundIndex,
  );
  return {
    correct: inRound.filter((player) => isCorrectAnswer(player.last_answer))
      .length,
    total: inRound.length,
  };
}

export function formatAnswerSeconds(seconds: number): string {
  return new Intl.NumberFormat(
    canonicalizeLocale(i18n.global.locale.value) || undefined,
    {
      style: "unit",
      unit: "second",
      unitDisplay: "narrow",
      minimumFractionDigits: 1,
      maximumFractionDigits: 1,
    },
  ).format(seconds);
}
