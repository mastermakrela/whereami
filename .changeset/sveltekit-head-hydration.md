---
"vite-plugin-whereami": patch
---

Fix `whereamiHandle()` breaking Svelte 5 hydration when the favicon is declared in `<svelte:head>` (the default `sv create` scaffold). It used to delete the existing `<link rel="icon">` from the SSR head before injecting its own — if that link sat inside Svelte's head-hydration block, removing it shifted the hydration cursor onto the wrong node and threw `TypeError: element.getAttribute is not a function`, forcing a full client-side re-render. The existing link is now rewritten in place (`rel="icon"` renamed to `data-whereami-rel`, same position, same `href`) instead of removed, so hydration stays intact.

Also fix the `titlePrefix` disappearing right after hydration: Svelte's compiled `<title>` unconditionally sets `document.title` again once the page hydrates, silently overwriting the SSR-prefixed title. Both `whereamiHandle()` and the Vite plugin now also inject a small client-side script that keeps the prefix on `document.title` whenever it changes (hydration, or later client-side navigation).
