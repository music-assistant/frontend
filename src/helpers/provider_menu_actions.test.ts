import { menuItemLabel } from "@/helpers/context_menu_item";
import {
  getProviderMenuItems,
  type ProviderMenuChoice,
  type ProviderMenuContext,
} from "@/helpers/provider_menu_actions";
import {
  MediaType,
  type ProviderInstance,
  type ProviderManifest,
  type ProviderMenuAction,
  ProviderType,
  Scope,
} from "@/plugins/api/interfaces";
import { Puzzle } from "@lucide/vue";
import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";
import type { Component } from "vue";
import { providerManifest } from "../../tests/fixtures/providerManifest";

vi.mock("@/components/ProviderIcon.vue", () => ({
  default: {
    props: ["domain", "size"],
    template: "<i :data-domain='domain' :data-size='size' />",
  },
}));

const ASK: ProviderMenuAction = {
  id: "show_item",
  label: "Ask the demo plugin about this",
  media_types: [MediaType.TRACK, MediaType.ALBUM],
  scope: Scope.LIBRARY_READ,
  icon: "mdi-information-outline",
  requires_player: false,
};

const NOTE: ProviderMenuAction = {
  id: "note",
  label: "Jot down a note",
  media_types: [MediaType.TRACK],
  scope: Scope.LIBRARY_READ,
  icon: "mdi-note-outline",
  requires_player: false,
};

const SEND: ProviderMenuAction = {
  id: "send",
  label: "Send to the frame",
  media_types: [MediaType.TRACK],
  scope: Scope.QUEUES_CONTROL,
  icon: null,
  requires_player: true,
};

describe("getProviderMenuItems", () => {
  it("offers what an available instance declares for the media type of the item", () => {
    expect(menus(MediaType.TRACK, context())).toEqual([
      ["Demo demo", "Ask the demo plugin about this"],
    ]);
    expect(menus(MediaType.ALBUM, context())).toEqual([
      ["Demo demo", "Ask the demo plugin about this"],
    ]);
    expect(menus(MediaType.PLAYLIST, context())).toEqual([]);
  });

  it("gives each instance one entry, with its entries in a submenu, in the declared order", () => {
    const actions = [ASK, NOTE];

    expect(menus(MediaType.TRACK, context({ actions }))).toEqual([
      ["Demo demo", "Ask the demo plugin about this", "Jot down a note"],
    ]);
    // also a single entry sits in a submenu
    expect(menus(MediaType.ALBUM, context({ actions }))).toEqual([
      ["Demo demo", "Ask the demo plugin about this"],
    ]);
  });

  it("orders the instances by name, each entry choosing its own", () => {
    const choose = vi.fn<(choice: ProviderMenuChoice) => void>();
    const items = getProviderMenuItems(
      MediaType.TRACK,
      context({ providers: [demo("demo--b"), demo("demo--a")] }),
      choose,
    );

    expect(items.map(menuItemLabel)).toEqual(["Demo demo--a", "Demo demo--b"]);
    // the labels only keep the entries apart
    expect(new Set(items.map((item) => item.label)).size).toBe(2);
    expect(
      new Set(items.flatMap((item) => item.subItems!.map((sub) => sub.label)))
        .size,
    ).toBe(2);
    items[1].subItems![0].action!();
    expect(choose).toHaveBeenCalledExactlyOnceWith({
      instanceId: "demo--b",
      actionId: "show_item",
      requiresPlayer: false,
    });
    expect(items[1].action).toBeUndefined();
  });

  it.each([
    ["other", ["Ask the demo plugin about this"]],
    ["player", ["Send to the frame"]],
    ["all", ["Ask the demo plugin about this", "Send to the frame"]],
  ] as const)(
    "offers the entries of the kind %s asks for",
    (offer, entries) => {
      expect(
        menus(MediaType.TRACK, context({ actions: [ASK, SEND], offer })),
      ).toEqual([["Demo demo", ...entries]]);
    },
  );

  it("leaves out an instance with nothing of the kind asked for", () => {
    expect(
      menus(MediaType.TRACK, context({ actions: [SEND], offer: "other" })),
    ).toEqual([]);
  });

  it("disables an entry that acts on a player while none is chosen, keeping its submenu", () => {
    const [item] = getProviderMenuItems(
      MediaType.TRACK,
      context({ actions: [ASK, SEND], offer: "all", hasPlayer: false }),
      vi.fn(),
    );

    expect(item.disabled).toBeUndefined();
    expect(item.subItems!.map((sub) => [sub.text, sub.disabled])).toEqual([
      ["Ask the demo plugin about this", false],
      ["Send to the frame", true],
    ]);

    const [onlyPlayer] = getProviderMenuItems(
      MediaType.TRACK,
      context({ actions: [SEND], offer: "player", hasPlayer: false }),
      vi.fn(),
    );
    expect(onlyPlayer.disabled).toBeUndefined();
    expect(onlyPlayer.subItems!.map((sub) => sub.disabled)).toEqual([true]);
  });

  it("enables an entry that acts on a player once one is chosen, and says so when chosen", () => {
    const choose = vi.fn<(choice: ProviderMenuChoice) => void>();
    const [item] = getProviderMenuItems(
      MediaType.TRACK,
      context({ actions: [SEND], offer: "player" }),
      choose,
    );

    expect(item.subItems![0].disabled).toBe(false);
    item.subItems![0].action!();
    expect(choose).toHaveBeenCalledWith({
      instanceId: "demo",
      actionId: "send",
      requiresPlayer: true,
    });
  });

  it("offers nothing of an instance that is not available", () => {
    expect(
      menus(MediaType.TRACK, context({ providers: [demo("demo", false)] })),
    ).toEqual([]);
  });

  it("offers nothing to a user without the scope of the action", () => {
    const hasScope = vi.fn((scope: Scope) => scope !== Scope.LIBRARY_READ);

    expect(menus(MediaType.TRACK, context({ hasScope }))).toEqual([]);
    expect(hasScope).toHaveBeenCalledWith(Scope.LIBRARY_READ);
  });

  it("leaves a scope the app does not know to the user's scopes", () => {
    const scope = "library.everything" as Scope;
    const actions = [{ ...ASK, scope }];

    expect(
      menus(
        MediaType.TRACK,
        context({ actions, hasScope: (s) => s === scope }),
      ),
    ).toEqual([["Demo demo", "Ask the demo plugin about this"]]);
  });

  it("offers nothing from an older server, whose manifests have no menu actions", () => {
    const manifests = {
      demo: providerManifest({ domain: "demo", type: ProviderType.PLUGIN }),
    };

    expect(menus(MediaType.TRACK, context({ manifests }))).toEqual([]);
  });

  it("ignores a media type it does not know", () => {
    const actions = [
      { ...ASK, media_types: ["hologram", MediaType.TRACK] },
    ] as ProviderMenuAction[];

    expect(menus(MediaType.TRACK, context({ actions }))).toEqual([
      ["Demo demo", "Ask the demo plugin about this"],
    ]);
  });

  it.each([
    ["the manifest's name", "Demo plugin", "Demo plugin"],
    ["the domain without a name in the manifest", " ", "demo"],
  ])(
    "names an instance renamed to blanks after %s",
    (_case, manifestName, shown) => {
      const blank = { ...demo("demo"), name: "  " };
      const manifests = {
        demo: { ...manifest([ASK]), name: manifestName },
      };

      const [item] = getProviderMenuItems(
        MediaType.TRACK,
        context({ providers: [blank], manifests }),
        vi.fn(),
      );

      expect(item.text).toBe(shown);
    },
  );

  it("draws an instance with the icon of its provider", () => {
    const items = getProviderMenuItems(
      MediaType.TRACK,
      context({ providers: [demo("demo--a"), demo("demo--b")] }),
      vi.fn(),
    );

    const icon = mount(items[0].icon as Component);
    expect(icon.get("i").attributes()).toMatchObject({
      "data-domain": "demo",
      "data-size": "20",
    });
    // one icon per provider, also when the menu is built again
    expect(items[1].icon).toBe(items[0].icon);
  });

  it.each([
    ["a translation key", "show_info"],
    ["braces and a link", "{0} @:show_info {name} <b>"],
  ])("shows a label that holds %s as it is", (_case, label) => {
    const actions = [{ ...ASK, label }];

    expect(menus(MediaType.TRACK, context({ actions }))).toEqual([
      ["Demo demo", label],
    ]);
  });

  it.each([
    ["mdi-information-outline", "mdi-information-outline"],
    ["mdi-Information", Puzzle],
    ["mdi-image frame", Puzzle],
    ["mdi-image--frame", Puzzle],
    ["fa-solid fa-star", Puzzle],
    ["https://example.org/icon.svg", Puzzle],
    [`mdi-${"a".repeat(61)}`, Puzzle],
    [null, Puzzle],
  ])("draws the icon %s as %s", (icon, drawn) => {
    const [item] = getProviderMenuItems(
      MediaType.TRACK,
      context({ actions: [{ ...ASK, icon }] }),
      vi.fn(),
    );

    expect(item.subItems![0].icon).toEqual(drawn);
  });
});

function demo(instanceId: string, available = true): ProviderInstance {
  return {
    type: ProviderType.PLUGIN,
    domain: "demo",
    name: `Demo ${instanceId}`,
    instance_id: instanceId,
    supported_features: [],
    available,
    is_streaming_provider: false,
  };
}

function manifest(actions: ProviderMenuAction[]): ProviderManifest {
  return {
    ...providerManifest({ domain: "demo", type: ProviderType.PLUGIN }),
    menu_actions: actions,
  };
}

function context(
  overrides: Partial<ProviderMenuContext> & {
    actions?: ProviderMenuAction[];
  } = {},
): ProviderMenuContext {
  const { actions = [ASK], ...rest } = overrides;
  return {
    offer: "other",
    hasPlayer: true,
    providers: [demo("demo")],
    manifests: { demo: manifest(actions) },
    hasScope: () => true,
    ...rest,
  };
}

/** Each instance's entry as its name followed by the texts of its submenu. */
function menus(mediaType: MediaType, given: ProviderMenuContext): string[][] {
  return getProviderMenuItems(mediaType, given, vi.fn()).map((item) => [
    menuItemLabel(item),
    ...(item.subItems ?? []).map(menuItemLabel),
  ]);
}
