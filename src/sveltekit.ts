import type { Handle } from "@sveltejs/kit";
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
import { DEFAULT_ENVIRONMENTS, resolveBadge, resolveBanner } from "./options.js";
import { type PkgInfo, readPkgInfo } from "./pkg.js";
import type { DetectContext, EnvironmentConfig, WhereAmIOptions } from "./types.js";

interface FaviconTag {
	href: string;
	ext: "svg" | "png";
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
 */
export function whereamiHandle(options: WhereAmIOptions = {}): Handle {
	const detect = options.detect ?? defaultDetect;
	const environments = { ...DEFAULT_ENVIRONMENTS, ...options.environments };
	const banner = resolveBanner(options.banner);
	const badge = resolveBadge(options.badge);
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
