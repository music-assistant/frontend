import SetupPausedBanner from "@/components/onboarding/SetupPausedBanner.vue";
import { mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { onbState, openMock } = vi.hoisted(() => ({
  onbState: { showPausedBanner: { value: true } as { value: boolean } },
  openMock: vi.fn(),
}));

vi.mock("@/plugins/i18n", () => ({ $t: (key: string) => key }));

vi.mock("@/composables/useOnboarding", async () => {
  const { ref } = await vi.importActual<typeof import("vue")>("vue");
  onbState.showPausedBanner = ref(true);
  return {
    useOnboarding: () => ({
      showPausedBanner: onbState.showPausedBanner,
      open: openMock,
      dismissPaused: () => {
        onbState.showPausedBanner.value = false;
      },
    }),
  };
});

const banner = (wrapper: ReturnType<typeof mount>) =>
  wrapper.find("[data-testid=setup-paused-banner]");

beforeEach(() => {
  onbState.showPausedBanner.value = true;
  openMock.mockReset();
});

describe("SetupPausedBanner", () => {
  it("shows only while the setup is paused", () => {
    expect(banner(mount(SetupPausedBanner)).exists()).toBe(true);

    onbState.showPausedBanner.value = false;
    expect(banner(mount(SetupPausedBanner)).exists()).toBe(false);
  });

  it("resumes the setup where it was", async () => {
    const wrapper = mount(SetupPausedBanner);

    await wrapper.get("[data-testid=setup-resume]").trigger("click");

    expect(openMock).toHaveBeenCalledWith();
  });

  it("goes away when dismissed", async () => {
    const wrapper = mount(SetupPausedBanner);

    await wrapper.get("[data-testid=setup-paused-dismiss]").trigger("click");

    expect(onbState.showPausedBanner.value).toBe(false);
    expect(banner(wrapper).exists()).toBe(false);
  });
});
