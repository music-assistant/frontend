---
skill: review-pr
description: Review a GitHub pull request and provide feedback comments
---

# Review GitHub Pull Request

Please review the GitHub pull request: $ARGUMENTS.

Follow these steps:

1. Use 'gh pr view' to get the PR details and description.
2. Use 'gh pr diff' to see all the changes in the PR.
3. Use 'gh pr checks' to see the status of CI checks.
4. Analyze the code changes for:
   - Code quality and style consistency
   - Potential bugs or issues
   - Performance implications
   - Security concerns
   - Test coverage
   - Documentation updates if needed
5. Ensure any existing review comments have been addressed.
6. Generate constructive review comments in the CONSOLE. DO NOT POST TO GITHUB YOURSELF.

IMPORTANT:

- If the local commit does not match the pr one, checkout the PR locally using 'gh pr checkout'.
- CRITICAL: If 'gh pr checkout' fails for ANY reason, you MUST immediately STOP.
  - Do NOT attempt any workarounds (git fetch, alternative methods, etc.).
  - Do NOT proceed with the review using only diffs.
  - ALERT about the failure and WAIT for instructions.
  - This is a hard requirement - no exceptions.
- When checked out locally, ensure the local commit hash matches the remote one.
- CRITICAL: if the commits don't match, you MUST immediately STOP.
- DO NOT make any changes to the code
- Be constructive and specific in your comments
- Suggest improvements where appropriate
- Only provide review feedback in the CONSOLE. DO NOT ACT ON GITHUB.
- No need to run tests or linters, just review the code changes.

PROJECT-SPECIFIC RULES:

- UI Components: New features MUST use shadcn-vue (components in `src/components/ui/`), NOT Vuetify
- If existing Vuetify code is being modified, suggest refactoring to shadcn-vue when reasonable
- TypeScript: Ensure proper typing for `.vue` imports and component props
- Translations: New user-facing strings should use i18n (managed via Lokalise)
- Refer to shadcn-vue docs for component usage: https://www.shadcn-vue.com/
- Large files: Prefer splitting any new or heavily-modified file so it stays under ~300 lines where practical. If a file exceeds this, call it out in the review and suggest extracting smaller components/helpers.
- Structure: Encourage separation of concerns (UI vs. business logic vs. API calls). Suggest moving complex logic into composables/utilities instead of keeping it inline in components.
- Testing: For non‑trivial logic, look for or suggest unit tests (or at least clear seams where tests could be added) rather than relying only on manual UI testing.
- Accessibility: For UI changes, check for a11y basics (focus management, keyboard navigation, ARIA/labels where needed, color contrast).
- Consistency: Prefer existing project patterns (folder structure, naming, hooks/composables usage) over introducing new one‑off patterns without strong justification.

Output format:

- List specific comments for each file/line that needs attention
- Don't list things that are already perfect
- In the end, summarize with an overall assessment (approve, request changes, or comment) and list of changes suggested, if any.

Example output:
```
## File: src/components/InfoHeader.vue

**Line 89-91**: Consider extracting the selectable wrapper into a reusable component if this pattern is used elsewhere.

**Line 524-535**: The CSS vendor prefixes are good for compatibility. Consider removing `-khtml-user-select` as Konqueror is no longer maintained.

## File: src/composables/userPreferences.ts

**Line 45**: Missing error handling for API call failure. Consider adding try-catch or error handling.

**Line 78**: Type assertion could be more specific. Consider using a type guard instead of `as`.

## Overall Assessment: Request Changes

**Critical Issues:**
- [CRITICAL] Missing error handling in userPreferences.ts line 45 could cause unhandled exceptions

**Problems:**
- [PROBLEM] File src/components/InfoHeader.vue exceeds 300 lines (554 lines). Consider extracting sub-components or composables.

**Suggestions:**
- [SUGGESTION] Remove outdated `-khtml-user-select` vendor prefix in InfoHeader.vue
- [SUGGESTION] Extract selectable text wrapper into reusable component if pattern repeats
- [SUGGESTION] Add unit tests for userPreferences composable error scenarios
```
