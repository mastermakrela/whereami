---
"vite-plugin-whereami": patch
---

Fix the published types for CommonJS and node10 consumers: `require()` now resolves to `.d.cts` declarations (it used to get the ESM `.d.ts`), and `vite-plugin-whereami/sveltekit` now resolves under `moduleResolution: "node10"`.
