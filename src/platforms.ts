/**
 * Internal, ordered list of "does this look like platform X, and if so which environment
 * are we in" heuristics. Not part of the public API — consumers who want full control
 * already have the `detect` option for that. This is just what `defaultDetect` falls
 * back on, and a place to add more platforms later without touching `detect.ts`.
 *
 * Order matters: more specific platform signals must run before the generic Node
 * fallback, since most platforms also set `NODE_ENV=production` for preview/staging
 * builds — checking that first would misclassify every preview deploy as prod.
 */
export interface PlatformDetector {
	name: string;
	/** Return an environment key, or `undefined` to defer to the next detector. */
	detect: (env: Record<string, string>) => string | undefined;
}

const vercel: PlatformDetector = {
	name: "vercel",
	detect: (env) => {
		if (env.VERCEL !== "1") return undefined;
		// https://vercel.com/docs/environment-variables/system-environment-variables
		switch (env.VERCEL_ENV) {
			case "production":
				return "prod";
			case "preview":
				return "staging";
			case "development":
				return "dev";
			default:
				return undefined;
		}
	},
};

const PRODUCTION_BRANCHES = new Set(["main", "master"]);

const cloudflarePages: PlatformDetector = {
	name: "cloudflare-pages",
	detect: (env) => {
		if (env.CF_PAGES !== "1") return undefined;
		// https://developers.cloudflare.com/pages/configuration/build-configuration/#environment-variables
		// Pages doesn't expose an explicit prod/preview flag, only the branch name, so we
		// treat the conventional default-branch names as prod and everything else as staging.
		return PRODUCTION_BRANCHES.has(env.CF_PAGES_BRANCH ?? "") ? "prod" : "staging";
	},
};

const node: PlatformDetector = {
	name: "node",
	detect: (env) => (env.NODE_ENV === "production" ? "prod" : undefined),
};

export const PLATFORM_DETECTORS: PlatformDetector[] = [vercel, cloudflarePages, node];
