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
import { describe, expect, it, vi } from "vitest";
import { providerManifest } from "../../tests/fixtures/providerManifest";

const ASK: ProviderMenuAction = {
  id: "show_item",
  label: "Ask the demo plugin about this",
  media_types: [MediaType.TRACK, MediaType.ALBUM],
  scope: Scope.LIBRARY_READ,
  icon: "mdi-information-outline",
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
    expect(texts(MediaType.TRACK, context())).toEqual([
      "Ask the demo plugin about this",
    ]);
    expect(texts(MediaType.ALBUM, context())).toEqual([
      "Ask the demo plugin about this",
    ]);
    expect(texts(MediaType.PLAYLIST, context())).toEqual([]);
  });

  it("keeps the actions that act on a player apart from the others", () => {
    const withSend = context({ actions: [ASK, SEND] });

    expect(texts(MediaType.TRACK, withSend)).toEqual([
      "Ask the demo plugin about this",
    ]);
    expect(
      texts(MediaType.TRACK, { ...withSend, requiresPlayer: true }),
    ).toEqual(["Send to the frame"]);
  });

  it("offers nothing of an instance that is not available", () => {
    expect(
      texts(MediaType.TRACK, context({ providers: [demo("demo", false)] })),
    ).toEqual([]);
  });

  it("offers nothing to a user without the scope of the action", () => {
    const hasScope = vi.fn((scope: Scope) => scope !== Scope.LIBRARY_READ);

    expect(texts(MediaType.TRACK, context({ hasScope }))).toEqual([]);
    expect(hasScope).toHaveBeenCalledWith(Scope.LIBRARY_READ);
  });

  it("offers nothing from an older server, whose manifests have no menu actions", () => {
    const manifests = {
      demo: providerManifest({ domain: "demo", type: ProviderType.PLUGIN }),
    };

    expect(texts(MediaType.TRACK, context({ manifests }))).toEqual([]);
  });

  it.each([
    ["no list", "not a list"],
    ["no object", ["show_item"]],
    ["no label", [{ ...ASK, label: 42 }]],
    ["no id", [{ ...ASK, id: null }]],
    ["no list of media types", [{ ...ASK, media_types: "track" }]],
    [
      "a scope the app does not know",
      [{ ...ASK, scope: "library.everything" }],
    ],
  ])("leaves out an action with %s", (_case, declared) => {
    const manifests = {
      demo: { ...manifest([]), menu_actions: declared } as never,
    };

    expect(texts(MediaType.TRACK, context({ manifests }))).toEqual([]);
  });

  it("ignores a media type it does not know, and offers nothing for an item without a menu of them", () => {
    const actions = [
      { ...ASK, media_types: ["hologram", MediaType.TRACK, MediaType.GENRE] },
    ] as ProviderMenuAction[];

    expect(texts(MediaType.TRACK, context({ actions }))).toEqual([
      "Ask the demo plugin about this",
    ]);
    expect(texts(MediaType.GENRE, context({ actions }))).toEqual([]);
  });

  it("tells two instances apart by their names, each entry choosing its own", () => {
    const choose = vi.fn<(choice: ProviderMenuChoice) => void>();
    const items = getProviderMenuItems(
      MediaType.TRACK,
      context({ providers: [demo("demo--b"), demo("demo--a")] }),
      choose,
    );

    expect(items.map(menuItemLabel)).toEqual([
      "Ask the demo plugin about this (Demo demo--a)",
      "Ask the demo plugin about this (Demo demo--b)",
    ]);
    // the label only keeps the entries apart
    expect(new Set(items.map((item) => item.label)).size).toBe(2);
    items[1].action!();
    expect(choose).toHaveBeenCalledWith({
      instanceId: "demo--b",
      actionId: "show_item",
    });
  });

  it.each([
    ["a translation key", "show_info"],
    ["braces and a link", "{0} @:show_info {name} <b>"],
  ])("shows a label that holds %s as it is", (_case, label) => {
    const one = context({ actions: [{ ...ASK, label }] });
    const two = context({
      actions: [{ ...ASK, label }],
      providers: [demo("demo--a"), demo("demo--b")],
    });

    expect(texts(MediaType.TRACK, one)).toEqual([label]);
    expect(texts(MediaType.TRACK, two)[0]).toBe(`${label} (Demo demo--a)`);
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

    expect(item.icon).toEqual(drawn);
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
    requiresPlayer: false,
    providers: [demo("demo")],
    manifests: { demo: manifest(actions) },
    hasScope: () => true,
    ...rest,
  };
}

function texts(mediaType: MediaType, given: ProviderMenuContext): string[] {
  return getProviderMenuItems(mediaType, given, vi.fn()).map(menuItemLabel);
}
