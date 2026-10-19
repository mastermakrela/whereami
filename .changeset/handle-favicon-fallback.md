---
"vite-plugin-whereami": patch
---

A missing or unreadable `favicon.path` no longer makes `whereamiHandle()` return a 500 for every page. It logs a warning and uses the generated letter icon instead (the Vite plugin still fails the build, as before).
