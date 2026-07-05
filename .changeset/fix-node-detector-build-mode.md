---
"vite-plugin-whereami": patch
---

Fix the built-in Node platform detector misclassifying every `vite build --mode staging`/`--mode development` as `prod`. Vite's `build` command force-sets `NODE_ENV=production` internally regardless of `--mode`, so the detector now only trusts `NODE_ENV` during `vite dev`/serve, where Vite leaves it alone.
