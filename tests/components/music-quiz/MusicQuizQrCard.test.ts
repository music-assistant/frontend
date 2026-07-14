import MusicQuizQrCard from "@/components/music-quiz/MusicQuizQrCard.vue";
import { flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  canShare: vi.fn(),
  copyToClipboard: vi.fn(),
  createInvitationFile: vi.fn(),
  renderQrCode: vi.fn(),
  share: vi.fn(),
  toastError: vi.fn(),
}));

vi.mock("@/helpers/qr", () => ({
  renderQrCode: mocks.renderQrCode,
}));

vi.mock("@/helpers/invitation_share", () => ({
  createInvitationFile: mocks.createInvitationFile,
}));

vi.mock("@/helpers/utils", () => ({
  copyToClipboard: mocks.copyToClipboard,
}));

vi.mock("@/plugins/i18n", () => ({
  $t: (key: string) => key,
}));

vi.mock("vue-sonner", () => ({
  toast: {
    error: mocks.toastError,
  },
}));

const originalShare = Object.getOwnPropertyDescriptor(navigator, "share");
const originalCanShare = Object.getOwnPropertyDescriptor(navigator, "canShare");

describe("MusicQuizQrCard", () => {
  beforeEach(() => {
    setNavigatorProperty("share", undefined);
    setNavigatorProperty("canShare", undefined);
    mocks.canShare.mockReset().mockReturnValue(true);
    mocks.copyToClipboard.mockReset().mockResolvedValue(true);
    mocks.createInvitationFile.mockReset();
    mocks.renderQrCode.mockReset().mockResolvedValue(undefined);
    mocks.share.mockReset().mockResolvedValue(undefined);
    mocks.toastError.mockReset();
  });

  afterEach(() => {
    restoreNavigatorProperty("share", originalShare);
    restoreNavigatorProperty("canShare", originalCanShare);
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
    expect(mocks.renderQrCode).toHaveBeenLastCalledWith(
      canvas,
      "https://example.com/quiz/one",
      220,
    );

    await wrapper.setProps({ joinLink: "https://example.com/quiz/two" });
    await flushPromises();
    expect(mocks.renderQrCode).toHaveBeenLastCalledWith(
      canvas,
      "https://example.com/quiz/two",
      220,
    );

    await wrapper.setProps({ size: 260 });
    await flushPromises();
    expect(mocks.renderQrCode).toHaveBeenLastCalledWith(
      canvas,
      "https://example.com/quiz/two",
      260,
    );
    expect(mocks.renderQrCode).toHaveBeenCalledTimes(3);
    wrapper.unmount();
  });

  it("reports rendering failures and clears the error after recovery", async () => {
    const error = new Error("QR render failed");
    mocks.renderQrCode.mockRejectedValueOnce(error);
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
    wrapper.unmount();
  });

  it("shares a branded Music Quiz invitation through the shared actions", async () => {
    const invitationFile = new File(
      ["image"],
      "music-assistant-invitation.png",
      { type: "image/png" },
    );
    setNavigatorProperty("share", mocks.share);
    setNavigatorProperty("canShare", mocks.canShare);
    mocks.createInvitationFile.mockResolvedValue(invitationFile);
    const wrapper = mount(MusicQuizQrCard, {
      props: {
        joinLink: "https://example.com/quiz/one",
      },
    });
    await flushPromises();

    expect(mocks.createInvitationFile).toHaveBeenCalledWith({
      description: "providers.music_quiz.share_description",
      joinLink: "https://example.com/quiz/one",
      logoUrl: expect.stringContaining("logo"),
      title: "providers.music_quiz.share_title",
    });

    await wrapper
      .get('[data-testid="invitation-share-primary"]')
      .trigger("click");
    await flushPromises();

    expect(mocks.share).toHaveBeenCalledWith({
      files: [invitationFile],
      text: "providers.music_quiz.share_description",
      title: "providers.music_quiz.share_title",
      url: "https://example.com/quiz/one",
    });
    wrapper.unmount();
  });

  it("reports copy failures when native sharing is unavailable", async () => {
    mocks.copyToClipboard.mockResolvedValue(false);
    const wrapper = mount(MusicQuizQrCard, {
      props: {
        joinLink: "https://example.com/quiz/one",
      },
    });
    await flushPromises();

    await wrapper
      .get('[data-testid="invitation-share-primary"]')
      .trigger("click");
    await flushPromises();

    expect(mocks.toastError).toHaveBeenCalledWith(
      "providers.music_quiz.copy_join_link_failed",
    );
    wrapper.unmount();
  });
});

function setNavigatorProperty(property: "share" | "canShare", value: unknown) {
  Object.defineProperty(navigator, property, {
    configurable: true,
    value,
  });
}

function restoreNavigatorProperty(
  property: "share" | "canShare",
  descriptor: PropertyDescriptor | undefined,
) {
  if (descriptor) {
    Object.defineProperty(navigator, property, descriptor);
  } else {
    Reflect.deleteProperty(navigator, property);
  }
}
