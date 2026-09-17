import {
  availableTourStops,
  findTourTarget,
  sameFrame,
  spotlightFrame,
  TOUR_STOPS,
  tourCardSide,
} from "@/helpers/tour";
import { afterEach, describe, expect, it } from "vitest";

/** A box on the screen, as the tests lay elements out with. */
interface Box {
  top: number;
  left: number;
  width: number;
  height: number;
}

// happy-dom lays nothing out, so an element is given its place by hand
function placeAt(element: Element, box: Box) {
  element.getBoundingClientRect = () =>
    ({
      ...box,
      x: box.left,
      y: box.top,
      right: box.left + box.width,
      bottom: box.top + box.height,
      toJSON: () => box,
    }) as DOMRect;
}

const SOME_BOX: Box = { top: 10, left: 20, width: 100, height: 40 };

function render(html: string) {
  document.body.innerHTML = html;
  return document.body;
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("findTourTarget", () => {
  it("finds the element that carries the stop's marker", () => {
    const root = render('<button data-tour="search">Search</button>');
    placeAt(root.firstElementChild!, SOME_BOX);

    expect(findTourTarget("search", root)).toBe(root.firstElementChild);
  });

  it("answers null for a stop nothing on the page carries", () => {
    const root = render('<button data-tour="search">Search</button>');
    placeAt(root.firstElementChild!, SOME_BOX);

    expect(findTourTarget("settings", root)).toBeNull();
  });

  it("passes over an element that is not laid out", () => {
    // a hidden sidebar's items are in the document with no size to point at
    const root = render(
      '<button id="hidden" data-tour="search"></button>' +
        '<button id="shown" data-tour="search"></button>',
    );
    placeAt(root.querySelector("#hidden")!, { ...SOME_BOX, width: 0 });
    placeAt(root.querySelector("#shown")!, SOME_BOX);

    expect(findTourTarget("search", root)?.id).toBe("shown");
  });

  it("takes the first element on the page when several carry the marker", () => {
    // a tablet shows the sidebar and the bottom bar at once: the sidebar comes
    // first in the document, and the tour walks along it
    const root = render(
      '<div data-slot="sidebar"><button id="sidebar" data-tour="search"></button></div>' +
        '<nav><button id="bar" data-tour="search"></button></nav>',
    );
    placeAt(root.querySelector("#sidebar")!, SOME_BOX);
    placeAt(root.querySelector("#bar")!, SOME_BOX);

    expect(findTourTarget("search", root)?.id).toBe("sidebar");
  });

  it("never points into the mobile sidebar sheet", () => {
    // the sheet is closed while the tour runs, but its markup lingers while
    // it slides shut, laid out and all
    const root = render(
      '<div data-sidebar="sidebar" data-mobile="true">' +
        '<button id="sheet" data-tour="search"></button></div>' +
        '<nav><button id="bar" data-tour="search"></button></nav>',
    );
    placeAt(root.querySelector("#sheet")!, SOME_BOX);
    placeAt(root.querySelector("#bar")!, SOME_BOX);

    expect(findTourTarget("search", root)?.id).toBe("bar");
  });

  it("does not mistake the mobile player bar for the sheet", () => {
    // the floating player card carries data-mobile too, and is a stop
    const root = render(
      '<div class="mediacontrols" data-mobile="true" data-tour="player_bar"></div>',
    );
    placeAt(root.firstElementChild!, SOME_BOX);

    expect(findTourTarget("player_bar", root)).toBe(root.firstElementChild);
  });
});

describe("availableTourStops", () => {
  it("keeps the tour's order and leaves out what is not on screen", () => {
    // a phone: the sidebar's settings and profile are behind the menu
    const root = render(
      '<button data-tour="player_select"></button>' +
        '<div data-tour="player_bar"></div>' +
        '<button data-tour="search"></button>' +
        '<button data-tour="menu"></button>',
    );
    for (const element of root.children) placeAt(element, SOME_BOX);

    expect(availableTourStops(root)).toEqual([
      "menu",
      "search",
      "player_bar",
      "player_select",
    ]);
  });

  it("walks every stop on a desktop", () => {
    const root = render(
      TOUR_STOPS.map((id) => `<div data-tour="${id}"></div>`).join(""),
    );
    for (const element of root.children) placeAt(element, SOME_BOX);

    expect(availableTourStops(root)).toEqual([...TOUR_STOPS]);
  });

  it("is empty when nothing carries a marker", () => {
    expect(availableTourStops(render("<main></main>"))).toEqual([]);
  });
});

describe("tourCardSide", () => {
  it("puts the card beside a stop in the sidebar", () => {
    const root = render(
      '<div data-slot="sidebar"><button data-tour="settings"></button></div>',
    );

    expect(tourCardSide(root.querySelector("button")!)).toBe("right");
  });

  it("puts the card above anything else, which sits along the bottom", () => {
    const root = render('<nav><button data-tour="search"></button></nav>');

    expect(tourCardSide(root.querySelector("button")!)).toBe("top");
  });
});

describe("spotlightFrame", () => {
  it("grows the stop's box by the margin on every side", () => {
    const element = document.createElement("div");
    placeAt(element, SOME_BOX);

    expect(spotlightFrame(element.getBoundingClientRect(), 6)).toEqual({
      top: 4,
      left: 14,
      width: 112,
      height: 52,
    });
  });
});

describe("sameFrame", () => {
  it("tells a moved or resized frame from the same one", () => {
    const frame = { top: 1, left: 2, width: 3, height: 4 };

    expect(sameFrame(frame, { ...frame })).toBe(true);
    expect(sameFrame(frame, { ...frame, top: 2 })).toBe(false);
    expect(sameFrame(frame, { ...frame, width: 30 })).toBe(false);
  });
});
