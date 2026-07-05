import type { DetectContext } from "./types.js";

/**
 * Default environment detection.
 *
 * 1. `WHEREAMI_ENV` env var, if set, wins outright.
 * 2. Vite mode "production" -> "prod", "staging" -> "staging".
 * 3. Anything else (including plain "development" and custom modes) -> "dev".
 *
 * Unknown modes default to "dev" rather than "prod" on purpose: the whole point of this
 * plugin is to make it obvious when you're *not* looking at production, so an unrecognized
 * mode should look suspicious, not blend in.
 */
export function defaultDetect({ mode, env }: DetectContext): string {
	const explicit = env.WHEREAMI_ENV;
	if (explicit) return explicit;

	if (mode === "production") return "prod";
	if (mode === "staging") return "staging";
	return "dev";
}
