import SegmentRow from "@/components/ai-radio/SegmentRow.vue";
import type { ShowSegment } from "@/helpers/ai_radio";
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";

const { copyToClipboard } = vi.hoisted(() => ({
  copyToClipboard: vi.fn<(text: string) => Promise<boolean>>(),
}));

vi.mock("@/helpers/utils", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/helpers/utils")>()),
  copyToClipboard,
}));

vi.mock("vue-sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

const PLACEHOLDER_TOKENS = [
  "<next_songinfo>",
  "<prev_songinfo>",
  "<timestamp>",
  "<weather_hourly>",
];

const segment: ShowSegment = {
  id: "intro",
  name: "Intro",
  prompt: "Say hello, <next_songinfo>.",
  webSearch: "disabled",
  maxChars: 500,
  plays: { kind: "start" },
};

async function mountExpanded() {
  const wrapper = mount(SegmentRow, {
    props: { segment, canMoveUp: false, canMoveDown: false },
  });
  await wrapper.get('button[aria-label="Show more"]').trigger("click");
  return wrapper;
}

function placeholderChip(wrapper: VueWrapper, token: string) {
  return wrapper
    .findAll("button")
    .find((button) => button.attributes("aria-label") === `Copy ${token}`);
}

afterEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers();
});

describe("SegmentRow placeholder chips", () => {
  it("renders one chip per placeholder token", async () => {
    const wrapper = await mountExpanded();

    for (const token of PLACEHOLDER_TOKENS) {
      expect(placeholderChip(wrapper, token)?.text()).toBe(token);
    }
  });

  it("copies the exact token when a chip is clicked", async () => {
    copyToClipboard.mockResolvedValue(true);
    const wrapper = await mountExpanded();

    await placeholderChip(wrapper, "<timestamp>")?.trigger("click");
    await flushPromises();

    expect(copyToClipboard).toHaveBeenCalledWith("<timestamp>");
  });

  it("shows a check mark after a successful copy, then reverts it", async () => {
    vi.useFakeTimers();
    copyToClipboard.mockResolvedValue(true);
    const { toast } = await import("vue-sonner");
    const wrapper = await mountExpanded();
    const chip = placeholderChip(wrapper, "<next_songinfo>");

    await chip?.trigger("click");
    await flushPromises();

    expect(chip?.find(".lucide-check").exists()).toBe(true);
    expect(chip?.find(".lucide-copy").exists()).toBe(false);
    expect(toast.success).toHaveBeenCalledWith(
      "Copied <next_songinfo> to clipboard",
    );

    await vi.advanceTimersByTimeAsync(1500);

    expect(chip?.find(".lucide-check").exists()).toBe(false);
    expect(chip?.find(".lucide-copy").exists()).toBe(true);
  });

  it("shows an error toast and no check mark when the copy fails", async () => {
    copyToClipboard.mockResolvedValue(false);
    const { toast } = await import("vue-sonner");
    const wrapper = await mountExpanded();
    const chip = placeholderChip(wrapper, "<prev_songinfo>");

    await chip?.trigger("click");
    await flushPromises();

    expect(toast.error).toHaveBeenCalledWith(
      "Failed to copy <prev_songinfo> to clipboard",
    );
    expect(toast.success).not.toHaveBeenCalled();
    expect(chip?.find(".lucide-check").exists()).toBe(false);
  });
});
