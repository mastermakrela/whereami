---
"vite-plugin-whereami": patch
---

Fix `whereamiHandle()` breaking builds for runtimes without Node builtins. The `package.json` fallback statically imported `node:fs/promises`/`node:path`, and the favicon path pulled in `Buffer`, `process` and (transitively, via `pngjs`) `zlib`/`stream`/`util` — so bundling `vite-plugin-whereami/sveltekit` for Cloudflare Workers failed with _"add the nodejs_compat compatibility flag"_ over code paths that can never run there.

Those modules are now resolved at runtime only, behind a fallback: `whereamiHandle()` bundles and runs on workerd with **no `nodejs_compat` flag at all**. Behaviour on Node is unchanged; on a filesystem-less runtime it logs a one-time warning pointing at the `pkg: { name, version }` option and labels the app `app@0.0.0`, and a custom `favicon.path` falls back to the generated letter icon instead of throwing.
