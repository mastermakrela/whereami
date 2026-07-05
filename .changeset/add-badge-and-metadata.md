---
"vite-plugin-whereami": minor
---

Add an on-screen corner badge (a colored triangle, bottom-left, click to open a `<pre>` detail panel — dismissible via close button, click-away, or Escape) and a `metadata` option for custom data that shows up in both the console banner and the badge panel. Like the favicon/title, the badge only renders when the environment has a `color`, so prod stays a no-op by default.
