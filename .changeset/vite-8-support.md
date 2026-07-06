---
"vite-plugin-whereami": patch
---

Widen the `vite` peer dependency range to include `^8.0.0`. The plugin's build/dev-server behavior is unchanged and works correctly under Vite 8 — the peer range just hadn't been updated since Vite 8 shipped, which broke `npm install` with `ERESOLVE` for anyone on it (e.g. via `@sveltejs/kit`'s own `vite: ^8.0.0` peer range).
