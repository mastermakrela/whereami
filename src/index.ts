import type { Plugin, ResolvedConfig } from "vite";
import { loadEnv } from "vite";
import { defaultDetect } from "./detect.js";
import {
	type FaviconResult,
	faviconMimeType,
	findFaviconSource,
	resolveFavicon,
} from "./favicon.js";
import {
	applyTitlePrefix,
	badgeTag,
	consoleBannerTag,
	faviconLinkTag,
	metaTags,
	stripFaviconLinks,
} from "./html.js";
import { DEFAULT_ENVIRONMENTS, resolveBanner, resolveBadge } from "./options.js";
import { type PkgInfo, readPkgInfo } from "./pkg.js";
import type { EnvironmentConfig, WhereAmIOptions } from "./types.js";

export type {
	WhereAmIOptions,
	EnvironmentConfig,
	DetectContext,
	FaviconOptions,
	BannerOptions,
	BadgeOptions,
	BadgeEndpointOptions,
} from "./types.js";

const FAVICON_BASENAME = "__whereami-favicon";

function faviconFileNameFor(ext: "svg" | "png"): string {
	return `${FAVICON_BASENAME}.${ext}`;
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
				const source = await findFaviconSource(root, options.favicon);
				faviconSourcePath = source;
				return resolveFavicon(source, envConfig.color, pkg.name);
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

		// Read package.json here so the letter favicon, console banner, and badge can label
		// themselves with the app's name/version — `config.root` is already resolved to an
		// absolute path by this point. (Under SvelteKit this plugin is a no-op — the HTML
		// injection happens in `whereamiHandle()` instead; see the
		// `vite-plugin-whereami/sveltekit` entry point.)
		async configResolved(config: ResolvedConfig) {
			root = config.root;
			base = config.base;
			command = config.command;
			pkg = options.pkg ?? (await readPkgInfo(root, options.packageJsonPath));
			const env = loadEnv(config.mode, root, "");
			envKey = detect({ mode: config.mode, command, env });
			envConfig = environments[envKey] ?? {};
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
