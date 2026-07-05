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
});
