import type { Plugin, ResolvedConfig } from "vite";
import { loadEnv } from "vite";
import { defaultDetect } from "./detect.js";
import {
	type FaviconResult,
	UnsupportedFaviconError,
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
import { readPkgInfo } from "./pkg.js";
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

function resolveBanner(banner: WhereAmIOptions["banner"]): ResolvedBannerOptions {
	if (banner === false) {
		return { enabled: false, meta: false, console: false, metaPrefix: "app" };
	}
	const opts = banner === true || banner === undefined ? {} : banner;
	const enabled = opts.enabled ?? true;
	return {
		enabled,
		meta: enabled && (opts.meta ?? true),
		console: enabled && (opts.console ?? true),
		metaPrefix: opts.metaPrefix ?? "app",
	};
}

function resolveBadge(badge: WhereAmIOptions["badge"]): ResolvedBadgeOptions {
	if (badge === false) return { enabled: false };
	const opts = badge === true || badge === undefined ? {} : badge;
	return { enabled: opts.enabled ?? true };
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
	let pkg: { name: string; version: string };
	let faviconPromise: Promise<FaviconResult | null> | null = null;
	let faviconFileName: string | null = null;

	function computeFavicon(): Promise<FaviconResult | null> {
		if (!faviconPromise) {
			faviconPromise = (async () => {
				if (!faviconEnabled || !envConfig.color) return null;
				const color = envConfig.color;
				const source = await findFaviconSource(root, options.favicon);
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
			if (!favicon) return;
			faviconFileName = `${FAVICON_BASENAME}.${favicon.ext}`;
			this.emitFile({ type: "asset", fileName: faviconFileName, source: favicon.content });
		},

		configureServer(server) {
			server.middlewares.use((req, res, next) => {
				computeFavicon()
					.then((favicon) => {
						if (!favicon) return next();
						const url = req.url?.split("?")[0];
						if (url !== joinUrl(base, `${FAVICON_BASENAME}.${favicon.ext}`)) return next();
						res.setHeader("Content-Type", favicon.ext === "svg" ? "image/svg+xml" : "image/png");
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
				const fileName = faviconFileName ?? `${FAVICON_BASENAME}.${favicon.ext}`;
				tags.push(faviconLinkTag(joinUrl(base, fileName), favicon.ext));
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
