# Vendored: music-assistant/shared-icons

This directory is generated from
https://github.com/music-assistant/shared-icons. It contains the icon-set
contract, display metadata, and canonical SVG artwork.

To update from a checked-out release tag, run:

```sh
pnpm sync:shared-icons /path/to/shared-icons
```

The command validates the source set, vendors `manifest.json`, `meta.json`, and
the SVG files, then generates the Vue component registry. Do not edit generated
files by hand.
