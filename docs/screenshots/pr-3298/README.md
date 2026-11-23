# Desktop saved-login review screenshots

These screenshots compare PR #3298 before and after its review follow-up. Both show the actual production frontend rendered in Chrome at 1365 × 900 in the light theme, using the same dummy account and disposable server/native bridge fixture. No real credentials are shown.

- [Before](before.png): PR head `3fcdcead4d4cfe139f6af178457112482ab1a4f5`, before replacing the raw saved-login controls.
- [After](after.png): review follow-up using the standard shadcn-vue Checkbox, Label, and Button components.

The native bridge is mocked for these visual captures. They document appearance, not OS credential-store or end-to-end authentication behavior.
