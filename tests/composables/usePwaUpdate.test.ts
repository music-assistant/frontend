import { ref } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";

const useRegisterSWMock = vi.hoisted(() => vi.fn());

vi.mock("virtual:pwa-register/vue", () => ({
  useRegisterSW: useRegisterSWMock,
}));

describe("usePwaUpdate", () => {
  beforeEach(() => {
    vi.resetModules();
    useRegisterSWMock.mockReset();
  });

  it("initializes the PWA registration once and shares its state", async () => {
    const state = {
      needRefresh: ref(false),
      offlineReady: ref(false),
      updateServiceWorker: vi.fn(),
    };
    useRegisterSWMock.mockReturnValue(state);

    const { usePwaUpdate } = await import("@/composables/usePwaUpdate");

    expect(usePwaUpdate()).toBe(state);
    expect(usePwaUpdate()).toBe(state);
    expect(useRegisterSWMock).toHaveBeenCalledTimes(1);
  });

  it("shares changes to the waiting-update signal", async () => {
    const state = {
      needRefresh: ref(false),
      offlineReady: ref(false),
      updateServiceWorker: vi.fn(),
    };
    useRegisterSWMock.mockReturnValue(state);

    const { usePwaUpdate } = await import("@/composables/usePwaUpdate");
    const firstConsumer = usePwaUpdate();
    const secondConsumer = usePwaUpdate();

    firstConsumer.needRefresh.value = true;

    expect(secondConsumer.needRefresh.value).toBe(true);
  });
});
