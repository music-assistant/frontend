# What does this implement/fix?

<!-- Quick description and explanation of changes. -->

**Related issue (if applicable):**

- related issue `<link to issue>`

**Related backend PR (if applicable):**

<!--
Link the music-assistant/server PR when this change relies on new server
behaviour, so the two can be reviewed and released together.
-->

- related backend PR `<link to PR>`

## Types of changes

<!--
Tick exactly one box. CI (.github/workflows/pr-labels.yaml) derives
the label from the ticked box and applies it automatically; the
release-notes generator uses that same label to slot this change
into the next release notes.
-->

- [ ] Bugfix (non-breaking change which fixes an issue) — `bugfix`
- [ ] New feature (non-breaking change which adds functionality) — `new-feature`
- [ ] Enhancement to an existing feature — `enhancement`
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected) — `breaking-change`
- [ ] Refactor (no behaviour change) — `refactor`
- [ ] Maintenance / chore — `maintenance`
- [ ] CI / workflow change — `ci`
- [ ] Dependencies bump — `dependencies`

## Checklist

- [ ] The code change is tested and works locally.
- [ ] `pnpm lint:check` passes.
- [ ] `pnpm test:run` passes, and tests have been added/updated under `tests/` where applicable.
- [ ] `pnpm build` passes.
- [ ] I have read and complied with the project's [AI Policy](https://github.com/music-assistant/.github/blob/main/AI_POLICY.md) for any AI-assisted contributions.
