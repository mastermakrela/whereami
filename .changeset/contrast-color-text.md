---
"vite-plugin-whereami": patch
---

The console banner's environment segment and the badge panel's header now set `color: contrast-color(<environment color>)` after the fixed `#111`, so browsers that support `contrast-color()` pick black or white text per environment colour (a dark `color` no longer gives black-on-navy); others keep the previous look. The panel's close button inherits that colour.
