---
"vite-plugin-whereami": patch
---

Simplify how `whereamiHandle()` gets the package name/version on edge runtimes, and drop the build-time bundling machinery behind it.

Previous releases baked the name/version into a `__WHEREAMI_PKG__` global via the `whereami()` Vite plugin's `define`, and (in an unreleased change) forced the plugin into the SSR bundle with `ssr.noExternal` so that `define` would actually reach the code. That was fragile (it depended on Vite's SSR-externalization heuristic) and, on Cloudflare, pulled the `pngjs` favicon dependency into the Worker bundle, requiring `nodejs_compat`.

Instead, import `name`/`version` from your `package.json` in `hooks.server.ts` and pass them as `pkg` — that inlines the values into your always-bundled server code at build time, with no `define`, no forced bundling, and no `nodejs_compat` requirement:

```ts
import { name, version } from "../package.json";
export const handle = whereamiHandle({ pkg: { name, version } });
```

Under SvelteKit you no longer need `whereami()` in `vite.config.ts` at all. Omitting `pkg` still falls back to reading `package.json` off disk at request time (fine on Node, `app@0.0.0` on edge).

`pngjs` (used only to tint `.png` favicons) is now loaded via dynamic `import()`, so it — and its `zlib`/`util`/`buffer` needs — only get pulled into the bundle when a `.png` favicon is actually tinted. The default generated SVG letter icon no longer drags them in, so a SvelteKit-on-Cloudflare project using the default favicon doesn't need `nodejs_compat` for whereami's sake.
