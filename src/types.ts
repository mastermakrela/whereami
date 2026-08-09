import type { PkgInfo } from "./pkg.js";

export interface EnvironmentConfig {
	/**
	 * Hex color (e.g. "#f59e0b") used to tint the favicon and color the banner.
	 * Leave unset to keep the favicon completely untouched (this is the "prod" default).
	 */
	color?: string;
	/**
	 * Text prepended to `<title>`, e.g. "🟠 [staging] ".
	 * Leave unset to keep the title completely untouched (this is the "prod" default).
	 */
	titlePrefix?: string;
}

export interface DetectContext {
	/** The resolved Vite mode, e.g. "development", "production", or a custom `--mode` value. */
	mode: string;
	command: "build" | "serve";
	/** Loaded env vars (`.env*` files + `process.env`), same shape as `loadEnv()` returns. */
	env: Record<string, string>;
}

export interface FaviconOptions {
	/** Set to `false` to disable favicon generation/tinting entirely. Default: `true`. */
	enabled?: boolean;
	/**
	 * Path to the source favicon, relative to the project root.
	 * When omitted, whereami looks for an existing `<link rel="icon">` in `index.html`,
	 * then falls back to `public/favicon.svg`, `public/favicon.png`, `public/favicon.ico`.
	 * If nothing is found, a simple default icon is generated.
	 */
	path?: string;
}

export interface BannerOptions {
	/** Master switch for the whole banner feature. Default: `true`. */
	enabled?: boolean;
	/** Inject `<meta>` tags with name/version/environment into `<head>`. Default: `true`. */
	meta?: boolean;
	/** Prefix used for the injected meta tag names, e.g. "app" -> `app-name`. Default: `"app"`. */
	metaPrefix?: string;
	/** Print a styled `console.log` banner in the browser, in every environment including prod. Default: `true`. */
	console?: boolean;
}

export interface BadgeOptions {
	/**
	 * Master switch for the on-screen corner badge. Default: `true`.
	 * Like the favicon/title, it only renders when the environment has a `color`
	 * (prod stays a no-op by default).
	 */
	enabled?: boolean;
}

export interface BadgeEndpointOptions {
	/** Path the SVG is served from, e.g. "/_whereami/badge.svg". Setting this enables the feature. */
	path: string;
	/** Left-hand label. Default: "deployed". */
	label?: string;
	/** Which fields make up the right-hand value, in order. Default: ["version"]. */
	show?: Array<"name" | "version" | "environment">;
	/** Hex color for the right-hand side. Default: the environment color, else "#0b7285". */
	color?: string;
}

export interface WhereAmIOptions {
	/**
	 * Decide which environment we're running in. Return a key present in `environments`.
	 * Defaults to checking, in order: the `WHEREAMI_ENV` env var; known hosting platform env
	 * vars (Vercel's `VERCEL_ENV`, Cloudflare Pages' `CF_PAGES`/`CF_PAGES_BRANCH`); then Vite's
	 * `mode` (production -> "prod", staging -> "staging", everything else -> "dev").
	 */
	detect?: (ctx: DetectContext) => string;
	/**
	 * Per-environment overrides. Keys are free-form and matched against whatever `detect()` returns.
	 * Defaults to `{ prod: {}, staging: {...}, dev: {...} }` (prod makes no changes).
	 */
	environments?: Record<string, EnvironmentConfig>;
	favicon?: FaviconOptions;
	/** `false` disables the whole banner feature (shorthand for `{ enabled: false }`). */
	banner?: boolean | BannerOptions;
	/**
	 * `false` disables the on-screen corner badge (shorthand for `{ enabled: false }`).
	 * See `BadgeOptions`.
	 */
	badge?: boolean | BadgeOptions;
	/**
	 * Arbitrary extra data included alongside name/version/environment in the console
	 * banner and the badge's detail panel. Must be JSON-serializable.
	 */
	metadata?: Record<string, unknown>;
	/** Path to `package.json` used for the banner's name/version, relative to the project root. */
	packageJsonPath?: string;
	/**
	 * Provide the name/version directly instead of reading `package.json` off disk.
	 * Bypasses `packageJsonPath` and the filesystem entirely when set — required for
	 * `whereamiHandle()` on edge/isolate runtimes (Cloudflare Workers, Vercel Edge, Deno
	 * Deploy) where there's no real filesystem at request time.
	 */
	pkg?: PkgInfo;
	/**
	 * Serve an SVG status badge at a fixed path, for use as a repository badge image.
	 * Disabled unless set. SvelteKit only — see the `whereamiHandle` docs.
	 *
	 * The endpoint is **public and unauthenticated** — anyone who knows (or guesses) the
	 * path can request it, with no way to gate access. It deliberately exposes only the
	 * fields listed in `show` (name/version/environment) and nothing else: never
	 * `metadata`, never environment variables, never anything not explicitly listed.
	 */
	badgeEndpoint?: BadgeEndpointOptions;
}

export interface ResolvedBannerOptions {
	enabled: boolean;
	meta: boolean;
	metaPrefix: string;
	console: boolean;
}

export interface ResolvedBadgeOptions {
	enabled: boolean;
}

export interface ResolvedBadgeEndpointOptions {
	path: string;
	label: string;
	show: Array<"name" | "version" | "environment">;
	color?: string;
}
