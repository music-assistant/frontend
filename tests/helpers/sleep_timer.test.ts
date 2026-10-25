import {
  getSleepTimerMenuItem,
  getSleepTimerMenuItems,
} from "@/helpers/sleep_timer";
import {
  MediaType,
  PlaybackState,
  SleepTimerMode,
  type Player,
  type PlayerQueue,
} from "@/plugins/api/interfaces";
import { afterEach, describe, expect, it, vi } from "vitest";

const { api, queues } = vi.hoisted(() => ({
  api: { setSleepTimer: vi.fn(), clearSleepTimer: vi.fn() },
  queues: {} as Record<string, PlayerQueue>,
}));

vi.mock("@/plugins/api", () => ({ api, default: api }));
vi.mock("@/plugins/api/helpers", () => ({
  resolvePlayerQueue: (player: Player) => queues[player.player_id],
}));
vi.mock("@/plugins/i18n", () => ({ $t: (key: string) => key }));

function player(sleepTimerMode?: SleepTimerMode | null) {
  // a server that only knows a duration sends no sleep_timer_mode at all
  return {
    player_id: "p1",
    sleep_timer_expires_at: null,
    ...(sleepTimerMode !== undefined && { sleep_timer_mode: sleepTimerMode }),
  } as Player;
}

function queue(
  mediaType: MediaType,
  duration: number | null,
  {
    hasChapters = false,
    state = PlaybackState.PLAYING,
    ended = false,
  }: { hasChapters?: boolean; state?: PlaybackState; ended?: boolean } = {},
) {
  const chapters = hasChapters
    ? [{ position: 1, name: "Chapter 1", start: 0 }]
    : [];
  return {
    queue_id: "p1",
    state,
    ended,
    current_item: {
      duration,
      media_item: { media_type: mediaType, metadata: { chapters } },
    },
  } as unknown as PlayerQueue;
}

const endOfContentLabels = (items: { label: string }[]) =>
  items
    .map((item) => item.label)
    .filter((label) => label.startsWith("sleep_timer_end_of"));

describe("sleep timer menu", () => {
  afterEach(() => {
    delete queues.p1;
    vi.clearAllMocks();
  });

  it.each([
    {
      name: "a server that only knows a duration",
      mode: undefined,
      queue: queue(MediaType.AUDIOBOOK, 600, { hasChapters: true }),
      labels: [],
    },
    {
      name: "a track",
      mode: null,
      queue: queue(MediaType.TRACK, 200),
      labels: ["sleep_timer_end_of_item.track"],
    },
    {
      name: "a radio station without an end",
      mode: null,
      queue: queue(MediaType.RADIO, null),
      labels: [],
    },
    {
      name: "a stopped queue",
      mode: SleepTimerMode.DURATION,
      queue: queue(MediaType.TRACK, 200, { state: PlaybackState.IDLE }),
      labels: [],
    },
    {
      name: "an ended queue",
      mode: null,
      queue: queue(MediaType.TRACK, 200, { ended: true }),
      labels: [],
    },
  ])("offers the item ends that fit $name", ({ mode, queue, labels }) => {
    queues.p1 = queue;

    expect(endOfContentLabels(getSleepTimerMenuItems(player(mode)))).toEqual(
      labels,
    );
  });

  it("offers the chapter end of an audiobook and sets the timer by mode", () => {
    queues.p1 = queue(MediaType.AUDIOBOOK, 600, { hasChapters: true });

    const items = getSleepTimerMenuItems(player(SleepTimerMode.END_OF_ITEM));
    const chapterEnd = items.find(
      (item) => item.label === "sleep_timer_end_of_chapter",
    );
    chapterEnd!.action!();

    expect(endOfContentLabels(items)).toEqual([
      "sleep_timer_end_of_item.audiobook",
      "sleep_timer_end_of_chapter",
    ]);
    expect(
      items.find((item) => item.label === "sleep_timer_end_of_item.audiobook")
        ?.selected,
    ).toBe(true);
    expect(api.setSleepTimer).toHaveBeenCalledWith(
      "p1",
      undefined,
      SleepTimerMode.END_OF_CHAPTER,
    );
  });

  it.each([
    {
      name: "a paused chapter timer",
      mode: SleepTimerMode.END_OF_CHAPTER,
      label: "sleep_timer_active",
      labelArgs: ["sleep_timer_end_of_chapter"],
    },
    { name: "no timer", mode: null, label: "sleep_timer", labelArgs: [] },
  ])("labels the menu entry for $name", ({ mode, label, labelArgs }) => {
    queues.p1 = queue(MediaType.AUDIOBOOK, 600, {
      hasChapters: true,
      state: PlaybackState.PAUSED,
    });

    const item = getSleepTimerMenuItem(player(mode));

    expect(item.label).toBe(label);
    expect(item.labelArgs).toEqual(labelArgs);
  });
});
