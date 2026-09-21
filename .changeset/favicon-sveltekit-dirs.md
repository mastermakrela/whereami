---
"vite-plugin-whereami": patch
---

Favicon auto-detection now also looks in SvelteKit's `static/` dir and at `src/lib/assets/favicon.{svg,png}`, the path `sv create` scaffolds the favicon from. Previously only `public/favicon.{svg,png,ico}` was checked, so a SvelteKit app's brand favicon went undetected and got silently replaced by the generated letter icon. `public/` is still checked first, so Vite apps are unaffected.
