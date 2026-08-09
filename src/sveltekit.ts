import type { Handle } from "@sveltejs/kit";
import { FALLBACK_COLOR, renderBadgeSvg } from "./badge-svg.js";
import { defaultDetect } from "./detect.js";
import { faviconMimeType, findFaviconSource, resolveFavicon } from "./favicon.js";
import {
	applyTitlePrefix,
	badgeTag,
	consoleBannerTag,
	faviconLinkTag,
	injectIntoHead,
	metaTags,
	stripFaviconLinks,
} from "./html.js";
import {
	DEFAULT_ENVIRONMENTS,
	resolveBadge,
	resolveBadgeEndpoint,
	resolveBanner,
} from "./options.js";
import { type PkgInfo, readPkgInfo } from "./pkg.js";
import type {
	DetectContext,
	EnvironmentConfig,
	ResolvedBadgeEndpointOptions,
	WhereAmIOptions,
} from "./types.js";

interface FaviconTag {
	href: string;
	ext: "svg" | "png";
}

/**
 * Small non-cryptographic hash (32-bit FNV-1a) used only to derive a deterministic `ETag`
 * for the badge SVG. `node:crypto` is deliberately avoided so this keeps working on
 * edge/isolate runtimes (Cloudflare Workers, Vercel Edge, Deno Deploy) that don't have it.
 */
function fnv1aHex(input: string): string {
	let hash = 0x811c9dc5;
	for (let i = 0; i < input.length; i++) {
		hash ^= input.charCodeAt(i);
		hash = Math.imul(hash, 0x01000193);
	}
	return (hash >>> 0).toString(16).padStart(8, "0");
}

/**
 * `If-None-Match` is a *list* of entity-tags, and proxies that re-encode the body (Cloudflare
 * gzipping the SVG, for one) weaken a strong `"abc"` to `W/"abc"` on the way out — so the tag
 * coming back rarely equals the one we emitted byte-for-byte. Compare tag-by-tag, ignoring the
 * weakness prefix; `*` matches any current representation.
 */
function ifNoneMatchMatches(header: string | null, etag: string): boolean {
	if (!header) return false;
	return header.split(",").some((candidate) => {
		const tag = candidate.trim();
		return tag === "*" || tag.replace(/^W\//, "") === etag;
	});
}

/**
 * Only ever reads the fields named in `show` — never `metadata`, never `process.env`.
 * An unrecognized field name is dropped rather than silently rendering some other field.
 */
function badgeValue(
	pkg: PkgInfo,
	envKey: string,
	show: ResolvedBadgeEndpointOptions["show"],
): string {
	const fields: Record<string, string | undefined> = {
		name: pkg.name,
		version: pkg.version.startsWith("v") ? pkg.version : `v${pkg.version}`,
		environment: envKey,
	};
	return show
		.map((field) => fields[field])
		.filter((value): value is string => value !== undefined)
		.join(" ");
}

/**
 * SvelteKit never runs pages through Vite's `transformIndexHtml` (its own Vite plugin forces
 * `appType: "custom"`, which is what disables that hook), so the regular `whereami()` plugin
 * is a no-op there and isn't needed. This does the same favicon/title/banner/badge injection
 * through SvelteKit's own `transformPageChunk` instead — add it to `hooks.server.ts`:
 *
 * ```ts
 * import { sequence } from "@sveltejs/kit/hooks";
 * import { name, version } from "../package.json";
 * import { whereamiHandle } from "vite-plugin-whereami/sveltekit";
 *
 * export const handle = sequence(whereamiHandle({ pkg: { name, version } }), ...yourHandlers);
 * ```
 *
 * The `pkg` import is the reliable way to label the banner/badge on edge/isolate runtimes
 * (Cloudflare Workers, Vercel Edge, Deno Deploy) that have no filesystem at request time:
 * importing `package.json` inlines those strings into your (always-bundled) `hooks.server.ts`
 * at build time. Omit `pkg` and it falls back to reading `package.json` off disk at request
 * time — fine on Node-based deployments, but silently `app@0.0.0` on edge runtimes. A custom
 * `favicon.path` is likewise unreachable without a filesystem; the generated letter icon is
 * used instead, correctly once the name is resolved.
 *
 * Setting `badgeEndpoint` additionally serves an SVG status badge at a fixed path (e.g.
 * `/_whereami/badge.svg`) — point a GitLab/GitHub repository badge at it to show the *live*
 * deployed version, no third-party badge service required. It's opt-in (unset by default)
 * and, once enabled, **public and unauthenticated** — anyone who requests that path gets a
 * response, with no way to gate it here. It only ever renders the fields listed in `show`
 * (name/version/environment); `metadata` and everything else are never exposed. This exists
 * only here, not in the Vite plugin, because a plain Vite app is just static files in
 * production — there's no server left at request time to answer the request.
 */
export function whereamiHandle(options: WhereAmIOptions = {}): Handle {
	const detect = options.detect ?? defaultDetect;
	const environments = { ...DEFAULT_ENVIRONMENTS, ...options.environments };
	const banner = resolveBanner(options.banner);
	const badge = resolveBadge(options.badge);
	const badgeEndpoint = resolveBadgeEndpoint(options.badgeEndpoint);
	const metadata = options.metadata ?? {};
	const faviconEnabled = options.favicon?.enabled ?? true;
	const root = process.cwd();

	// There's no Vite "mode"/"command" at request time here (this runs in the already-built,
	// deployed server, not under Vite), so unlike the Vite plugin, NODE_ENV is trusted whenever
	// it says "production" — the `command === "serve"` gate in the built-in Node detector exists
	// only to work around `vite build` itself force-setting NODE_ENV=production, which doesn't
	// apply to a running server process.
	const ctx: DetectContext = {
		mode: process.env.NODE_ENV === "production" ? "production" : "development",
		command: "serve",
		env: process.env as Record<string, string>,
	};
	const envKey = detect(ctx);
	const envConfig: EnvironmentConfig = environments[envKey] ?? {};

	const pkgPromise: Promise<PkgInfo> = options.pkg
		? Promise.resolve(options.pkg)
		: readPkgInfo(root, options.packageJsonPath);
	let faviconPromise: Promise<FaviconTag | null> | null = null;
	let badgePromise: Promise<{ svg: string; etag: string }> | null = null;

	/**
	 * Every input (`pkg`, `envKey`, `badgeEndpoint`) is fixed for the lifetime of this handle and
	 * `renderBadgeSvg` is a pure function of them, so the SVG — and therefore its `ETag` — is
	 * byte-identical on every request. Build it once instead of re-rendering and re-hashing the
	 * same string for each badge hit.
	 */
	function computeBadge(
		endpoint: ResolvedBadgeEndpointOptions,
	): Promise<{ svg: string; etag: string }> {
		if (!badgePromise) {
			badgePromise = (async () => {
				const pkg = await pkgPromise;
				const svg = renderBadgeSvg({
					label: endpoint.label,
					value: badgeValue(pkg, envKey, endpoint.show),
					color: endpoint.color ?? envConfig.color ?? FALLBACK_COLOR,
				});
				return { svg, etag: `"${fnv1aHex(svg)}"` };
			})();
		}
		return badgePromise;
	}

	function computeFavicon(): Promise<FaviconTag | null> {
		if (!faviconPromise) {
			faviconPromise = (async () => {
				if (!faviconEnabled || !envConfig.color) return null;
				const source = await findFaviconSource(root, options.favicon);
				const pkg = await pkgPromise;
				const favicon = await resolveFavicon(source, envConfig.color as string, pkg.name);
				const buffer =
					typeof favicon.content === "string" ? Buffer.from(favicon.content) : favicon.content;
				return {
					href: `data:${faviconMimeType(favicon.ext)};base64,${buffer.toString("base64")}`,
					ext: favicon.ext,
				};
			})();
		}
		return faviconPromise;
	}

	return async ({ event, resolve }) => {
		if (badgeEndpoint && event.url.pathname === badgeEndpoint.path) {
			const { svg, etag } = await computeBadge(badgeEndpoint);
			const headers = {
				"content-type": "image/svg+xml; charset=utf-8",
				// The badge must always reflect the currently deployed version, never a stale one.
				"cache-control": "no-cache, max-age=0, must-revalidate",
				etag,
			};
			if (ifNoneMatchMatches(event.request.headers.get("if-none-match"), etag)) {
				return new Response(null, { status: 304, headers });
			}
			return new Response(svg, { headers });
		}

		const pkg = await pkgPromise;
		const favicon = await computeFavicon();

		return resolve(event, {
			transformPageChunk: ({ html }) => {
				// The `<head>` is sent as a single, complete chunk before any streamed body
				// content, so it's safe to string-match on it landing in one piece.
				if (!html.includes("</head>")) return html;

				let out = applyTitlePrefix(html, envConfig.titlePrefix ?? "");
				const tags = [];

				if (favicon) {
					out = stripFaviconLinks(out);
					tags.push(faviconLinkTag(favicon.href, favicon.ext));
				}

				if (banner.enabled) {
					tags.push(...metaTags(banner, pkg, envKey));
					if (banner.console) {
						tags.push(consoleBannerTag(pkg, envKey, envConfig.color ?? "#6b7280", metadata));
					}
				}

				if (badge.enabled && envConfig.color) {
					tags.push(badgeTag(pkg, envKey, envConfig.color, metadata));
				}

				return injectIntoHead(out, tags);
			},
		});
	};
}
