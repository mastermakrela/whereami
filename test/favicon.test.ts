import { PNG } from "pngjs";
import { describe, expect, it } from "vitest";
import { generateDefaultIcon, tintPng, tintSvg } from "../src/favicon.js";

describe("tintSvg", () => {
	it("wraps the svg content in a tinting filter", () => {
		const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle r="5"/></svg>';
		const out = tintSvg(svg, "#ff0000");

		expect(out).toContain("<filter");
		expect(out).toContain('flood-color="#ff0000"');
		expect(out).toContain('<g filter="url(#whereami-tint)">');
		expect(out).toContain('<circle r="5"/>');
		expect(out.indexOf("<svg")).toBeLessThan(out.indexOf("<filter"));
	});

	it("returns the input unchanged if it doesn't look like an svg", () => {
		expect(tintSvg("not an svg", "#ff0000")).toBe("not an svg");
	});
});

describe("tintPng", () => {
	it("recolors opaque pixels toward the target hue while keeping alpha", async () => {
		const png = new PNG({ width: 2, height: 1 });
		// one gray pixel, one transparent pixel
		png.data[0] = 128;
		png.data[1] = 128;
		png.data[2] = 128;
		png.data[3] = 255;
		png.data[4] = 10;
		png.data[5] = 20;
		png.data[6] = 30;
		png.data[7] = 0;
		const buffer = PNG.sync.write(png);

		const tinted = PNG.sync.read(await tintPng(buffer, "#0000ff"));

		// gray pixel should shift toward blue
		expect(tinted.data[2]).toBeGreaterThan(tinted.data[0]);
		expect(tinted.data[3]).toBe(255);
		// transparent pixel keeps alpha 0
		expect(tinted.data[7]).toBe(0);
	});
});

describe("generateDefaultIcon", () => {
	it("produces an svg using the given color and first letter of the name", () => {
		const svg = generateDefaultIcon("#22c55e", "my-app");
		expect(svg).toContain('fill="#22c55e"');
		expect(svg).toContain(">M<");
	});

	it("falls back to W when the name has no alphanumeric characters", () => {
		expect(generateDefaultIcon("#22c55e", "---")).toContain(">W<");
	});
});
