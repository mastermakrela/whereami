---
"vite-plugin-whereami": minor
---

Add an opt-in `badgeEndpoint` option to `whereamiHandle()` that serves an SVG status badge at a fixed path, e.g. `/_whereami/badge.svg`. Point a GitLab/GitHub project badge at it to show the _live_ deployed version straight from the running app — no third-party badge service needed.

```ts
whereamiHandle({
	pkg: { name, version },
	badgeEndpoint: { path: "/_whereami/badge.svg" },
});
```

The endpoint is public and unauthenticated once enabled, and only ever renders the fields listed in `show` (default: `["version"]`; also available: `"name"`, `"environment"`) — never `metadata`, never environment variables. Responses are served with `cache-control: no-cache` and a deterministic `ETag` so the badge never goes stale behind a cache but repeat requests can still get a cheap `304`.

SvelteKit only, since a plain Vite app is just static files in production with no server left at request time to answer the request.
