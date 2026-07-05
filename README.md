# vite-plugin-whereami

Tints your favicon and prefixes the page title per environment, so you never
mistake a staging tab for prod again — plus an optional build-info banner
(name/version/environment) in `<head>` and the browser console.

Inspired by [this tip](https://x.com/dferber90) about using a different favicon
per environment to keep tabs visually distinct.

## Install

```sh
bun add -D vite-plugin-whereami
```

## Quick start

```ts
// vite.config.ts
import { defineConfig } from "vite";
import whereami from "vite-plugin-whereami";

export default defineConfig({
	plugins: [whereami()],
});
```

That's it. By default:

- **prod** (`vite build`, i.e. `mode: "production"`) — no changes at all.
- **staging** (`vite build --mode staging`) — 🟠 orange favicon tint + `🟠 ` title prefix.
- **dev** (`vite dev`, or any other/unknown mode) — 🟢 green favicon tint + `🟢 ` title prefix.

Unknown modes default to `dev`'s tint on purpose — the whole point is to make it
obvious when you're _not_ looking at production, so an unrecognized mode should
look suspicious, not blend in.

If your project already has a favicon (`<link rel="icon">` in `index.html`, or
`public/favicon.{svg,png}`), it gets tinted (hue/saturation swapped for the
environment color, lightness preserved — a shape-preserving recolor, not a
flat overlay). If there's none, a simple icon is generated using the first
letter of your `package.json` name.

## Environment detection

By default, whereami checks, in order:

1. the `WHEREAMI_ENV` environment variable, if set
2. Vite's `mode`: `"production"` → `prod`, `"staging"` → `staging`, anything else → `dev`

You can fully replace this with your own function — return any string key,
matched against `environments`:

```ts
whereami({
	detect: ({ mode, command, env }) => {
		if (env.VERCEL_ENV === "preview") return "staging";
		return mode === "production" ? "prod" : "dev";
	},
});
```

## Custom environments

```ts
whereami({
	environments: {
		prod: {}, // no color/titlePrefix = no changes
		staging: { color: "#f59e0b", titlePrefix: "🟠 [staging] " },
		dev: { color: "#22c55e", titlePrefix: "🟢 [dev] " },
		qa: { color: "#a855f7", titlePrefix: "🟣 [qa] " },
	},
	detect: ({ mode }) => (mode === "qa" ? "qa" : undefined) ?? "prod",
});
```

Any environment whose config has no `color` gets no favicon change, and no
`titlePrefix` gets no title change — this is how `prod` stays a no-op by
default without special-casing it in the plugin itself.

## Favicon options

```ts
whereami({
	favicon: {
		enabled: true, // set false to disable favicon tinting/generation entirely
		path: "public/logo.svg", // explicit source; auto-detected otherwise
	},
});
```

Only `.svg` and `.png` sources are supported. `.ico` (or anything else) falls
back to generating the default letter icon, with a console warning.

## Build-info banner

Injects `<meta>` tags and a styled `console.log` with your package's name,
version, and detected environment — in **every** environment, including prod,
unless you disable it:

```ts
whereami({
	banner: {
		enabled: true, // master switch
		meta: true, // <meta name="app-name" content="..."> etc.
		console: true, // the console.log banner
		metaPrefix: "app", // -> app-name, app-version, app-environment
	},
});

// or shorthand to disable everything:
whereami({ banner: false });
```

## SvelteKit

Works the same way — add it to `vite.config.ts`:

```ts
import { sveltekit } from "@sveltejs/kit/vite";
import { defineConfig } from "vite";
import whereami from "vite-plugin-whereami";

export default defineConfig({
	plugins: [sveltekit(), whereami()],
});
```

## Full options reference

```ts
interface WhereAmIOptions {
	detect?: (ctx: {
		mode: string;
		command: "build" | "serve";
		env: Record<string, string>;
	}) => string;
	environments?: Record<string, { color?: string; titlePrefix?: string }>;
	favicon?: { enabled?: boolean; path?: string };
	banner?: boolean | { enabled?: boolean; meta?: boolean; console?: boolean; metaPrefix?: string };
	packageJsonPath?: string; // default: "package.json"
}
```

## Development

```sh
bun install
bun run test          # vitest (unit + integration against fixture vite projects)
bun run build         # tsup -> dist/
bun run typecheck
bun run lint          # oxlint
bun run format:check  # oxfmt --check
```

`playground-app/` is a throwaway Vite project (gitignored) useful for manual
checks: `bunx vite playground-app` or `bunx vite build playground-app --mode staging`.

## Releasing

This repo uses [Changesets](https://github.com/changesets/changesets) +
GitHub Actions to publish to npm. One-time setup after you've connected the
GitHub repo:

1. Create an npm [automation access token](https://docs.npmjs.com/creating-and-viewing-access-tokens)
   for this package (or your account/org).
2. Add it as a repository secret named `NPM_TOKEN`
   (Settings → Secrets and variables → Actions).
3. Push to `main`. The very first `npm publish` needs to exist before npm
   will accept further pushes to the same name — if `vite-plugin-whereami`
   isn't already the name you're publishing under, update `name` in
   `package.json` first.

From then on:

1. Run `bun run changeset` to describe your change (patch/minor/major + summary).
2. Commit the generated `.changeset/*.md` file and push/merge to `main`.
3. The `Release` workflow opens a "Version Packages" PR aggregating pending
   changesets. Merging that PR publishes the new version to npm automatically
   (with [provenance](https://docs.npmjs.com/generating-provenance-statements)).

## License

MIT
