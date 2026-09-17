import { useTour } from "@/composables/useTour";
import { afterEach, describe, expect, it } from "vitest";

describe("useTour", () => {
  afterEach(() => {
    useTour().end();
  });

  it("is off until someone starts it", () => {
    expect(useTour().active.value).toBe(false);
  });

  it("switches on for start and off for end", () => {
    const { active, start, end } = useTour();

    start();
    expect(active.value).toBe(true);

    end();
    expect(active.value).toBe(false);
  });

  it("is one switch for everyone who asks for it", () => {
    // the profile menu starts it and the overlay in the layout answers, so the
    // two have to be looking at the same flag
    const starter = useTour();
    const watcher = useTour();

    starter.start();
    expect(watcher.active.value).toBe(true);
  });
});
