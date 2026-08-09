import type {
	EnvironmentConfig,
	ResolvedBadgeEndpointOptions,
	ResolvedBadgeOptions,
	ResolvedBannerOptions,
	WhereAmIOptions,
} from "./types.js";

export const DEFAULT_ENVIRONMENTS: Record<string, EnvironmentConfig> = {
	prod: {},
	staging: { color: "#f59e0b", titlePrefix: "🟠 " },
	dev: { color: "#22c55e", titlePrefix: "🟢 " },
};

export function resolveBanner(banner: WhereAmIOptions["banner"]): ResolvedBannerOptions {
	const opts = typeof banner === "object" ? banner : {};
	const enabled = banner !== false && (opts.enabled ?? true);
	return {
		enabled,
		meta: enabled && (opts.meta ?? true),
		console: enabled && (opts.console ?? true),
		metaPrefix: opts.metaPrefix ?? "app",
	};
}

export function resolveBadge(badge: WhereAmIOptions["badge"]): ResolvedBadgeOptions {
	const opts = typeof badge === "object" ? badge : {};
	return { enabled: badge !== false && (opts.enabled ?? true) };
}

export function resolveBadgeEndpoint(
	options: WhereAmIOptions["badgeEndpoint"],
): ResolvedBadgeEndpointOptions | null {
	// An empty/blank `path` (an unset env var threaded into the config, say) would normalize to
	// "/" and make the badge swallow the site root — treat it as "not configured" instead.
	if (!options) return null;
	const raw = options.path.trim();
	if (!raw || raw === "/") return null;
	const path = raw.startsWith("/") ? raw : `/${raw}`;
	return {
		path,
		label: options.label ?? "deployed",
		show: options.show ?? ["version"],
		color: options.color,
	};
}
