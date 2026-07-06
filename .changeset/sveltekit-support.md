---
"vite-plugin-whereami": minor
---

Add real SvelteKit support via a new `vite-plugin-whereami/sveltekit` entry point exporting `whereamiHandle()`. The Vite plugin itself was a documented but silent no-op under SvelteKit — SvelteKit's own Vite integration forces `appType: "custom"`, so Vite's `transformIndexHtml` hook (the only mechanism the plugin used) never runs there. `whereamiHandle()` does the same favicon/title/banner/badge injection through SvelteKit's `transformPageChunk` instead, wired up in `hooks.server.ts` via `sequence()`.

Also fixes a stale JSDoc comment on `WhereAmIOptions.detect` (shipped in `dist/index.d.ts`) that omitted the Vercel/Cloudflare Pages platform-detection step from its documented default order — the behavior itself was already correct, only the type's doc comment was out of date.
