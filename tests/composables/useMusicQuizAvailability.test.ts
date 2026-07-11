import {
  type MusicQuizAvailabilityStatus,
  useMusicQuizAvailability,
} from "@/composables/useMusicQuizAvailability";
import { flushPromises, mount } from "@vue/test-utils";
import { defineComponent, h, type Ref, type ShallowRef } from "vue";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetAvailableMusicQuizTypes } = vi.hoisted(() => ({
  mockGetAvailableMusicQuizTypes: vi.fn(),
}));

vi.mock("@/composables/useMusicQuiz", () => ({
  getAvailableMusicQuizTypes: mockGetAvailableMusicQuizTypes,
}));

interface Availability {
  availableTypes: Ref<string[]>;
  status: Ref<MusicQuizAvailabilityStatus>;
  error: ShallowRef<unknown>;
  isAvailable: (quizType: string) => boolean;
  refresh: () => Promise<boolean>;
}

function deferred<T>() {
  let resolve = (_value: T) => {};
  let reject = (_reason: unknown) => {};
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function mountAvailability() {
  let availability: Availability | undefined;
  const wrapper = mount(
    defineComponent({
      setup() {
        availability = useMusicQuizAvailability();
        return () => h("div");
      },
    }),
  );
  if (!availability) throw new Error("Availability composable did not mount");
  return { availability, wrapper };
}

describe("useMusicQuizAvailability", () => {
  beforeEach(() => {
    mockGetAvailableMusicQuizTypes.mockReset();
  });

  it("confirms Trivia only when the server includes it", async () => {
    const response = deferred<string[]>();
    mockGetAvailableMusicQuizTypes.mockReturnValueOnce(response.promise);
    const { availability, wrapper } = mountAvailability();

    const refresh = availability.refresh();
    expect(availability.status.value).toBe("loading");
    expect(availability.isAvailable("trivia")).toBe(false);

    response.resolve(["guess_the_song", "hitster", "trivia"]);
    await expect(refresh).resolves.toBe(true);
    expect(availability.status.value).toBe("ready");
    expect(availability.isAvailable("trivia")).toBe(true);
    wrapper.unmount();
  });

  it("keeps Trivia unavailable when the server excludes it", async () => {
    mockGetAvailableMusicQuizTypes.mockResolvedValueOnce([
      "guess_the_song",
      "hitster",
    ]);
    const { availability, wrapper } = mountAvailability();

    await availability.refresh();

    expect(availability.status.value).toBe("ready");
    expect(availability.isAvailable("trivia")).toBe(false);
    wrapper.unmount();
  });

  it("clears availability and exposes refresh errors", async () => {
    const error = new Error("Unavailable");
    mockGetAvailableMusicQuizTypes.mockRejectedValueOnce(error);
    const { availability, wrapper } = mountAvailability();

    await expect(availability.refresh()).resolves.toBe(false);

    expect(availability.status.value).toBe("error");
    expect(availability.availableTypes.value).toEqual([]);
    expect(availability.error.value).toBe(error);
    wrapper.unmount();
  });

  it("ignores an older refresh that finishes last", async () => {
    const older = deferred<string[]>();
    const newer = deferred<string[]>();
    mockGetAvailableMusicQuizTypes
      .mockReturnValueOnce(older.promise)
      .mockReturnValueOnce(newer.promise);
    const { availability, wrapper } = mountAvailability();

    const olderRefresh = availability.refresh();
    const newerRefresh = availability.refresh();
    newer.resolve(["guess_the_song", "hitster"]);
    await newerRefresh;
    older.resolve(["guess_the_song", "hitster", "trivia"]);
    await olderRefresh;

    expect(availability.status.value).toBe("ready");
    expect(availability.isAvailable("trivia")).toBe(false);
    wrapper.unmount();
  });

  it("does not update disposed setup state", async () => {
    const response = deferred<string[]>();
    mockGetAvailableMusicQuizTypes.mockReturnValueOnce(response.promise);
    const { availability, wrapper } = mountAvailability();

    const refresh = availability.refresh();
    wrapper.unmount();
    response.resolve(["trivia"]);
    await refresh;
    await flushPromises();

    expect(availability.status.value).toBe("loading");
    expect(availability.availableTypes.value).toEqual([]);
  });
});
