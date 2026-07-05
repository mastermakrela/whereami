# vite-plugin-whereami

## 0.2.0

### Minor Changes

- 2ca0399: Add an on-screen corner badge (a colored triangle, bottom-left, click to open a `<pre>` detail panel — dismissible via close button, click-away, or Escape) and a `metadata` option for custom data that shows up in both the console banner and the badge panel. Like the favicon/title, the badge only renders when the environment has a `color`, so prod stays a no-op by default.

## 0.1.1

### Patch Changes

- 52ec4ca: Fix the built-in Node platform detector misclassifying every `vite build --mode staging`/`--mode development` as `prod`. Vite's `build` command force-sets `NODE_ENV=production` internally regardless of `--mode`, so the detector now only trusts `NODE_ENV` during `vite dev`/serve, where Vite leaves it alone.
