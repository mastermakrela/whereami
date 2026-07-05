import { describe, expect, it } from "vitest";
import { hexToHsl, hslToRgb, parseHexColor, rgbToHsl } from "../src/color.js";

describe("color helpers", () => {
	it("parses 6-digit and 3-digit hex colors", () => {
		expect(parseHexColor("#ff8800")).toEqual({ r: 255, g: 136, b: 0 });
		expect(parseHexColor("f80")).toEqual({ r: 255, g: 136, b: 0 });
	});

	it("rejects invalid hex colors", () => {
		expect(() => parseHexColor("not-a-color")).toThrow();
	});

	it("round-trips rgb -> hsl -> rgb", () => {
		const cases: Array<[number, number, number]> = [
			[255, 0, 0],
			[0, 255, 0],
			[0, 0, 255],
			[34, 197, 94],
			[128, 128, 128],
		];
		for (const [r, g, b] of cases) {
			const { h, s, l } = rgbToHsl(r, g, b);
			const back = hslToRgb(h, s, l);
			expect(Math.abs(back.r - r)).toBeLessThanOrEqual(1);
			expect(Math.abs(back.g - g)).toBeLessThanOrEqual(1);
			expect(Math.abs(back.b - b)).toBeLessThanOrEqual(1);
		}
	});

	it("hexToHsl matches rgbToHsl", () => {
		expect(hexToHsl("#22c55e")).toEqual(rgbToHsl(0x22, 0xc5, 0x5e));
	});
});
