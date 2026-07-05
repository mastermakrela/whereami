---
"vite-plugin-whereami": patch
---

Fix several correctness and robustness bugs found during a code review:

- The console banner and on-screen badge no longer break out of their inline `<script>` tag when a `metadata` value contains `</script>` (could otherwise inject arbitrary HTML/script into the page).
- `favicon.path` pointing at a nonexistent file now throws a clear error instead of crashing the build/dev server with a raw `ENOENT`.
- A transient favicon read failure (e.g. a momentarily locked file) no longer permanently breaks every later page load — the cache is only poisoned by success, not by a one-off failure.
- `vite build --watch` now picks up favicon changes correctly: the favicon is only recomputed when its actual source file changes (via `addWatchFile`/`watchChange`), instead of always using the first build's result or recomputing on every unrelated rebuild.
- The title prefix is applied to `<title>` tags that have attributes (e.g. `<title lang="en">`), which previously silently failed to match.
- Misconfigured or unreadable `package.json` (wrong `packageJsonPath`, invalid JSON) now logs a warning instead of silently falling back to `app@0.0.0`.
