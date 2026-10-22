---
"vite-plugin-whereami": minor
---

SvelteKit apps can now feed `whereamiHandle()` from the `whereami()` Vite plugin via `import build from "vite-plugin-whereami/build"` — the build-time environment plus name, version and commit — and `badgeEndpoint: true` serves the badge at `/_whereami/badge.svg`; **breaking:** the badge's default label is now the environment key instead of `"deployed"`, so set `label: "deployed"` to keep it.
