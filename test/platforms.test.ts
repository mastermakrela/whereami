import { describe, expect, it } from "vitest";
import { PLATFORM_DETECTORS } from "../src/platforms.js";

function detectorFor(name: string) {
	const detector = PLATFORM_DETECTORS.find((p) => p.name === name);
	if (!detector) throw new Error(`no detector named ${name}`);
	return detector;
}

describe("vercel detector", () => {
	const { detect } = detectorFor("vercel");

	it("defers when VERCEL isn't set", () => {
		expect(detect({})).toBeUndefined();
	});

	it("maps VERCEL_ENV to prod/staging/dev", () => {
		expect(detect({ VERCEL: "1", VERCEL_ENV: "production" })).toBe("prod");
		expect(detect({ VERCEL: "1", VERCEL_ENV: "preview" })).toBe("staging");
		expect(detect({ VERCEL: "1", VERCEL_ENV: "development" })).toBe("dev");
	});

	it("defers on an unrecognized VERCEL_ENV value", () => {
		expect(detect({ VERCEL: "1", VERCEL_ENV: "something-new" })).toBeUndefined();
	});
});

describe("cloudflare-pages detector", () => {
	const { detect } = detectorFor("cloudflare-pages");

	it("defers when CF_PAGES isn't set", () => {
		expect(detect({})).toBeUndefined();
	});

	it("treats main/master branches as prod, everything else as staging", () => {
		expect(detect({ CF_PAGES: "1", CF_PAGES_BRANCH: "main" })).toBe("prod");
		expect(detect({ CF_PAGES: "1", CF_PAGES_BRANCH: "master" })).toBe("prod");
		expect(detect({ CF_PAGES: "1", CF_PAGES_BRANCH: "feature/x" })).toBe("staging");
		expect(detect({ CF_PAGES: "1" })).toBe("staging");
	});
});

describe("node detector", () => {
	const { detect } = detectorFor("node");

	it("only recognizes NODE_ENV=production", () => {
		expect(detect({ NODE_ENV: "production" })).toBe("prod");
		expect(detect({ NODE_ENV: "development" })).toBeUndefined();
		expect(detect({})).toBeUndefined();
	});
});
