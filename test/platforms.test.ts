import { describe, expect, it } from "vitest";
import { PLATFORM_DETECTORS } from "../src/platforms.js";
import type { DetectContext } from "../src/types.js";

function detectorFor(name: string) {
	const detector = PLATFORM_DETECTORS.find((p) => p.name === name);
	if (!detector) throw new Error(`no detector named ${name}`);
	return detector;
}

function ctx(overrides: Partial<DetectContext> = {}): DetectContext {
	return { mode: "production", command: "build", env: {}, ...overrides };
}

describe("vercel detector", () => {
	const { detect } = detectorFor("vercel");

	it("defers when VERCEL isn't set", () => {
		expect(detect(ctx())).toBeUndefined();
	});

	it("maps VERCEL_ENV to prod/staging/dev", () => {
		expect(detect(ctx({ env: { VERCEL: "1", VERCEL_ENV: "production" } }))).toBe("prod");
		expect(detect(ctx({ env: { VERCEL: "1", VERCEL_ENV: "preview" } }))).toBe("staging");
		expect(detect(ctx({ env: { VERCEL: "1", VERCEL_ENV: "development" } }))).toBe("dev");
	});

	it("defers on an unrecognized VERCEL_ENV value", () => {
		expect(detect(ctx({ env: { VERCEL: "1", VERCEL_ENV: "something-new" } }))).toBeUndefined();
	});
});

describe("cloudflare-pages detector", () => {
	const { detect } = detectorFor("cloudflare-pages");

	it("defers when CF_PAGES isn't set", () => {
		expect(detect(ctx())).toBeUndefined();
	});

	it("treats main/master branches as prod, everything else as staging", () => {
		expect(detect(ctx({ env: { CF_PAGES: "1", CF_PAGES_BRANCH: "main" } }))).toBe("prod");
		expect(detect(ctx({ env: { CF_PAGES: "1", CF_PAGES_BRANCH: "master" } }))).toBe("prod");
		expect(detect(ctx({ env: { CF_PAGES: "1", CF_PAGES_BRANCH: "feature/x" } }))).toBe("staging");
		expect(detect(ctx({ env: { CF_PAGES: "1" } }))).toBe("staging");
	});
});

describe("node detector", () => {
	const { detect } = detectorFor("node");

	it("recognizes NODE_ENV=production during serve", () => {
		expect(detect(ctx({ command: "serve", env: { NODE_ENV: "production" } }))).toBe("prod");
		expect(detect(ctx({ command: "serve", env: { NODE_ENV: "development" } }))).toBeUndefined();
		expect(detect(ctx({ command: "serve" }))).toBeUndefined();
	});

	it("defers during build, since vite build force-sets NODE_ENV=production regardless of mode", () => {
		expect(
			detect(ctx({ command: "build", mode: "staging", env: { NODE_ENV: "production" } })),
		).toBeUndefined();
	});
});
