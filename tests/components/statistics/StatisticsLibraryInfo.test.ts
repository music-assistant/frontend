import StatisticsLibraryInfo from "@/components/statistics/StatisticsLibraryInfo.vue";
import { enableAutoUnmount, mount } from "@vue/test-utils";
import { afterEach, describe, expect, it } from "vitest";

enableAutoUnmount(afterEach);

const explanation =
  "Includes plays linked to library tracks with album information. Other plays may be missing.";

describe("StatisticsLibraryInfo", () => {
  it("uses the explanation as the label of the info button", () => {
    const wrapper = mount(StatisticsLibraryInfo, {
      props: { explanation },
    });
    const button = wrapper.get("button");

    expect(button.attributes("aria-label")).toBe(explanation);
    expect(button.get("svg").attributes("aria-hidden")).toBe("true");
  });
});
