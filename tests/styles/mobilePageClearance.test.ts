// jsdom leaves var() unresolved in computed styles, so this cascade is only
// observable under happy-dom
// @vitest-environment happy-dom
import viewSource from "@/layouts/default/View.vue?raw";
import { afterEach, describe, expect, it } from "vitest";

// not the shipped value, so a rule reading it rather than a copy of it shows
const CLEARANCE = "246px";

// the block is scoped, so it arrives without the [data-v-hash] compound the
// compiler pairs each of its selectors with; nothing here competes with them,
// so the raw selectors stand in for the shipped ones
function extractStyle(source: string) {
  return source.match(/<style scoped>([\s\S]*?)<\/style>/)?.[1] ?? "";
}

afterEach(() => {
  document.head.innerHTML = "";
  document.body.innerHTML = "";
  document.documentElement.removeAttribute("style");
});

describe("mobile page clearance", () => {
  // the settings save bar counts its sticky offset from this padding, taking
  // the clearance off again to sit just above the mobile bars
  it("is the room the mobile page keeps below its content", () => {
    const styles = document.createElement("style");
    styles.textContent = extractStyle(viewSource);
    document.head.appendChild(styles);
    document.documentElement.style.setProperty(
      "--mobile-page-clearance",
      CLEARANCE,
    );

    const page = document.createElement("div");
    page.className = "content-section content-section--mobile";
    document.body.appendChild(page);

    expect(getComputedStyle(page).paddingBottom).toBe(CLEARANCE);
  });
});
