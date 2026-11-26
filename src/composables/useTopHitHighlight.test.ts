import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { effectScope, nextTick, ref, type EffectScope } from "vue";
import { useTopHitHighlight } from "./useTopHitHighlight";

let scope: EffectScope;
let list: HTMLElement;
let input: HTMLInputElement;
const topRowKey = ref("");
const query = ref("");

const highlight = (row: Element | undefined) => {
  list
    .querySelectorAll("[data-highlighted]")
    .forEach((el) => el.removeAttribute("data-highlighted"));
  row?.setAttribute("data-highlighted", "");
};

const rows = () => [...list.querySelectorAll("[role=option]")];
const highlighted = () =>
  list.querySelector("[data-highlighted]")?.textContent ?? null;

// stands in for reka: Home goes to the first row, ArrowDown to the next one
const onKeydown = (event: KeyboardEvent) => {
  const all = rows();
  const current = all.findIndex((row) => row.hasAttribute("data-highlighted"));
  if (event.key === "Home") highlight(all[0]);
  if (event.key === "ArrowDown") highlight(all[current + 1]);
};

const setRows = async (names: string[]) => {
  const kept = list.querySelector("[data-highlighted]")?.textContent;
  list.replaceChildren(
    ...names.map((name) => {
      const row = document.createElement("div");
      row.setAttribute("role", "option");
      row.textContent = name;
      if (name === kept) row.setAttribute("data-highlighted", "");
      return row;
    }),
  );
  topRowKey.value = names[0] ?? "";
  await nextTick();
  await nextTick();
};

describe("useTopHitHighlight", () => {
  beforeEach(() => {
    list = document.createElement("div");
    input = document.createElement("input");
    input.addEventListener("keydown", onKeydown);
    document.body.append(input, list);
    topRowKey.value = "";
    query.value = "record";
    scope = effectScope();
    scope.run(() =>
      useTopHitHighlight({
        list: () => list,
        input: () => input,
        topRowKey: () => topRowKey.value,
        resetKey: () => query.value,
        enabled: true,
      }),
    );
  });

  afterEach(() => {
    scope.stop();
    document.body.replaceChildren();
  });

  it("moves an automatic highlight to rows that land above it", async () => {
    await setRows(["Record player"]);
    expect(highlighted()).toBe("Record player");

    await setRows(["Record track", "Record album", "Record player"]);
    expect(highlighted()).toBe("Record track");
  });

  it("keeps a row the user moved to with the arrow keys", async () => {
    await setRows(["Record room", "Record player"]);
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown" }));
    expect(highlighted()).toBe("Record player");

    await setRows(["Record track", "Record room", "Record player"]);
    expect(highlighted()).toBe("Record player");
  });

  it("leaves a scrolled list where it is", async () => {
    await setRows(["Record player"]);
    Object.defineProperty(list, "scrollTop", { value: 200 });

    await setRows(["Record track", "Record player"]);
    expect(highlighted()).toBe("Record player");
  });

  it("keeps a row the user moved to with the mouse", async () => {
    await setRows(["Record room", "Record player"]);
    highlight(rows()[1]);
    rows()[1].dispatchEvent(new PointerEvent("pointermove", { bubbles: true }));

    await setRows(["Record track", "Record room", "Record player"]);
    expect(highlighted()).toBe("Record player");
  });

  it("forgets the row the user moved to when the reset key changes", async () => {
    await setRows(["Record room", "Record player"]);
    input.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown" }));
    query.value = "records";
    await nextTick();

    await setRows(["Record track", "Record room", "Record player"]);
    expect(highlighted()).toBe("Record track");
  });
});
