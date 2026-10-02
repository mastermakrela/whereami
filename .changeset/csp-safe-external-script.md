---
"vite-plugin-whereami": minor
---

SvelteKit handle serves its banner/badge/title-keeper as one external script instead of inline `<script>` tags, so pages with a nonce-based or `'self'`-only Content-Security-Policy no longer block them.
