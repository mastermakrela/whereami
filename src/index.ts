import type { Plugin, ResolvedConfig } from "vite";
import { loadEnv } from "vite";
import { defaultDetect } from "./detect.js";
import {
	type FaviconResult,
	UnsupportedFaviconError,
	faviconMimeType,
	findFaviconSource,
	generateDefaultIcon,
	tintFavicon,
} from "./favicon.js";
import {
	applyTitlePrefix,
	badgeTag,
	consoleBannerTag,
	faviconLinkTag,
	metaTags,
	stripFaviconLinks,
} from "./html.js";
import { type PkgInfo, readPkgInfo } from "./pkg.js";
import type {
	EnvironmentConfig,
	ResolvedBadgeOptions,
	ResolvedBannerOptions,
	WhereAmIOptions,
} from "./types.js";

export type {
	WhereAmIOptions,
	EnvironmentConfig,
	DetectContext,
	FaviconOptions,
	BannerOptions,
	BadgeOptions,
} from "./types.js";

const DEFAULT_ENVIRONMENTS: Record<string, EnvironmentConfig> = {
	prod: {},
	staging: { color: "#f59e0b", titlePrefix: "🟠 " },
	dev: { color: "#22c55e", titlePrefix: "🟢 " },
};

const FAVICON_BASENAME = "__whereami-favicon";

function faviconFileNameFor(ext: "svg" | "png"): string {
	return `${FAVICON_BASENAME}.${ext}`;
}

function resolveBanner(banner: WhereAmIOptions["banner"]): ResolvedBannerOptions {
	const opts = typeof banner === "object" ? banner : {};
	const enabled = banner !== false && (opts.enabled ?? true);
	return {
		enabled,
		meta: enabled && (opts.meta ?? true),
		console: enabled && (opts.console ?? true),
		metaPrefix: opts.metaPrefix ?? "app",
	};
}

function resolveBadge(badge: WhereAmIOptions["badge"]): ResolvedBadgeOptions {
	const opts = typeof badge === "object" ? badge : {};
	return { enabled: badge !== false && (opts.enabled ?? true) };
}

function joinUrl(base: string, fileName: string): string {
	return `${base.replace(/\/+$/, "")}/${fileName}`;
}

export default function whereami(options: WhereAmIOptions = {}): Plugin {
	const detect = options.detect ?? defaultDetect;
	const environments = { ...DEFAULT_ENVIRONMENTS, ...options.environments };
	const banner = resolveBanner(options.banner);
	const badge = resolveBadge(options.badge);
	const metadata = options.metadata ?? {};
	const faviconEnabled = options.favicon?.enabled ?? true;

	let root: string;
	let base: string;
	let command: "build" | "serve";
	let envKey: string;
	let envConfig: EnvironmentConfig;
	let pkg: PkgInfo;
	let faviconPromise: Promise<FaviconResult | null> | null = null;
	let faviconSourcePath: string | null = null;

	function invalidateFavicon(): void {
		faviconPromise = null;
	}

	function computeFavicon(): Promise<FaviconResult | null> {
		if (!faviconPromise) {
			const promise: Promise<FaviconResult | null> = (async () => {
				if (!faviconEnabled || !envConfig.color) return null;
				const color = envConfig.color;
				const source = await findFaviconSource(root, options.favicon);
				faviconSourcePath = source;
				if (!source) return { ext: "svg", content: generateDefaultIcon(color, pkg.name) };
				try {
					return await tintFavicon(source, color);
				} catch (err) {
					if (err instanceof UnsupportedFaviconError) {
						console.warn(
							`[vite-plugin-whereami] ${err.message} — generating a default icon instead`,
						);
						return { ext: "svg", content: generateDefaultIcon(color, pkg.name) };
					}
					throw err;
				}
			})();
			faviconPromise = promise.catch((err) => {
				// Don't cache a rejected promise forever — a transient failure (locked file,
				// momentary EMFILE) shouldn't permanently break every future request.
				invalidateFavicon();
				throw err;
			});
		}
		return faviconPromise;
	}

	return {
		name: "vite-plugin-whereami",

		async configResolved(config: ResolvedConfig) {
			root = config.root;
			base = config.base;
			command = config.command;
			const env = loadEnv(config.mode, root, "");
			envKey = detect({ mode: config.mode, command, env });
			envConfig = environments[envKey] ?? {};
			pkg = await readPkgInfo(root, options.packageJsonPath);
		},

		async buildStart() {
			if (command !== "build") return;
			const favicon = await computeFavicon();
			// `vite build --watch` reuses this plugin instance across rebuilds — watch the
			// actual favicon source so we only recompute when it (not unrelated files) changes.
			if (faviconSourcePath) this.addWatchFile(faviconSourcePath);
			if (!favicon) return;
			this.emitFile({
				type: "asset",
				fileName: faviconFileNameFor(favicon.ext),
				source: favicon.content,
			});
		},

		watchChange(id) {
			if (id === faviconSourcePath) invalidateFavicon();
		},

		configureServer(server) {
			const faviconUrlPrefix = joinUrl(base, FAVICON_BASENAME);
			server.middlewares.use((req, res, next) => {
				const url = req.url?.split("?")[0];
				if (!url?.startsWith(faviconUrlPrefix)) return next();
				computeFavicon()
					.then((favicon) => {
						if (!favicon || url !== joinUrl(base, faviconFileNameFor(favicon.ext))) return next();
						res.setHeader("Content-Type", faviconMimeType(favicon.ext));
						res.end(favicon.content);
					})
					.catch(next);
			});
		},

		async transformIndexHtml(html) {
			let out = applyTitlePrefix(html, envConfig.titlePrefix ?? "");
			const tags = [];

			const favicon = await computeFavicon();
			if (favicon) {
				out = stripFaviconLinks(out);
				tags.push(faviconLinkTag(joinUrl(base, faviconFileNameFor(favicon.ext)), favicon.ext));
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

			return { html: out, tags };
		},
	};
}
