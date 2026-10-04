---
"vite-plugin-whereami": minor
---

Support SvelteKit 3: the `@sveltejs/kit` peer range is now `^2.0.0 || ^3.0.0`. `whereamiHandle()`'s return type is now SvelteKit's own `Handle` from whichever major is installed (kit 3 only exports it from `@sveltejs/kit/hooks`, kit 2 only from `@sveltejs/kit`), so it type-checks against `sequence()` and `Handle` annotations in both. Runtime behaviour is unchanged.
