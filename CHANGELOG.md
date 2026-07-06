# vite-plugin-whereami

## 0.3.2

### Patch Changes

- 1035113: Fix `whereamiHandle()` (the SvelteKit entry) falling back to `app@0.0.0` on edge/isolate runtimes (Cloudflare Workers, Vercel Edge, Deno Deploy) — it previously resolved package name/version by reading `package.json` off disk at request time, which those runtimes have no filesystem for.

  The `whereami()` Vite plugin now bakes the resolved name/version into the server bundle at build time (via a `define`, injected whether or not you use it for HTML injection), so keeping it in `vite.config.ts` alongside `sveltekit()` is enough to fix this with no code changes. Also added a `pkg: { name, version }` option to override it directly, on either entry point.

## 0.3.1

### Patch Changes

- 65c2f20: Widen the `vite` peer dependency range to include `^8.0.0`. The plugin's build/dev-server behavior is unchanged and works correctly under Vite 8 — the peer range just hadn't been updated since Vite 8 shipped, which broke `npm install` with `ERESOLVE` for anyone on it (e.g. via `@sveltejs/kit`'s own `vite: ^8.0.0` peer range).

## 0.3.0

### Minor Changes

- 702104d: Add real SvelteKit support via a new `vite-plugin-whereami/sveltekit` entry point exporting `whereamiHandle()`. The Vite plugin itself was a documented but silent no-op under SvelteKit — SvelteKit's own Vite integration forces `appType: "custom"`, so Vite's `transformIndexHtml` hook (the only mechanism the plugin used) never runs there. `whereamiHandle()` does the same favicon/title/banner/badge injection through SvelteKit's `transformPageChunk` instead, wired up in `hooks.server.ts` via `sequence()`.

  Also fixes a stale JSDoc comment on `WhereAmIOptions.detect` (shipped in `dist/index.d.ts`) that omitted the Vercel/Cloudflare Pages platform-detection step from its documented default order — the behavior itself was already correct, only the type's doc comment was out of date.

## 0.2.1

### Patch Changes

- bacfc35: Fix several correctness and robustness bugs found during a code review:

  - The console banner and on-screen badge no longer break out of their inline `<script>` tag when a `metadata` value contains `</script>` (could otherwise inject arbitrary HTML/script into the page).
  - `favicon.path` pointing at a nonexistent file now throws a clear error instead of crashing the build/dev server with a raw `ENOENT`.
  - A transient favicon read failure (e.g. a momentarily locked file) no longer permanently breaks every later page load — the cache is only poisoned by success, not by a one-off failure.
  - `vite build --watch` now picks up favicon changes correctly: the favicon is only recomputed when its actual source file changes (via `addWatchFile`/`watchChange`), instead of always using the first build's result or recomputing on every unrelated rebuild.
  - The title prefix is applied to `<title>` tags that have attributes (e.g. `<title lang="en">`), which previously silently failed to match.
  - Misconfigured or unreadable `package.json` (wrong `packageJsonPath`, invalid JSON) now logs a warning instead of silently falling back to `app@0.0.0`.

## 0.2.0

### Minor Changes

- 2ca0399: Add an on-screen corner badge (a colored triangle, bottom-left, click to open a `<pre>` detail panel — dismissible via close button, click-away, or Escape) and a `metadata` option for custom data that shows up in both the console banner and the badge panel. Like the favicon/title, the badge only renders when the environment has a `color`, so prod stays a no-op by default.

## 0.1.1

### Patch Changes

- 52ec4ca: Fix the built-in Node platform detector misclassifying every `vite build --mode staging`/`--mode development` as `prod`. Vite's `build` command force-sets `NODE_ENV=production` internally regardless of `--mode`, so the detector now only trusts `NODE_ENV` during `vite dev`/serve, where Vite leaves it alone.
