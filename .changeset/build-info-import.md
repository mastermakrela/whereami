---
"vite-plugin-whereami": minor
---

SvelteKit apps can now feed `whereamiHandle()` from the `whereami()` Vite plugin via `import build from "vite-plugin-whereami/build"` — the build-time environment plus name, version and commit — and `badgeEndpoint: true` serves the badge at `/_whereami/badge.svg` labelled with the environment, whose key is now the default label instead of `"deployed"`.
