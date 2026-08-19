import SkipBackBtn from "@/layouts/default/PlayerOSD/PlayerControlBtn/SkipBackBtn.vue";
import SkipForwardBtn from "@/layouts/default/PlayerOSD/PlayerControlBtn/SkipForwardBtn.vue";
import type { MusicAssistantApi } from "@/plugins/api";
import type { PlayerQueue } from "@/plugins/api/interfaces";
import { mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { queueCommandSkip } = vi.hoisted(() => ({
  queueCommandSkip: vi.fn<MusicAssistantApi["queueCommandSkip"]>(),
}));

vi.mock("@/plugins/api", () => ({
  default: { queueCommandSkip },
}));

vi.mock("@/components/Icon.vue", () => ({
  default: {
    props: ["disabled", "title", "ariaLabel"],
    emits: ["click"],
    template:
      '<button :disabled="disabled" :title="title" @click="$emit(\'click\', $event)"><slot /></button>',
  },
}));

vi.mock("@/plugins/i18n", () => ({
  $t: (key: string, args?: unknown[]) =>
    args ? `${key}:${args.join(",")}` : key,
}));

const queue = (active = true): PlayerQueue =>
  ({
    queue_id: "queue-1",
    active,
    current_item: { media_item: { media_type: "audiobook" } },
  }) as PlayerQueue;

const queueWithoutCurrentItem = (): PlayerQueue =>
  ({
    queue_id: "queue-1",
    active: true,
    current_item: undefined,
  }) as unknown as PlayerQueue;

describe("long-form skip buttons", () => {
  beforeEach(() => queueCommandSkip.mockClear());

  it("skips backward by the configured amount", async () => {
    const wrapper = mount(SkipBackBtn, {
      props: { playerQueue: queue(), skipAmount: 15 },
    });

    await wrapper.trigger("click");

    expect(queueCommandSkip).toHaveBeenCalledWith("queue-1", -15);
  });

  it("skips forward by the configured amount", async () => {
    const wrapper = mount(SkipForwardBtn, {
      props: { playerQueue: queue(), skipAmount: 60 },
    });

    await wrapper.trigger("click");

    expect(queueCommandSkip).toHaveBeenCalledWith("queue-1", 60);
  });

  it("does not issue a command for an inactive queue", async () => {
    const wrapper = mount(SkipForwardBtn, {
      props: { playerQueue: queue(false), skipAmount: 30 },
    });

    expect(wrapper.attributes("disabled")).toBeDefined();
    await wrapper.trigger("click");

    expect(queueCommandSkip).not.toHaveBeenCalled();
  });

  it.each([
    ["an undefined queue", undefined],
    ["an active queue without a current item", queueWithoutCurrentItem()],
  ])("does not issue a command for %s", async (_label, playerQueue) => {
    const wrapper = mount(SkipForwardBtn, {
      props: { playerQueue, skipAmount: 30 },
    });

    expect(wrapper.attributes("disabled")).toBeDefined();
    await wrapper.trigger("click");

    expect(queueCommandSkip).not.toHaveBeenCalled();
  });
});
