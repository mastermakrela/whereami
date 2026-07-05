import { describe, expect, it } from "vitest";
import { defaultDetect } from "../src/detect.js";

describe("defaultDetect", () => {
	it("returns prod for the production mode", () => {
		expect(defaultDetect({ mode: "production", command: "build", env: {} })).toBe("prod");
	});

	it("returns staging for the staging mode", () => {
		expect(defaultDetect({ mode: "staging", command: "build", env: {} })).toBe("staging");
	});

	it("returns dev for development and unknown modes", () => {
		expect(defaultDetect({ mode: "development", command: "serve", env: {} })).toBe("dev");
		expect(defaultDetect({ mode: "some-custom-mode", command: "build", env: {} })).toBe("dev");
	});

	it("lets WHEREAMI_ENV override everything", () => {
		expect(
			defaultDetect({ mode: "production", command: "build", env: { WHEREAMI_ENV: "staging" } }),
		).toBe("staging");
	});

	it("recognizes Vercel's system environment variables", () => {
		expect(
			defaultDetect({
				mode: "production",
				command: "build",
				env: { VERCEL: "1", VERCEL_ENV: "preview" },
			}),
		).toBe("staging");
	});

	it("recognizes Cloudflare Pages' system environment variables", () => {
		expect(
			defaultDetect({
				mode: "production",
				command: "build",
				env: { CF_PAGES: "1", CF_PAGES_BRANCH: "feature/x" },
			}),
		).toBe("staging");
		expect(
			defaultDetect({
				mode: "production",
				command: "build",
				env: { CF_PAGES: "1", CF_PAGES_BRANCH: "main" },
			}),
		).toBe("prod");
	});

	it("falls back to NODE_ENV=production when no platform matches", () => {
		expect(
			defaultDetect({
				mode: "some-custom-mode",
				command: "build",
				env: { NODE_ENV: "production" },
			}),
		).toBe("prod");
	});

	it("checks platforms before the generic NODE_ENV fallback", () => {
		// a Vercel preview build still runs with NODE_ENV=production
		expect(
			defaultDetect({
				mode: "production",
				command: "build",
				env: { VERCEL: "1", VERCEL_ENV: "preview", NODE_ENV: "production" },
			}),
		).toBe("staging");
	});
});
