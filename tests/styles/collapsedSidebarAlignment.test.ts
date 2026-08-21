// happy-dom cannot match the compiled group variants and drops declarations
// whose values do calc() arithmetic, so those fights are weighed by ranking
// selectors and reading the rules off the css text; the scoped rules still
// match probes once :deep is unwrapped
// @vitest-environment happy-dom
import appSidebarSource from "@/components/navigation/AppSidebar.vue?raw";
import navMainSource from "@/components/navigation/NavMain.vue?raw";
import navShortcutsSource from "@/components/navigation/NavShortcuts.vue?raw";
import navUserSource from "@/components/navigation/NavUser.vue?raw";
import sidebarFooterSource from "@/components/ui/sidebar/SidebarFooter.vue?raw";
import sidebarTriggerSource from "@/components/ui/sidebar/SidebarTrigger.vue?raw";
import utilities from "@/styles/style.css?inline";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { rank, styleBlocks } from "./cascade";

let triggerStyles: HTMLStyleElement;

// the compiler rewrites `.a :deep(.b)` as `.a[data-v-hash] .b`, so unwrapping
// the marker leaves a selector that matches; the fights below are all between
// rules of the same scoped block, so the compound the hash adds cancels out
function unwrapDeep(source: string) {
  return styleBlocks(source)[0].replaceAll(/:deep\(([^)]*)\)/g, "$1");
}

// the scoped blocks, read as text for the declarations happy-dom cannot hold;
// the trigger block is also injected to back the computed padding read
const appSource = unwrapDeep(appSidebarSource);
const triggerSource = unwrapDeep(sidebarTriggerSource);

// rank() counts compounds off a hand-written selector, and a compiled utility
// is neither: the variant separators live escaped inside the class name, where
// the backslashed colons read as pseudo-classes, and the group gate arrives as
// an :is() around a :where(). Emptying the :where() first keeps the outer
// unwrap from stopping at its closing paren
function plainSelector(selector: string) {
  return selector
    .replaceAll(/\\./g, "")
    .replaceAll(/:where\([^)]*\)/g, "")
    .replaceAll(/:is\(([^)]*)\)/g, "$1");
}

// happy-dom drops every declaration whose value does calc() arithmetic on a
// var(), which hides the sizing utilities and the anchoring margins from its
// CSSOM, so those rules are cut straight out of the css text instead
function cssRule(text: string, fragment: string) {
  const start = text.indexOf(fragment);
  if (start === -1) throw new Error(`${fragment} has no rule in this text`);
  const open = text.indexOf("{", start);
  return {
    selector: text.slice(text.lastIndexOf("\n", start) + 1, open).trim(),
    body: text.slice(open + 1, text.indexOf("}", open)),
  };
}

// a menu button inside the desktop rail, which carries data-collapsible="icon"
// only while collapsed and "" otherwise
function menuButton(collapsible: string) {
  const rail = document.createElement("div");
  rail.className = "group";
  rail.setAttribute("data-collapsible", collapsible);
  rail.innerHTML = `<button data-sidebar="menu-button"></button>`;
  document.body.appendChild(rail);
  return rail.querySelector("button")!;
}

// the collapsed footer as SidebarTrigger renders it around NavUser
function collapsedNavUser() {
  const container = document.createElement("div");
  container.className = "trigger-container trigger-container--collapsed";
  container.innerHTML = `
    <div class="navuser-trigger">
      <ul data-sidebar="menu">
        <li>
          <button data-sidebar="menu-button">
            <span data-slot="avatar" class="rounded-lg"></span>
          </button>
        </li>
      </ul>
    </div>`;
  document.body.appendChild(container);
  return {
    menu: container.querySelector("ul")!,
    avatar: container.querySelector("span")!,
  };
}

describe("collapsed sidebar alignment", () => {
  beforeEach(() => {
    triggerStyles = document.createElement("style");
    triggerStyles.textContent = triggerSource;
    document.head.appendChild(triggerStyles);
  });

  afterEach(() => {
    triggerStyles.remove();
    document.body.innerHTML = "";
  });

  it("anchors the menu buttons only while the rail is collapsed", () => {
    const gutters = cssRule(appSource, '\n[data-sidebar="menu-button"] {');
    const anchor = cssRule(
      appSource,
      '[data-collapsible="icon"] [data-sidebar="menu-button"]',
    );

    // the fixed gutters and the anchor both land on a collapsed button, and
    // the anchor has to out-rank them to win their equally-!important fight
    const collapsed = menuButton("icon");
    expect(collapsed.matches(gutters.selector)).toBe(true);
    expect(collapsed.matches(anchor.selector)).toBe(true);
    expect(rank(anchor.selector)).toBeGreaterThan(rank(gutters.selector));

    // expanded, only the fixed gutters land, so that layout stays untouched
    expect(menuButton("").matches(anchor.selector)).toBe(false);
  });

  it("anchors off the rail width at the utilities' importance", () => {
    const anchor = cssRule(
      appSource,
      '[data-collapsible="icon"] [data-sidebar="menu-button"]',
    );

    // the margin resolves against the rail's final width — the one token that
    // never animates — so the buttons hold still through the collapse; and
    // specificity only settles a tie within one importance level
    expect(anchor.body).toMatch(
      /margin-left: calc\([^;]*var\(--sidebar-width-icon\)[^;]*\) !important/,
    );
    expect(anchor.body).toMatch(/margin-right: 0 !important/);
  });

  it("lifts the row gutter off the collapsed rows", () => {
    // the templates pair the gutter with the variant that lifts it, read off
    // the source so the probes cannot drift from what they render
    const paired = 'class="mr-1.5 group-data-[collapsible=icon]:mr-0"';
    expect(navMainSource).toContain(paired);
    expect(navShortcutsSource).toContain(paired);

    // specificity only settles a tie within one importance level, so the
    // ranking proves nothing unless both sides are !important
    const gutter = cssRule(utilities, "\n.mr-1\\.5 {");
    const lifted = cssRule(utilities, "collapsible\\=icon\\]\\:mr-0");
    expect(gutter.body).toMatch(/margin-right:.*!important/);
    expect(lifted.body).toContain("margin-right: 0px !important");
    expect(rank(plainSelector(lifted.selector))).toBeGreaterThan(
      rank(plainSelector(gutter.selector)),
    );
  });

  it("sizes the collapsed trigger down to the menu button column", () => {
    expect(sidebarTriggerSource).toContain(
      "group-data-[collapsible=icon]:size-8!",
    );

    const resting = cssRule(utilities, "\n.size-9 {");
    const collapsed = cssRule(utilities, "collapsible\\=icon\\]\\:size-8\\!");
    expect(resting.body).toMatch(/width:.*!important/);
    expect(collapsed.body).toMatch(/width:.*!important/);
    expect(rank(plainSelector(collapsed.selector))).toBeGreaterThan(
      rank(plainSelector(resting.selector)),
    );
  });

  it("anchors the avatar between symmetric footer gutters", () => {
    const { menu, avatar } = collapsedNavUser();

    // the avatar takes the same rail-width anchor as the buttons above it
    const anchor = cssRule(triggerSource, '[data-slot="avatar"]');
    expect(avatar.matches(anchor.selector)).toBe(true);
    expect(anchor.body).toMatch(
      /margin-left: calc\([^;]*var\(--sidebar-width-icon\)[^;]*\)/,
    );

    // the menu carries the only side padding left in the collapsed footer,
    // and the anchor subtracts exactly what it keeps on the left
    const padding = getComputedStyle(menu);
    expect(padding.paddingLeft).not.toBe("");
    expect(padding.paddingLeft).toBe(padding.paddingRight);
    expect(anchor.body).toContain(`- ${padding.paddingLeft})`);
  });

  it("drops the name and chevron from the collapsing row", () => {
    // the collapsed attribute lands before the width animation ends, so both
    // hide instantly instead of lingering over the still-shrinking row
    expect(
      navUserSource.match(/group-data-\[collapsible=icon\]:hidden/g),
    ).toHaveLength(2);

    // the name block paints its own display, so hiding it is a specificity
    // fight between two equally-!important utilities
    const grid = cssRule(utilities, "\n.grid {");
    const hidden = cssRule(utilities, "collapsible\\=icon\\]\\:hidden");
    expect(grid.body).toContain("display: grid !important");
    expect(hidden.body).toContain("display: none !important");
    expect(rank(plainSelector(hidden.selector))).toBeGreaterThan(
      rank(plainSelector(grid.selector)),
    );
  });

  it("keeps the collapsed footer clear of side padding", () => {
    // the collapsed branch of the footer ternary, read off the source; the
    // `?` skips the computed in the script and anchors into the template
    const branch = sidebarFooterSource.match(
      /isCollapsed\s*\?[\s\S]*?'([^']*)'/,
    );
    expect(branch).not.toBeNull();
    for (const utility of branch![1].split(/\s+/)) {
      expect(utility).not.toMatch(/^(pl-|pr-|px-|p-)/);
    }
  });
});
