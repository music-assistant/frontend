import ListeningHeatmapCard from "@/components/statistics/ListeningHeatmapCard.vue";
import type { StatisticsHeatmapPoint } from "@/plugins/api/interfaces";
import { i18n } from "@/plugins/i18n";
import { enableAutoUnmount, mount } from "@vue/test-utils";
import { afterEach, describe, expect, it } from "vitest";
import { nextTick } from "vue";

enableAutoUnmount(afterEach);

const originalLocale = i18n.global.locale.value;
const props = {
  data: [
    { weekday: 0, hour: 12, value: 1 },
    { weekday: 6, hour: 22, value: 3 },
  ],
};
const mountCard = (
  cardProps: {
    data: StatisticsHeatmapPoint[];
    loading?: boolean;
    error?: boolean;
  } = props,
) => mount(ListeningHeatmapCard, { props: cardProps });

afterEach(() => {
  i18n.global.locale.value = originalLocale;
});

const expectedWeekdays = (locale: string): string[] => {
  const formatter = new Intl.DateTimeFormat(locale, {
    weekday: "short",
    timeZone: "UTC",
  });
  return Array.from({ length: 7 }, (_, weekday) =>
    formatter.format(new Date(Date.UTC(2024, 0, weekday + 1))),
  );
};

describe("ListeningHeatmapCard locales", () => {
  it.each([
    ["en_GB", "en-GB"],
    ["bg_BG", "bg-BG"],
    ["pt_BR", "pt-BR"],
    ["en", "en"],
  ])("renders localized weekdays for %s", (locale, canonicalLocale) => {
    i18n.global.locale.value = locale;

    const wrapper = mountCard();

    expect(
      wrapper.findAll('tbody th[scope="row"]').map((cell) => cell.text()),
    ).toEqual(expectedWeekdays(canonicalLocale));
  });

  it("updates weekday labels when the locale changes", async () => {
    i18n.global.locale.value = "en_GB";
    const wrapper = mountCard();

    i18n.global.locale.value = "pt_BR";
    await nextTick();

    expect(
      wrapper.findAll('tbody th[scope="row"]').map((cell) => cell.text()),
    ).toEqual(expectedWeekdays("pt-BR"));
  });
});

describe("ListeningHeatmapCard", () => {
  it("labels every cell with its weekday, hour and plays", () => {
    i18n.global.locale.value = "en_GB";
    const wrapper = mountCard();

    const cells = wrapper.findAll("tbody td");
    expect(cells).toHaveLength(7 * 24);
    expect(cells[6 * 24 + 22].attributes("title")).toBe(
      "Sunday at 22:00: 3 plays",
    );
    expect(cells[12].attributes("title")).toBe("Monday at 12:00: 1 play");
  });

  it("shows the loading, error and empty states instead of the table", () => {
    i18n.global.locale.value = "en_GB";

    expect(
      mountCard({ ...props, loading: true })
        .find("table")
        .exists(),
    ).toBe(false);
    expect(
      mountCard({ ...props, error: true })
        .find('[role="alert"]')
        .text(),
    ).toBe("These statistics could not be loaded.");
    expect(mountCard({ data: [] }).text()).toContain(
      "Nothing played in this period",
    );
  });
});
