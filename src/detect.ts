import { PLATFORM_DETECTORS } from "./platforms.js";
import type { DetectContext, WhereAmIOptions } from "./types.js";

/**
 * Default environment detection.
 *
 * 1. `WHEREAMI_ENV` env var, if set, wins outright.
 * 2. Known hosting platform heuristics, in order (see `platforms.ts`): Vercel, Cloudflare
 *    Pages, then a generic Node `NODE_ENV=production` check.
 * 3. Vite mode "production" -> "prod", "staging" -> "staging".
 * 4. Anything else (including plain "development" and custom modes) -> "dev".
 *
 * Unknown modes default to "dev" rather than "prod" on purpose: the whole point of this
 * plugin is to make it obvious when you're *not* looking at production, so an unrecognized
 * mode should look suspicious, not blend in.
 */
export function defaultDetect(ctx: DetectContext): string {
	const explicit = ctx.env.WHEREAMI_ENV;
	if (explicit) return explicit;

	for (const platform of PLATFORM_DETECTORS) {
		const result = platform.detect(ctx);
		if (result) return result;
	}

	if (ctx.mode === "production") return "prod";
	if (ctx.mode === "staging") return "staging";
	return "dev";
}

/**
 * The detector both entry points use: the user's `detect` if given, else `environment` (the
 * key resolved at build time) unless `WHEREAMI_ENV` overrides it, else the default heuristics.
 */
export function resolveDetect(options: WhereAmIOptions): (ctx: DetectContext) => string {
	if (options.detect) return options.detect;
	const { environment } = options;
	if (!environment) return defaultDetect;
	return (ctx) => ctx.env.WHEREAMI_ENV || environment;
}
