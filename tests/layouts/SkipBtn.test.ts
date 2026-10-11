import SkipBtn from "@/layouts/default/PlayerOSD/PlayerControlBtn/SkipBtn.vue";
import SkipIcon from "@/layouts/default/PlayerOSD/PlayerControlBtn/SkipIcon.vue";
import api from "@/plugins/api";
import type { PlayerQueue } from "@/plugins/api/interfaces";
import { enableAutoUnmount, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { playerQueue } from "../fixtures/playerQueue";
import { queueItem } from "../fixtures/queueItem";

vi.mock("@/plugins/api", () => {
  const api = { queueCommandSkip: vi.fn() };
  return { api, default: api };
});

vi.mock("@/plugins/store", () => ({ store: {} }));

// the label is built from a placeholder, so the args have to come through with it
vi.mock("@/plugins/i18n", () => ({
  $t: (key: string, args?: unknown[]) =>
    args ? `${key}(${args.join(",")})` : key,
}));

const queueCommandSkip = vi.mocked(api.queueCommandSkip);

// Vuetify is not installed in the test app, and Icon.vue renders its icon
// inside a v-badge it never imports itself.
const stubs = {
  VIcon: { template: "<i><slot /></i>" },
  VBadge: { template: "<div><slot /></div>" },
};

/** A queue that is playing an item. */
function playingQueue(overrides: Partial<PlayerQueue> = {}): PlayerQueue {
  return playerQueue({ current_item: queueItem(), ...overrides });
}

function mountButton(props: {
  direction: "back" | "forward";
  playerQueue?: PlayerQueue;
}) {
  return mount(SkipBtn, {
    props: { playerQueue: undefined, ...props },
    global: { stubs },
  });
}

const button = (wrapper: ReturnType<typeof mountButton>) =>
  wrapper.get(".icon-container");

const isDisabled = (wrapper: ReturnType<typeof mountButton>) =>
  button(wrapper).classes().includes("icon-container--disabled");

enableAutoUnmount(afterEach);

beforeEach(() => {
  vi.clearAllMocks();
});

describe("SkipBtn", () => {
  it.each([
    { direction: "back" as const, seconds: -10 },
    { direction: "forward" as const, seconds: 30 },
  ])(
    "skips $seconds seconds in the queue for $direction",
    async ({ direction, seconds }) => {
      const wrapper = mountButton({ direction, playerQueue: playingQueue() });

      await button(wrapper).trigger("click");

      expect(queueCommandSkip).toHaveBeenCalledWith("queue-1", seconds);
    },
  );

  it.each([
    { direction: "back" as const, label: "skip_back_seconds(10)" },
    { direction: "forward" as const, label: "skip_forward_seconds(30)" },
  ])("is labelled $label", ({ direction, label }) => {
    const wrapper = mountButton({ direction, playerQueue: playingQueue() });

    expect(button(wrapper).attributes("aria-label")).toBe(label);
    expect(button(wrapper).attributes("title")).toBe(label);
  });

  it.each([
    { direction: "back" as const, seconds: 10 },
    { direction: "forward" as const, seconds: 30 },
  ])("shows $seconds inside the $direction icon", ({ direction, seconds }) => {
    const wrapper = mountButton({ direction, playerQueue: playingQueue() });

    const icon = wrapper.getComponent(SkipIcon);
    expect(icon.props("direction")).toBe(direction);
    expect(icon.get("text").text()).toBe(String(seconds));
  });

  it("is enabled while the queue plays an item", () => {
    const wrapper = mountButton({
      direction: "forward",
      playerQueue: playingQueue(),
    });

    expect(isDisabled(wrapper)).toBe(false);
  });

  it("accepts presses while a previous skip is still in progress", async () => {
    const wrapper = mountButton({
      direction: "forward",
      playerQueue: playingQueue({
        extra_attributes: { play_action_in_progress: true },
      }),
    });

    expect(isDisabled(wrapper)).toBe(false);
    await button(wrapper).trigger("click");
    expect(queueCommandSkip).toHaveBeenCalled();
  });

  it.each([
    { reason: "there is no queue", queue: undefined },
    { reason: "the queue is inactive", queue: playingQueue({ active: false }) },
    { reason: "nothing is playing", queue: playerQueue() },
    {
      reason: "the item has no duration",
      queue: playingQueue({ current_item: queueItem({ duration: null }) }),
    },
    {
      reason: "the item duration is zero",
      queue: playingQueue({ current_item: queueItem({ duration: 0 }) }),
    },
  ])("is disabled when $reason", async ({ queue }) => {
    const wrapper = mountButton({ direction: "forward", playerQueue: queue });

    expect(isDisabled(wrapper)).toBe(true);
    await button(wrapper).trigger("click");
    expect(queueCommandSkip).not.toHaveBeenCalled();
  });
});
