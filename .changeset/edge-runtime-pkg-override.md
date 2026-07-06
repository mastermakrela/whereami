---
"vite-plugin-whereami": patch
---

Fix `whereamiHandle()` (the SvelteKit entry) falling back to `app@0.0.0` on edge/isolate runtimes (Cloudflare Workers, Vercel Edge, Deno Deploy) — it previously resolved package name/version by reading `package.json` off disk at request time, which those runtimes have no filesystem for.

The `whereami()` Vite plugin now bakes the resolved name/version into the server bundle at build time (via a `define`, injected whether or not you use it for HTML injection), so keeping it in `vite.config.ts` alongside `sveltekit()` is enough to fix this with no code changes. Also added a `pkg: { name, version }` option to override it directly, on either entry point.
