# Vendored: music-assistant/shared-icons

This directory is generated from
https://github.com/music-assistant/shared-icons. It holds the icon-set contract
(`manifest.json`), display metadata (`meta.json`), and the canonical SVG artwork
(`icons/`). Do not edit these by hand, they are overwritten on every sync.

`source.json` records the tag and commit the vendored files came from. It is the
one file here meant to be read in review: a sync PR changes it, and that line is
the provenance of everything else.

## How a sync happens

Normally you do not run anything by hand. When shared-icons publishes a release,
its release workflow (the sender) triggers this repo's
[`sync-shared-icons`](../../../.github/workflows/sync-shared-icons.yml) workflow
(the receiver) via `gh workflow run`, passing the new tag. Both sides use the
`musicassistant-bot` GitHub App, so the receiver runs the sync and opens a signed
PR labelled `dependencies`. If the tag is already vendored the sync is a no-op and
no PR is opened.

The same workflow can be run by hand from the Actions tab with a tag, which is
the way to sync a release before the sender is wired up on the shared-icons side.

## Updating locally

You rarely need this, but the same tool the workflow uses runs locally too.

Bump to a new release tag:

```sh
pnpm sync:shared-icons 1.2.3
```

This clones that tag, validates it, vendors the files, regenerates the Vue
component registry, and records the tag and commit in `source.json`.

Re-vendor the currently pinned tag (no argument):

```sh
pnpm sync:shared-icons
```

This re-clones the tag from `source.json` and fails if the tag has moved, so it
is a no-op on an untouched tree.

To try out local artwork before it is released, point at a checkout of the
shared-icons repo. This vendors the files but leaves `source.json` untouched, so
the pin still reflects a real release:

```sh
pnpm sync:shared-icons --source /path/to/shared-icons
```
