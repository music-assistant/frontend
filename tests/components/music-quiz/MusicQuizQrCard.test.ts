import MusicQuizQrCard from "@/components/music-quiz/MusicQuizQrCard.vue";
import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockRenderQrCode } = vi.hoisted(() => ({
  mockRenderQrCode: vi.fn(),
}));

vi.mock("@/helpers/qr", () => ({
  renderQrCode: mockRenderQrCode,
}));

vi.mock("@/helpers/utils", () => ({
  copyToClipboard: vi.fn(),
}));

vi.mock("@/plugins/i18n", () => ({
  $t: (key: string) => key,
}));

vi.mock("vue-sonner", () => ({
  toast: {
    error: vi.fn(),
  },
}));

describe("MusicQuizQrCard", () => {
  beforeEach(() => {
    mockRenderQrCode.mockReset().mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("re-renders when the join link or size changes", async () => {
    const wrapper = mount(MusicQuizQrCard, {
      props: {
        joinLink: "https://example.com/quiz/one",
      },
    });
    await flushPromises();

    const canvas = wrapper.get("canvas").element;
    expect(mockRenderQrCode).toHaveBeenLastCalledWith(
      canvas,
      "https://example.com/quiz/one",
      220,
    );

    await wrapper.setProps({ joinLink: "https://example.com/quiz/two" });
    await flushPromises();
    expect(mockRenderQrCode).toHaveBeenLastCalledWith(
      canvas,
      "https://example.com/quiz/two",
      220,
    );

    await wrapper.setProps({ size: 260 });
    await flushPromises();
    expect(mockRenderQrCode).toHaveBeenLastCalledWith(
      canvas,
      "https://example.com/quiz/two",
      260,
    );
    expect(mockRenderQrCode).toHaveBeenCalledTimes(3);
  });

  it("reports rendering failures and clears the error after recovery", async () => {
    const error = new Error("QR render failed");
    mockRenderQrCode.mockRejectedValueOnce(error);
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});
    const wrapper = mount(MusicQuizQrCard, {
      props: {
        joinLink: "https://example.com/quiz/one",
      },
    });
    await flushPromises();

    expect(wrapper.get('[role="alert"]').text()).toBe(
      "providers.music_quiz.qr_unavailable",
    );
    expect(consoleError).toHaveBeenCalledWith(
      "Could not render Music Quiz join QR",
      error,
    );

    await wrapper.setProps({ joinLink: "https://example.com/quiz/two" });
    await flushPromises();

    expect(wrapper.find('[role="alert"]').exists()).toBe(false);
  });
});
